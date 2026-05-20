import admin from 'firebase-admin';
import { env } from './env.config';
import { logger } from '../utils/logger';

let firebaseApp: admin.app.App;

export function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0] as admin.app.App;
    return firebaseApp;
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set — Firebase Admin SDK running without credentials (auth endpoints disabled)');
    firebaseApp = admin.initializeApp({
      projectId: 'mon-assistant-86bbd',
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
    return firebaseApp;
  }

  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY) as admin.ServiceAccount;

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });

    logger.info('Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', { error });
    throw error;
  }
}

export function getFirebaseAdmin(): admin.app.App {
  if (!firebaseApp) {
    return initFirebase();
  }
  return firebaseApp;
}

// Cache the configured Firestore instance — settings() can only be called once
// per app and must be called before any other Firestore method.
let _firestore: admin.firestore.Firestore | null = null;
export function getFirestore(): admin.firestore.Firestore {
  if (_firestore) return _firestore;
  const fs = getFirebaseAdmin().firestore();
  // Allow `undefined` fields in writes — they're stripped instead of throwing.
  // Required because optional fields like signatoryPhone often arrive as undefined.
  try { fs.settings({ ignoreUndefinedProperties: true }); } catch { /* already set */ }
  _firestore = fs;
  return fs;
}

export function getStorage(): admin.storage.Storage {
  return getFirebaseAdmin().storage();
}

export function getAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}
