"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
exports.getFirebaseAdmin = getFirebaseAdmin;
exports.getFirestore = getFirestore;
exports.getStorage = getStorage;
exports.getAuth = getAuth;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const env_config_1 = require("./env.config");
const logger_1 = require("../utils/logger");
let firebaseApp;
function initFirebase() {
    if (firebase_admin_1.default.apps.length > 0) {
        firebaseApp = firebase_admin_1.default.apps[0];
        return firebaseApp;
    }
    if (!env_config_1.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        logger_1.logger.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set — Firebase Admin SDK running without credentials (auth endpoints disabled)');
        firebaseApp = firebase_admin_1.default.initializeApp({
            projectId: 'mon-assistant-86bbd',
            storageBucket: env_config_1.env.FIREBASE_STORAGE_BUCKET,
        });
        return firebaseApp;
    }
    try {
        const serviceAccount = JSON.parse(env_config_1.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        firebaseApp = firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
            storageBucket: env_config_1.env.FIREBASE_STORAGE_BUCKET,
        });
        logger_1.logger.info('Firebase Admin SDK initialized');
        return firebaseApp;
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Firebase Admin SDK', { error });
        throw error;
    }
}
function getFirebaseAdmin() {
    if (!firebaseApp) {
        return initFirebase();
    }
    return firebaseApp;
}
function getFirestore() {
    return getFirebaseAdmin().firestore();
}
function getStorage() {
    return getFirebaseAdmin().storage();
}
function getAuth() {
    return getFirebaseAdmin().auth();
}
//# sourceMappingURL=firebase.config.js.map