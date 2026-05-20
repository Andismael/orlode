"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncProductToMeta = syncProductToMeta;
exports.deleteProductFromMeta = deleteProductFromMeta;
exports.importFromMetaCatalog = importFromMetaCatalog;
/**
 * Boutique → Meta Commerce catalog sync.
 *
 * Whenever a Boutique product is created / updated / deleted, we mirror the
 * change to the merchant's Meta catalog so the native WhatsApp product
 * picker stays in sync. The Boutique remains the source of truth (the AI
 * agent reads only from Firestore); Meta is downstream.
 *
 * Sync is fire-and-forget: failures are logged but never block the API
 * response. Merchants without a linked Meta catalog are silently skipped
 * (no warning — Boutique works on its own).
 */
const whatsappService_1 = require("../whatsapp/whatsappService");
const logger_1 = require("../../utils/logger");
const firebase_config_1 = require("../../config/firebase.config");
const PUBLIC_APP_URL = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
/**
 * Resolve the public storefront URL for a store, used as Meta product `url`.
 * Falls back to the company-id route if no slug is set.
 */
async function resolveStoreUrl(companyId, storeId) {
    try {
        const snap = await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/stores/${storeId}`).get();
        const slug = snap.data()?.['slug'];
        return slug
            ? `${PUBLIC_APP_URL}/shop/${slug}`
            : `${PUBLIC_APP_URL}/shop/${companyId}/${storeId}`;
    }
    catch {
        return `${PUBLIC_APP_URL}/shop/${companyId}/${storeId}`;
    }
}
/**
 * Push (upsert) a product to the Meta catalog. Non-blocking — caller does
 * not need to await for the API response to succeed.
 */
async function syncProductToMeta(companyId, storeId, productId, product) {
    const status = product.status ?? 'active';
    // Only push active or out-of-stock items; drafts/archived stay private.
    if (status === 'draft' || status === 'archived') {
        // If the product was previously active and now archived, remove it.
        if (status === 'archived') {
            void whatsappService_1.whatsappService.deleteCatalogProduct(companyId, productId)
                .catch(err => logger_1.logger.debug('[MetaSync] silent delete failed', { productId, err: String(err) }));
        }
        return;
    }
    const url = await resolveStoreUrl(companyId, storeId);
    const availability = (product.stockQty ?? 0) > 0 && status === 'active'
        ? 'in stock'
        : 'out of stock';
    const result = await whatsappService_1.whatsappService.upsertCatalogProduct(companyId, productId, {
        name: product.name,
        description: product.description ?? product.name,
        price: product.price,
        currency: product.currency,
        availability,
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
        url,
    });
    if (!result.ok) {
        // Skip silently if no catalog linked — that's the common case for
        // merchants who don't use Meta Catalog. Log only real errors.
        if (result.error !== 'no catalog' && result.error !== 'no whatsapp config') {
            logger_1.logger.warn('[MetaSync] upsert failed', { companyId, storeId, productId, error: result.error });
        }
    }
    else {
        logger_1.logger.info('[MetaSync] product mirrored to Meta', { productId, name: product.name });
    }
}
/**
 * Remove a product from Meta when it's deleted in Boutique.
 */
async function deleteProductFromMeta(companyId, productId) {
    const result = await whatsappService_1.whatsappService.deleteCatalogProduct(companyId, productId);
    if (!result.ok && result.error !== 'no catalog' && result.error !== 'no whatsapp config') {
        logger_1.logger.warn('[MetaSync] delete failed', { companyId, productId, error: result.error });
    }
}
/**
 * Pull the current Meta catalog into the Boutique. Used for one-shot
 * import when a merchant migrates from Meta-only to Boutique.
 */
async function importFromMetaCatalog(companyId, storeId) {
    const products = await whatsappService_1.whatsappService.listCatalogProducts(companyId);
    if (products.length === 0) {
        return { imported: 0, skipped: 0, errors: [] };
    }
    const db = (0, firebase_config_1.getFirestore)();
    const productsCol = db.collection(`companies/${companyId}/stores/${storeId}/products`);
    // Read existing products to dedupe by retailer_id (= our doc id) — Meta's
    // retailer_id is opaque to us if products were created on Meta-side first.
    const existingSnap = await productsCol.get();
    const existingByMetaId = new Map(); // metaProductId → docId
    existingSnap.docs.forEach(d => {
        const meta = d.data()['metaProductId'];
        if (meta)
            existingByMetaId.set(meta, d.id);
    });
    let imported = 0, skipped = 0;
    const errors = [];
    for (const p of products) {
        try {
            const metaProductId = p['id'];
            const retailerId = p['retailer_id'];
            if (!metaProductId) {
                skipped += 1;
                continue;
            }
            if (existingByMetaId.has(metaProductId)) {
                skipped += 1;
                continue;
            }
            // Parse "1500 XOF" / "15.00 USD"
            const priceRaw = String(p['price'] ?? '0');
            const [priceNum, priceCurrency] = priceRaw.split(/\s+/);
            const currency = priceCurrency ?? p['currency'] ?? 'XOF';
            const noDecimal = ['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX'].includes(currency);
            const price = Math.round(parseFloat(priceNum ?? '0') * (noDecimal ? 1 : 100));
            const ref = productsCol.doc();
            await ref.set({
                name: String(p['name'] ?? 'Produit Meta'),
                description: String(p['description'] ?? ''),
                price,
                currency,
                imageUrl: p['image_url'],
                stockQty: p['availability'] === 'in stock' ? 1 : 0,
                status: p['availability'] === 'in stock' ? 'active' : 'out_of_stock',
                createdBy: 'meta-import',
                metaProductId,
                metaRetailerId: retailerId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            imported += 1;
        }
        catch (err) {
            errors.push(String(err));
        }
    }
    logger_1.logger.info('[MetaSync] import complete', { companyId, storeId, imported, skipped, errors: errors.length });
    return { imported, skipped, errors };
}
//# sourceMappingURL=metaCatalogSync.js.map