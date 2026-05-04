import type { Request, Response, NextFunction } from 'express';
import { getAuth, getFirestore } from '../config/firebase.config';
import { apiKeysService } from '../services/apiKeys.service';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    companyId?: string;
    role?: string;
    authMethod?: 'firebase' | 'apikey';
    apiKeyScopes?: string[];
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ── API Key auth (X-API-Key header or ?api_key= query) ──────────────────────
  const apiKey = (req.headers['x-api-key'] as string | undefined) ?? (req.query['api_key'] as string | undefined);

  if (apiKey) {
    const keyData = await apiKeysService.validateKey(apiKey);
    if (!keyData) {
      res.status(401).json({ success: false, message: 'Invalid or expired API key' });
      return;
    }
    req.user = {
      uid:          `apikey:${keyData.keyId}`,
      email:        `${keyData.companyName}@api`,
      companyId:    keyData.companyId,
      authMethod:   'apikey',
      apiKeyScopes: keyData.scopes,
    };
    next();
    return;
  }

  // ── Firebase ID Token (Bearer) ───────────────────────────────────────────────
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decodedToken = await getAuth().verifyIdToken(token);

    // Read role from Firestore (token custom claims may not have it)
    let role = decodedToken['role'] as string | undefined;
    const uid = decodedToken.uid;
    if (!role) {
      try {
        const userDoc = await getFirestore().collection('users').doc(uid).get();
        role = userDoc.data()?.['role'] as string | undefined;
      } catch { /* non-critical */ }
    }

    // Resolve companyId: prefer custom claim, then Firestore user doc, finally fall back to uid.
    // This handles invited users whose token hasn't been refreshed with the new custom claim yet.
    let companyId = decodedToken['companyId'] as string | undefined;
    if (!companyId) {
      try {
        const userDoc = await getFirestore().collection('users').doc(uid).get();
        companyId = userDoc.data()?.['companyId'] as string | undefined;
      } catch { /* non-critical */ }
    }
    if (!companyId) companyId = uid;

    req.user = {
      uid,
      email:      decodedToken.email ?? '',
      companyId,
      role,
      authMethod: 'firebase',
    };

    next();
  } catch (error) {
    logger.warn('Invalid Firebase ID token', { error: (error as Error).message });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
