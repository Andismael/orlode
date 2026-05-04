"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOnlyMiddleware = adminOnlyMiddleware;
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("./error.middleware");
async function adminOnlyMiddleware(req, res, next) {
    if (!req.user?.uid) {
        next(new error_middleware_1.AppError('Not authenticated', 401));
        return;
    }
    const db = (0, firebase_config_1.getFirestore)();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const role = userDoc.data()?.['role'];
    if (role !== 'admin' && role !== 'manager') {
        next(new error_middleware_1.AppError('Admin access required', 403));
        return;
    }
    next();
}
//# sourceMappingURL=adminOnly.middleware.js.map