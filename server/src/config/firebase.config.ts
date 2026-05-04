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

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}

export function getStorage(): admin.storage.Storage {
  return getFirebaseAdmin().storage();
}

export function getAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}
