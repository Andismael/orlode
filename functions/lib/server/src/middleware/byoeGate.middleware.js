"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.byoeGate = byoeGate;
const firebase_config_1 = require("../config/firebase.config");
const logger_1 = require("../utils/logger");
async function isSuperAdmin(uid) {
    if (!uid)
        return false;
    const doc = await (0, firebase_config_1.getFirestore)().collection('users').doc(uid).get();
    return doc.data()?.['superAdmin'] === true;
}
async function byoeGate(req, res, next) {
    const companyId = req.user?.companyId;
    if (!companyId) {
        next();
        return;
    }
    // Super admin bypass
    if (await isSuperAdmin(req.user?.uid)) {
        next();
        return;
    }
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const data = companyDoc.data() ?? {};
    // Path 1: BYOE is configured — check tenant has encrypted key
    if (data['byoeEnabled'] === true) {
        const tenantDoc = await db.collection('tenants').doc(companyId).get();
        const hasKey = tenantDoc.exists && Boolean(tenantDoc.data()?.['byoe']?.['geminiApiKeyEncrypted']);
        if (hasKey) {
            next();
            return;
        }
        // byoeEnabled but no key stored — fall through to exception check
    }
    // Path 2: active hosted exception (super admin granted)
    const ex = data['hostedException'];
    if (ex?.expiresAt) {
        const exp = new Date(ex.expiresAt).getTime();
        if (exp > Date.now()) {
            next();
            return;
        }
        // Exception expired
    }
    // Otherwise: block
    logger_1.logger.info('[BYOE Gate] Blocked agent call — no BYOE, no exception', { companyId });
    res.status(402).json({
        success: false,
        error: 'BYOE_REQUIRED',
        message: 'Configurez votre hébergement BYOE pour activer les agents IA, ou demandez une exception à l\'administrateur.',
        cta: { label: 'Configurer BYOE', url: '/admin/byoe' },
    });
}
//# sourceMappingURL=byoeGate.middleware.js.map