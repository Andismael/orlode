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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
/**
 * Orlode AI — Firebase Cloud Functions entry point
 * Wraps the Express server as a 2nd-gen Cloud Function.
 * Socket.io is disabled in this context (Cloud Functions don't support WebSockets).
 */
require("./env-setup"); // MUST be first — loads .env before any server module
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
// Config
const firebase_config_1 = require("../../server/src/config/firebase.config");
const mcp_config_1 = require("../../server/src/config/mcp.config");
const rateLimit_middleware_1 = require("../../server/src/middleware/rateLimit.middleware");
const auditLog_middleware_1 = require("../../server/src/middleware/auditLog.middleware");
const error_middleware_1 = require("../../server/src/middleware/error.middleware");
// Routes
const auth_routes_1 = __importDefault(require("../../server/src/routes/auth.routes"));
const chat_routes_1 = __importDefault(require("../../server/src/routes/chat.routes"));
const data_routes_1 = __importDefault(require("../../server/src/routes/data.routes"));
const meeting_routes_1 = __importDefault(require("../../server/src/routes/meeting.routes"));
const analytics_routes_1 = __importDefault(require("../../server/src/routes/analytics.routes"));
const faces_routes_1 = __importDefault(require("../../server/src/routes/faces.routes"));
const agent_routes_1 = __importDefault(require("../../server/src/routes/agent.routes"));
const gdpr_routes_1 = __importDefault(require("../../server/src/routes/gdpr.routes"));
const billing_routes_1 = __importDefault(require("../../server/src/routes/billing.routes"));
const apiKey_routes_1 = __importDefault(require("../../server/src/routes/apiKey.routes"));
const onboarding_routes_1 = __importDefault(require("../../server/src/routes/onboarding.routes"));
const setup_routes_1 = __importDefault(require("../../server/src/routes/setup.routes"));
const connectors_routes_1 = __importDefault(require("../../server/src/routes/connectors.routes"));
const emails_routes_1 = __importDefault(require("../../server/src/routes/emails.routes"));
const reception_routes_1 = __importDefault(require("../../server/src/routes/reception.routes"));
const agents_routes_1 = __importDefault(require("../../server/src/routes/agents.routes"));
const support_routes_1 = __importDefault(require("../../server/src/routes/support.routes"));
const finance_routes_1 = __importDefault(require("../../server/src/routes/finance.routes"));
const marketing_routes_1 = __importDefault(require("../../server/src/routes/marketing.routes"));
const it_routes_1 = __importDefault(require("../../server/src/routes/it.routes"));
const sales_routes_1 = __importDefault(require("../../server/src/routes/sales.routes"));
const hr_routes_1 = __importDefault(require("../../server/src/routes/hr.routes"));
const security_routes_1 = __importDefault(require("../../server/src/routes/security.routes"));
const training_routes_1 = __importDefault(require("../../server/src/routes/training.routes"));
const company_routes_1 = __importDefault(require("../../server/src/routes/company.routes"));
const whatsapp_routes_1 = __importDefault(require("../../server/src/routes/whatsapp.routes"));
const social_routes_1 = __importDefault(require("../../server/src/routes/social.routes"));
const video_routes_1 = __importDefault(require("../../server/src/routes/video.routes"));
const public_routes_1 = __importDefault(require("../../server/src/routes/public.routes"));
const wemas_routes_1 = __importDefault(require("../../server/src/routes/wemas.routes"));
const commerce_routes_1 = __importDefault(require("../../server/src/routes/commerce.routes"));
const subscription_routes_1 = __importDefault(require("../../server/src/routes/subscription.routes"));
const marketplace_routes_1 = __importDefault(require("../../server/src/routes/marketplace.routes"));
const superadmin_routes_1 = __importDefault(require("../../server/src/routes/superadmin.routes"));
const creator_routes_1 = __importDefault(require("../../server/src/routes/creator.routes"));
const team_routes_1 = __importDefault(require("../../server/src/routes/team.routes"));
const website_routes_1 = __importDefault(require("../../server/src/routes/website.routes"));
const me_routes_1 = __importDefault(require("../../server/src/routes/me.routes"));
const users_routes_1 = __importDefault(require("../../server/src/routes/users.routes"));
const notification_routes_1 = __importDefault(require("../../server/src/routes/notification.routes"));
const referral_routes_1 = __importDefault(require("../../server/src/routes/referral.routes"));
const gmail_routes_1 = __importDefault(require("../../server/src/routes/gmail.routes"));
const legal_routes_1 = __importDefault(require("../../server/src/routes/legal.routes"));
const products_routes_1 = __importDefault(require("../../server/src/routes/products.routes"));
const orders_routes_1 = __importDefault(require("../../server/src/routes/orders.routes"));
const reservations_routes_1 = __importDefault(require("../../server/src/routes/reservations.routes"));
const appointments_routes_1 = __importDefault(require("../../server/src/routes/appointments.routes"));
const publicCommerce_routes_1 = __importDefault(require("../../server/src/routes/publicCommerce.routes"));
const quoteRequests_routes_1 = __importDefault(require("../../server/src/routes/quoteRequests.routes"));
const myStatus_routes_1 = __importDefault(require("../../server/src/routes/myStatus.routes"));
const betaFeedback_routes_1 = __importDefault(require("../../server/src/routes/betaFeedback.routes"));
const dataDeletion_routes_1 = __importDefault(require("../../server/src/routes/dataDeletion.routes"));
const ai_routes_1 = __importDefault(require("../../server/src/routes/ai.routes"));
const news_routes_1 = __importDefault(require("../../server/src/routes/news.routes"));
const clone_routes_1 = __importDefault(require("../../server/src/routes/clone.routes"));
const cloneAnalytics_routes_1 = __importDefault(require("../../server/src/routes/cloneAnalytics.routes"));
const datascientist_routes_1 = __importDefault(require("../../server/src/routes/datascientist.routes"));
const messaging_routes_1 = __importDefault(require("../../server/src/routes/messaging.routes"));
const telegram_routes_1 = __importDefault(require("../../server/src/routes/telegram.routes"));
const socialAi_routes_1 = __importDefault(require("../../server/src/routes/socialAi.routes"));
// Genkit flows
require("../../server/src/genkit");
// Initialize Firebase
(0, firebase_config_1.initFirebase)();
(0, mcp_config_1.checkMcpAvailability)().catch(() => { });
const app = (0, express_1.default)();
// Cloud Run sits behind Google's front-end proxy. Tell Express to trust the
// X-Forwarded-For header so req.ip resolves to the real client (not Cloud Run).
// Without this, the rate limiter sees a single IP for every request → 429 storms.
app.set('trust proxy', true);
// Security
app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// CORS — allow Firebase Hosting domain + custom domains
app.use((0, cors_1.default)({
    origin: [
        'https://orlode.com',
        'https://mon-assistant-86bbd.firebaseapp.com',
        'https://corpmind.ai',
        'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Body parsers — rawBody preserved for WhatsApp webhook signature
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting + audit
app.use('/api', rateLimit_middleware_1.apiRateLimiter);
app.use('/api', auditLog_middleware_1.auditLogMiddleware);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', environment: 'firebase-functions', timestamp: new Date().toISOString(), version: '2.0.0' });
});
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.use('/api/data', data_routes_1.default);
app.use('/api/meetings', meeting_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/faces', faces_routes_1.default);
app.use('/api/agent', agent_routes_1.default);
app.use('/api/gdpr', gdpr_routes_1.default);
app.use('/api/billing', billing_routes_1.default);
app.use('/api/apikeys', apiKey_routes_1.default);
app.use('/api/onboarding', onboarding_routes_1.default);
app.use('/api/setup', setup_routes_1.default);
app.use('/api/connectors', connectors_routes_1.default);
app.use('/api/emails', emails_routes_1.default);
app.use('/api/reception', reception_routes_1.default);
app.use('/api/agents', agents_routes_1.default);
app.use('/api/support', support_routes_1.default);
app.use('/api/finance', finance_routes_1.default);
app.use('/api/marketing', marketing_routes_1.default);
app.use('/api/it', it_routes_1.default);
app.use('/api/sales', sales_routes_1.default);
app.use('/api/hr', hr_routes_1.default);
app.use('/api/security', security_routes_1.default);
app.use('/api/training', training_routes_1.default);
app.use('/api/company', company_routes_1.default);
app.use('/api/public', public_routes_1.default);
app.use('/api/contracts', wemas_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/social', social_routes_1.default);
app.use('/api/video', video_routes_1.default);
app.use('/api/commerce', commerce_routes_1.default);
app.use('/api/subscription', subscription_routes_1.default);
app.use('/api/marketplace', marketplace_routes_1.default);
app.use('/api/superadmin', superadmin_routes_1.default);
app.use('/api/creator', creator_routes_1.default);
app.use('/api/team', team_routes_1.default);
app.use('/api/website', website_routes_1.default);
app.use('/api/me', me_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/referral', referral_routes_1.default);
app.use('/api/gmail', gmail_routes_1.default);
app.use('/api/legal', legal_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/orders', orders_routes_1.default);
app.use('/api/reservations', reservations_routes_1.default);
app.use('/api/appointments', appointments_routes_1.default);
app.use('/api/publicCommerce', publicCommerce_routes_1.default);
app.use('/api/quote-requests', quoteRequests_routes_1.default);
app.use('/api/my-status', myStatus_routes_1.default);
app.use('/api/beta-feedback', betaFeedback_routes_1.default);
app.use('/api/data-deletion', dataDeletion_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/news', news_routes_1.default);
app.use('/api/clone', clone_routes_1.default);
app.use('/api/clone-analytics', cloneAnalytics_routes_1.default);
app.use('/api/datascientist', datascientist_routes_1.default);
app.use('/api/messaging', messaging_routes_1.default);
app.use('/api/telegram', telegram_routes_1.default);
app.use('/api/social-ai', socialAi_routes_1.default);
app.use(error_middleware_1.notFoundMiddleware);
app.use(error_middleware_1.errorMiddleware);
// Export as Firebase Cloud Function (2nd gen) — public access
exports.api = (0, https_1.onRequest)({
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
    concurrency: 80,
    minInstances: 0,
    invoker: 'public',
}, app);
logger.info('Orlode API function initialized');
//# sourceMappingURL=index.js.map