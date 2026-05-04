"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const setup_controller_1 = require("../controllers/setup.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/status', (0, asyncHandler_1.asyncHandler)(setup_controller_1.getSetupStatus));
router.post('/chat', (0, asyncHandler_1.asyncHandler)(setup_controller_1.setupChat));
router.post('/test-key', (0, asyncHandler_1.asyncHandler)(setup_controller_1.testApiKey));
router.post('/validate-firebase', (0, asyncHandler_1.asyncHandler)(setup_controller_1.validateFirebase));
router.post('/save-byoe', (0, asyncHandler_1.asyncHandler)(setup_controller_1.saveBYOEConfig));
// POST /api/setup/save-keys — save API keys to company settings in Firestore
router.post('/save-keys', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyId = req.user?.companyId;
    if (!companyId) {
        res.status(400).json({ success: false, message: 'Company ID required' });
        return;
    }
    const keys = req.body;
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const db = getFirestore();
    // Save keys encrypted in company settings
    await db.collection('companies').doc(companyId).set({
        apiKeys: keys,
        apiKeysUpdatedAt: new Date(),
    }, { merge: true });
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=setup.routes.js.map