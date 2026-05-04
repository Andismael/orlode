import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from './error.middleware';

export async function adminOnlyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user?.uid) { next(new AppError('Not authenticated', 401)); return; }

  const db = getFirestore();
  const userDoc = await db.collection('users').doc(req.user.uid).get();
  const role = userDoc.data()?.['role'] as string | undefined;

  if (role !== 'admin' && role !== 'manager') {
    next(new AppError('Admin access required', 403));
    return;
  }

  next();
}
