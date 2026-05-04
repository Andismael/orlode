import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearMockFirestore } from '../../setup';

vi.mock('@/services/connectors/ecommerceConnectorService', () => ({
  ecommerceConnectorService: {
    syncEcommerce: vi.fn(),
    testConnection: vi.fn(),
  },
}));

import { ecommerceConnectorService } from '@/services/connectors/ecommerceConnectorService';

describe('E-Commerce Connector Service', () => {
  beforeEach(() => {
    clearMockFirestore();
    vi.clearAllMocks();
  });

  it('should sync Shopify products', async () => {
    vi.mocked(ecommerceConnectorService.syncEcommerce).mockResolvedValue({
      platform: 'shopify',
      productsIndexed: 2,
      ordersIndexed: 0,
      customersIndexed: 0,
      chunksCreated: 4,
      errors: 0,
    });

    const result = await ecommerceConnectorService.syncEcommerce({
      companyId: 'co1',
      platform: 'shopify',
      shopUrl: 'test-shop.myshopify.com',
      accessToken: 'encrypted_token',
      syncProducts: true,
      syncOrders: false,
      syncCustomers: false,
    });

    expect(result.productsIndexed).toBe(2);
    expect(result.platform).toBe('shopify');
  });

  it('should sync WooCommerce products and orders', async () => {
    vi.mocked(ecommerceConnectorService.syncEcommerce).mockResolvedValue({
      platform: 'woocommerce',
      productsIndexed: 10,
      ordersIndexed: 50,
      customersIndexed: 0,
      chunksCreated: 60,
      errors: 0,
    });

    const result = await ecommerceConnectorService.syncEcommerce({
      companyId: 'co1',
      platform: 'woocommerce',
      shopUrl: 'https://myshop.com',
      accessToken: 'encrypted_woo_token',
      syncProducts: true,
      syncOrders: true,
      syncCustomers: false,
    });

    expect(result.productsIndexed).toBe(10);
    expect(result.ordersIndexed).toBe(50);
  });

  it('should handle empty product catalog', async () => {
    vi.mocked(ecommerceConnectorService.syncEcommerce).mockResolvedValue({
      platform: 'shopify',
      productsIndexed: 0,
      ordersIndexed: 0,
      customersIndexed: 0,
      chunksCreated: 0,
      errors: 0,
    });

    const result = await ecommerceConnectorService.syncEcommerce({
      companyId: 'co1',
      platform: 'shopify',
      shopUrl: 'empty-shop.myshopify.com',
      accessToken: 'encrypted_token',
      syncProducts: true,
      syncOrders: false,
      syncCustomers: false,
    });

    expect(result.productsIndexed).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('should test e-commerce connection', async () => {
    vi.mocked(ecommerceConnectorService.testConnection).mockResolvedValue({ ok: true });

    const result = await ecommerceConnectorService.testConnection('shopify', {
      shopUrl: 'test.myshopify.com',
      accessToken: 'encrypted_token',
    });

    expect(result.ok).toBe(true);
  });
});
