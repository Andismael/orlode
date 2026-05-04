/**
 * E-Commerce Connector Service
 * Supports Shopify and WooCommerce via their REST APIs.
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateEmbedding } from '../rag/embeddingService';
import { firestoreVectorStore } from '../rag/firestoreVectorStore';
import { encrypt, decrypt } from '../../config/encryption';
import { logger } from '../../utils/logger';

export type EcommercePlatform = 'shopify' | 'woocommerce';

export interface ShopifyConfig {
  companyId: string;
  platform: 'shopify';
  shopUrl: string;           // e.g. my-shop.myshopify.com
  accessToken: string;       // stored encrypted
  syncProducts: boolean;
  syncOrders: boolean;
  syncCustomers: boolean;
}

export interface WooCommerceConfig {
  companyId: string;
  platform: 'woocommerce';
  siteUrl: string;
  consumerKey: string;       // stored encrypted
  consumerSecret: string;    // stored encrypted
  syncProducts: boolean;
  syncOrders: boolean;
}

export type EcommerceConfig = ShopifyConfig | WooCommerceConfig;

export interface EcommerceSyncResult {
  platform: EcommercePlatform;
  productsIndexed: number;
  ordersIndexed: number;
  customersIndexed: number;
  chunksCreated: number;
}

// ── Shopify ───────────────────────────────────────────────────────────────────

async function shopifyFetch(shopUrl: string, token: string, path: string): Promise<unknown> {
  const url = `https://${shopUrl}/admin/api/2024-01${path}`;
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Shopify API error ${response.status}: ${await response.text()}`);
  return response.json();
}

async function syncShopify(
  config: ShopifyConfig,
): Promise<EcommerceSyncResult> {
  const token = decrypt(config.accessToken);
  let productsIndexed = 0;
  let ordersIndexed = 0;
  let customersIndexed = 0;
  let chunksCreated = 0;
  const toUpsert: Array<{ id: string; data: Parameters<typeof firestoreVectorStore.upsertChunks>[1][number]['data']; embedding: number[] }> = [];

  // Products
  if (config.syncProducts) {
    const data = await shopifyFetch(config.shopUrl, token, '/products.json?limit=250') as { products: Record<string, unknown>[] };
    for (const p of (data.products ?? [])) {
      const text = `Product: ${p['title']} | Price: ${(p['variants'] as { price?: string }[])?.[0]?.price ?? 'N/A'} | Description: ${String(p['body_html'] ?? '').replace(/<[^>]+>/g, '').slice(0, 200)}`;
      const embedding = await generateEmbedding(text);
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
    const data = await shopifyFetch(config.shopUrl, token, '/orders.json?limit=250&status=any') as { orders: Record<string, unknown>[] };
    for (const o of (data.orders ?? [])) {
      const customer = o['customer'] as Record<string, unknown> | undefined;
      const text = `Order #${o['order_number']} | Customer: ${customer?.['first_name']} ${customer?.['last_name']} | Total: ${o['total_price']} ${o['currency']} | Status: ${o['fulfillment_status'] ?? 'pending'}`;
      const embedding = await generateEmbedding(text);
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
    const data = await shopifyFetch(config.shopUrl, token, '/customers.json?limit=250') as { customers: Record<string, unknown>[] };
    for (const c of (data.customers ?? [])) {
      const text = `Customer: ${c['first_name']} ${c['last_name']} | Email: ${c['email']} | Orders: ${c['orders_count']} | Total spent: ${c['total_spent']}`;
      const embedding = await generateEmbedding(text);
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

  await firestoreVectorStore.upsertChunks(config.companyId, toUpsert);

  return {
    platform: 'shopify',
    productsIndexed,
    ordersIndexed,
    customersIndexed,
    chunksCreated,
  };
}

// ── WooCommerce ───────────────────────────────────────────────────────────────

async function wooFetch(siteUrl: string, consumerKey: string, consumerSecret: string, path: string): Promise<unknown> {
  const url = `${siteUrl}/wp-json/wc/v3${path}`;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`WooCommerce API error ${response.status}`);
  return response.json();
}

async function syncWooCommerce(config: WooCommerceConfig): Promise<EcommerceSyncResult> {
  const ck = decrypt(config.consumerKey);
  const cs = decrypt(config.consumerSecret);
  let productsIndexed = 0;
  let ordersIndexed = 0;
  const chunksCreated = { value: 0 };
  const toUpsert: Array<{ id: string; data: Parameters<typeof firestoreVectorStore.upsertChunks>[1][number]['data']; embedding: number[] }> = [];

  if (config.syncProducts) {
    const products = await wooFetch(config.siteUrl, ck, cs, '/products?per_page=100') as Record<string, unknown>[];
    for (const p of (Array.isArray(products) ? products : [])) {
      const text = `Product: ${p['name']} | Price: ${p['price']} | Description: ${String(p['short_description'] ?? '').replace(/<[^>]+>/g, '').slice(0, 200)}`;
      const embedding = await generateEmbedding(text);
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
    const orders = await wooFetch(config.siteUrl, ck, cs, '/orders?per_page=100') as Record<string, unknown>[];
    for (const o of (Array.isArray(orders) ? orders : [])) {
      const billing = o['billing'] as Record<string, unknown> | undefined;
      const text = `Order #${o['number']} | Customer: ${billing?.['first_name']} ${billing?.['last_name']} | Total: ${o['total']} ${o['currency']} | Status: ${o['status']}`;
      const embedding = await generateEmbedding(text);
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

  await firestoreVectorStore.upsertChunks(config.companyId, toUpsert);

  return {
    platform: 'woocommerce',
    productsIndexed,
    ordersIndexed,
    customersIndexed: 0,
    chunksCreated: chunksCreated.value,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class EcommerceConnectorService {

  async syncEcommerce(config: EcommerceConfig): Promise<EcommerceSyncResult> {
    logger.info(`[EcommerceConnector] Syncing ${config.platform} for company ${config.companyId}`);
    const result = config.platform === 'shopify'
      ? await syncShopify(config as ShopifyConfig)
      : await syncWooCommerce(config as WooCommerceConfig);

    const db = getFirestore();
    const key = config.platform === 'shopify'
      ? `shopify_${(config as ShopifyConfig).shopUrl}`
      : `woo_${(config as WooCommerceConfig).siteUrl}`;

    await db.collection(`companies/${config.companyId}/connectors`).doc(key).update({
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncChunks: result.chunksCreated,
    });

    logger.info(`[EcommerceConnector] ${config.platform} sync done: ${result.chunksCreated} chunks`);
    return result;
  }

  async saveShopifyConfig(config: ShopifyConfig): Promise<void> {
    const db = getFirestore();
    await db.collection(`companies/${config.companyId}/connectors`).doc(`shopify_${config.shopUrl}`).set({
      type: 'ecommerce',
      ...config,
      accessToken: encrypt(config.accessToken),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async saveWooConfig(config: WooCommerceConfig): Promise<void> {
    const db = getFirestore();
    await db.collection(`companies/${config.companyId}/connectors`).doc(`woo_${config.siteUrl}`).set({
      type: 'ecommerce',
      ...config,
      consumerKey: encrypt(config.consumerKey),
      consumerSecret: encrypt(config.consumerSecret),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export const ecommerceConnectorService = new EcommerceConnectorService();
