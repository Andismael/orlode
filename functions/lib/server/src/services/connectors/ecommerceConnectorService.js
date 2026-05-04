"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ecommerceConnectorService = exports.EcommerceConnectorService = void 0;
/**
 * E-Commerce Connector Service
 * Supports Shopify and WooCommerce via their REST APIs.
 */
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const embeddingService_1 = require("../rag/embeddingService");
const firestoreVectorStore_1 = require("../rag/firestoreVectorStore");
const encryption_1 = require("../../config/encryption");
const logger_1 = require("../../utils/logger");
// ── Shopify ───────────────────────────────────────────────────────────────────
async function shopifyFetch(shopUrl, token, path) {
    const url = `https://${shopUrl}/admin/api/2024-01${path}`;
    const response = await fetch(url, {
        headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok)
        throw new Error(`Shopify API error ${response.status}: ${await response.text()}`);
    return response.json();
}
async function syncShopify(config) {
    const token = (0, encryption_1.decrypt)(config.accessToken);
    let productsIndexed = 0;
    let ordersIndexed = 0;
    let customersIndexed = 0;
    let chunksCreated = 0;
    const toUpsert = [];
    // Products
    if (config.syncProducts) {
        const data = await shopifyFetch(config.shopUrl, token, '/products.json?limit=250');
        for (const p of (data.products ?? [])) {
            const text = `Product: ${p['title']} | Price: ${p['variants']?.[0]?.price ?? 'N/A'} | Description: ${String(p['body_html'] ?? '').replace(/<[^>]+>/g, '').slice(0, 200)}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(text);
            toUpsert.push({
                id: `shopify_${config.shopUrl}_product_${p['id']}`,
                data: {
                    documentId: `connector_shopify_${config.shopUrl}`,
                    documentName: `Shopify / Products`,
                    content: text,
                    chunkIndex: productsIndexed,
                    metadata: { category: 'ecommerce', confidentiality: 'internal', language: 'auto', tokenCount: text.split(/\s+/).length },
                },
                embedding,
            });
            productsIndexed++;
            chunksCreated++;
        }
    }
    // Orders
    if (config.syncOrders) {
        const data = await shopifyFetch(config.shopUrl, token, '/orders.json?limit=250&status=any');
        for (const o of (data.orders ?? [])) {
            const customer = o['customer'];
            const text = `Order #${o['order_number']} | Customer: ${customer?.['first_name']} ${customer?.['last_name']} | Total: ${o['total_price']} ${o['currency']} | Status: ${o['fulfillment_status'] ?? 'pending'}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(text);
            toUpsert.push({
                id: `shopify_${config.shopUrl}_order_${o['id']}`,
                data: {
                    documentId: `connector_shopify_${config.shopUrl}`,
                    documentName: `Shopify / Orders`,
                    content: text,
                    chunkIndex: ordersIndexed,
                    metadata: { category: 'ecommerce', confidentiality: 'internal', language: 'auto', tokenCount: text.split(/\s+/).length },
                },
                embedding,
            });
            ordersIndexed++;
            chunksCreated++;
        }
    }
    // Customers
    if (config.syncCustomers) {
        const data = await shopifyFetch(config.shopUrl, token, '/customers.json?limit=250');
        for (const c of (data.customers ?? [])) {
            const text = `Customer: ${c['first_name']} ${c['last_name']} | Email: ${c['email']} | Orders: ${c['orders_count']} | Total spent: ${c['total_spent']}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(text);
            toUpsert.push({
                id: `shopify_${config.shopUrl}_customer_${c['id']}`,
                data: {
                    documentId: `connector_shopify_${config.shopUrl}`,
                    documentName: `Shopify / Customers`,
                    content: text,
                    chunkIndex: customersIndexed,
                    metadata: { category: 'ecommerce', confidentiality: 'internal', language: 'auto', tokenCount: text.split(/\s+/).length },
                },
                embedding,
            });
            customersIndexed++;
            chunksCreated++;
        }
    }
    await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(config.companyId, toUpsert);
    return {
        platform: 'shopify',
        productsIndexed,
        ordersIndexed,
        customersIndexed,
        chunksCreated,
    };
}
// ── WooCommerce ───────────────────────────────────────────────────────────────
async function wooFetch(siteUrl, consumerKey, consumerSecret, path) {
    const url = `${siteUrl}/wp-json/wc/v3${path}`;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok)
        throw new Error(`WooCommerce API error ${response.status}`);
    return response.json();
}
async function syncWooCommerce(config) {
    const ck = (0, encryption_1.decrypt)(config.consumerKey);
    const cs = (0, encryption_1.decrypt)(config.consumerSecret);
    let productsIndexed = 0;
    let ordersIndexed = 0;
    const chunksCreated = { value: 0 };
    const toUpsert = [];
    if (config.syncProducts) {
        const products = await wooFetch(config.siteUrl, ck, cs, '/products?per_page=100');
        for (const p of (Array.isArray(products) ? products : [])) {
            const text = `Product: ${p['name']} | Price: ${p['price']} | Description: ${String(p['short_description'] ?? '').replace(/<[^>]+>/g, '').slice(0, 200)}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(text);
            toUpsert.push({
                id: `woo_${config.siteUrl}_product_${p['id']}`,
                data: {
                    documentId: `connector_woo_${config.siteUrl}`,
                    documentName: `WooCommerce / Products`,
                    content: text,
                    chunkIndex: productsIndexed,
                    metadata: { category: 'ecommerce', confidentiality: 'internal', language: 'auto', tokenCount: text.split(/\s+/).length },
                },
                embedding,
            });
            productsIndexed++;
            chunksCreated.value++;
        }
    }
    if (config.syncOrders) {
        const orders = await wooFetch(config.siteUrl, ck, cs, '/orders?per_page=100');
        for (const o of (Array.isArray(orders) ? orders : [])) {
            const billing = o['billing'];
            const text = `Order #${o['number']} | Customer: ${billing?.['first_name']} ${billing?.['last_name']} | Total: ${o['total']} ${o['currency']} | Status: ${o['status']}`;
            const embedding = await (0, embeddingService_1.generateEmbedding)(text);
            toUpsert.push({
                id: `woo_${config.siteUrl}_order_${o['id']}`,
                data: {
                    documentId: `connector_woo_${config.siteUrl}`,
                    documentName: `WooCommerce / Orders`,
                    content: text,
                    chunkIndex: ordersIndexed,
                    metadata: { category: 'ecommerce', confidentiality: 'internal', language: 'auto', tokenCount: text.split(/\s+/).length },
                },
                embedding,
            });
            ordersIndexed++;
            chunksCreated.value++;
        }
    }
    await firestoreVectorStore_1.firestoreVectorStore.upsertChunks(config.companyId, toUpsert);
    return {
        platform: 'woocommerce',
        productsIndexed,
        ordersIndexed,
        customersIndexed: 0,
        chunksCreated: chunksCreated.value,
    };
}
// ── Service ───────────────────────────────────────────────────────────────────
class EcommerceConnectorService {
    async syncEcommerce(config) {
        logger_1.logger.info(`[EcommerceConnector] Syncing ${config.platform} for company ${config.companyId}`);
        const result = config.platform === 'shopify'
            ? await syncShopify(config)
            : await syncWooCommerce(config);
        const db = (0, firebase_config_1.getFirestore)();
        const key = config.platform === 'shopify'
            ? `shopify_${config.shopUrl}`
            : `woo_${config.siteUrl}`;
        await db.collection(`companies/${config.companyId}/connectors`).doc(key).update({
            lastSyncAt: firestore_1.FieldValue.serverTimestamp(),
            lastSyncChunks: result.chunksCreated,
        });
        logger_1.logger.info(`[EcommerceConnector] ${config.platform} sync done: ${result.chunksCreated} chunks`);
        return result;
    }
    async saveShopifyConfig(config) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${config.companyId}/connectors`).doc(`shopify_${config.shopUrl}`).set({
            type: 'ecommerce',
            ...config,
            accessToken: (0, encryption_1.encrypt)(config.accessToken),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async saveWooConfig(config) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${config.companyId}/connectors`).doc(`woo_${config.siteUrl}`).set({
            type: 'ecommerce',
            ...config,
            consumerKey: (0, encryption_1.encrypt)(config.consumerKey),
            consumerSecret: (0, encryption_1.encrypt)(config.consumerSecret),
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
}
exports.EcommerceConnectorService = EcommerceConnectorService;
exports.ecommerceConnectorService = new EcommerceConnectorService();
//# sourceMappingURL=ecommerceConnectorService.js.map