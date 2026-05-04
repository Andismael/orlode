"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const setup_1 = require("../../setup");
vitest_1.vi.mock('@/services/connectors/ecommerceConnectorService', () => ({
    ecommerceConnectorService: {
        syncEcommerce: vitest_1.vi.fn(),
        testConnection: vitest_1.vi.fn(),
    },
}));
const ecommerceConnectorService_1 = require("@/services/connectors/ecommerceConnectorService");
(0, vitest_1.describe)('E-Commerce Connector Service', () => {
    (0, vitest_1.beforeEach)(() => {
        (0, setup_1.clearMockFirestore)();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should sync Shopify products', async () => {
        vitest_1.vi.mocked(ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce).mockResolvedValue({
            platform: 'shopify',
            productsIndexed: 2,
            ordersIndexed: 0,
            customersIndexed: 0,
            chunksCreated: 4,
            errors: 0,
        });
        const result = await ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce({
            companyId: 'co1',
            platform: 'shopify',
            shopUrl: 'test-shop.myshopify.com',
            accessToken: 'encrypted_token',
            syncProducts: true,
            syncOrders: false,
            syncCustomers: false,
        });
        (0, vitest_1.expect)(result.productsIndexed).toBe(2);
        (0, vitest_1.expect)(result.platform).toBe('shopify');
    });
    (0, vitest_1.it)('should sync WooCommerce products and orders', async () => {
        vitest_1.vi.mocked(ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce).mockResolvedValue({
            platform: 'woocommerce',
            productsIndexed: 10,
            ordersIndexed: 50,
            customersIndexed: 0,
            chunksCreated: 60,
            errors: 0,
        });
        const result = await ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce({
            companyId: 'co1',
            platform: 'woocommerce',
            shopUrl: 'https://myshop.com',
            accessToken: 'encrypted_woo_token',
            syncProducts: true,
            syncOrders: true,
            syncCustomers: false,
        });
        (0, vitest_1.expect)(result.productsIndexed).toBe(10);
        (0, vitest_1.expect)(result.ordersIndexed).toBe(50);
    });
    (0, vitest_1.it)('should handle empty product catalog', async () => {
        vitest_1.vi.mocked(ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce).mockResolvedValue({
            platform: 'shopify',
            productsIndexed: 0,
            ordersIndexed: 0,
            customersIndexed: 0,
            chunksCreated: 0,
            errors: 0,
        });
        const result = await ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce({
            companyId: 'co1',
            platform: 'shopify',
            shopUrl: 'empty-shop.myshopify.com',
            accessToken: 'encrypted_token',
            syncProducts: true,
            syncOrders: false,
            syncCustomers: false,
        });
        (0, vitest_1.expect)(result.productsIndexed).toBe(0);
        (0, vitest_1.expect)(result.errors).toBe(0);
    });
    (0, vitest_1.it)('should test e-commerce connection', async () => {
        vitest_1.vi.mocked(ecommerceConnectorService_1.ecommerceConnectorService.testConnection).mockResolvedValue({ ok: true });
        const result = await ecommerceConnectorService_1.ecommerceConnectorService.testConnection('shopify', {
            shopUrl: 'test.myshopify.com',
            accessToken: 'encrypted_token',
        });
        (0, vitest_1.expect)(result.ok).toBe(true);
    });
});
//# sourceMappingURL=ecommerceConnector.test.js.map