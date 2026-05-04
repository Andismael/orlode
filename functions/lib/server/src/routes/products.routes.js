"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Products catalog for the Clone commerce layer.
 *
 * Firestore: companies/{id}/products/{productId}
 *   { id, name, description, price (number), currency, stock (number|null), category, imageUrl, active, createdAt }
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { active, category } = req.query;
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/products`);
    if (active === 'true')
        q = q.where('active', '==', true);
    if (category)
        q = q.where('category', '==', category);
    const snap = await q.limit(500).get().catch(async () => await db.collection(`companies/${companyId}/products`).limit(500).get());
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: items });
}));
router.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { name, description, price, currency, stock, category, imageUrl } = req.body;
    if (!name?.trim())
        throw new error_middleware_1.AppError('name required', 400);
    if (price == null || isNaN(Number(price)) || Number(price) < 0)
        throw new error_middleware_1.AppError('valid price required', 400);
    const id = (0, helpers_1.generateId)();
    const doc = {
        id, name: name.trim(), description: description ?? '',
        price: Number(price),
        currency: currency ?? 'XOF',
        stock: stock === undefined ? null : stock,
        category: category ?? '',
        imageUrl: imageUrl ?? '',
        active: true,
        createdAt: new Date(),
    };
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/products`).doc(id).set(doc);
    res.json({ success: true, data: doc });
}));
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    const body = req.body;
    const allowed = ['name', 'description', 'price', 'currency', 'stock', 'category', 'imageUrl', 'active'];
    const updates = { updatedAt: new Date() };
    for (const k of allowed)
        if (k in body)
            updates[k] = body[k];
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/products`).doc(id).update(updates);
    res.json({ success: true });
}));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/products`).doc(id).delete();
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=products.routes.js.map