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
exports.httpServer = exports.app = exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const env_config_1 = require("./config/env.config");
const firebase_config_1 = require("./config/firebase.config");
const rateLimit_middleware_1 = require("./middleware/rateLimit.middleware");
const auditLog_middleware_1 = require("./middleware/auditLog.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const logger_1 = require("./utils/logger");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const data_routes_1 = __importDefault(require("./routes/data.routes"));
const meeting_routes_1 = __importDefault(require("./routes/meeting.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const faces_routes_1 = __importDefault(require("./routes/faces.routes"));
const agent_routes_1 = __importDefault(require("./routes/agent.routes"));
const gdpr_routes_1 = __importDefault(require("./routes/gdpr.routes"));
const billing_routes_1 = __importDefault(require("./routes/billing.routes"));
const apiKey_routes_1 = __importDefault(require("./routes/apiKey.routes"));
const onboarding_routes_1 = __importDefault(require("./routes/onboarding.routes"));
const setup_routes_1 = __importDefault(require("./routes/setup.routes"));
const connectors_routes_1 = __importDefault(require("./routes/connectors.routes"));
const emails_routes_1 = __importDefault(require("./routes/emails.routes"));
const reception_routes_1 = __importDefault(require("./routes/reception.routes"));
const agents_routes_1 = __importDefault(require("./routes/agents.routes"));
const support_routes_1 = __importDefault(require("./routes/support.routes"));
const finance_routes_1 = __importDefault(require("./routes/finance.routes"));
const marketing_routes_1 = __importDefault(require("./routes/marketing.routes"));
const it_routes_1 = __importDefault(require("./routes/it.routes"));
const sales_routes_1 = __importDefault(require("./routes/sales.routes"));
const hr_routes_1 = __importDefault(require("./routes/hr.routes"));
const security_routes_1 = __importDefault(require("./routes/security.routes"));
const training_routes_1 = __importDefault(require("./routes/training.routes"));
const company_routes_1 = __importDefault(require("./routes/company.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
const betaFeedback_routes_1 = __importDefault(require("./routes/betaFeedback.routes"));
const social_routes_1 = __importDefault(require("./routes/social.routes"));
const socialAi_routes_1 = __importDefault(require("./routes/socialAi.routes"));
const contracts_routes_1 = __importDefault(require("./routes/contracts.routes"));
const video_routes_1 = __importDefault(require("./routes/video.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const wemas_routes_1 = __importStar(require("./routes/wemas.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const marketplace_routes_1 = __importDefault(require("./routes/marketplace.routes"));
const team_routes_1 = __importDefault(require("./routes/team.routes"));
const referral_routes_1 = __importDefault(require("./routes/referral.routes"));
const website_routes_1 = __importDefault(require("./routes/website.routes"));
const commerce_routes_1 = __importDefault(require("./routes/commerce.routes"));
const publicCommerce_routes_1 = __importDefault(require("./routes/publicCommerce.routes"));
const creator_routes_1 = __importDefault(require("./routes/creator.routes"));
const superadmin_routes_1 = __importDefault(require("./routes/superadmin.routes"));
const me_routes_1 = __importDefault(require("./routes/me.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const legal_routes_1 = __importDefault(require("./routes/legal.routes"));
const gmail_routes_1 = __importDefault(require("./routes/gmail.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const telegram_routes_1 = __importDefault(require("./routes/telegram.routes"));
const ccai_routes_1 = __importDefault(require("./routes/ccai.routes"));
const appointments_routes_1 = __importDefault(require("./routes/appointments.routes"));
const reservations_routes_1 = __importDefault(require("./routes/reservations.routes"));
const quoteRequests_routes_1 = __importDefault(require("./routes/quoteRequests.routes"));
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const orders_routes_1 = __importDefault(require("./routes/orders.routes"));
const cloneAnalytics_routes_1 = __importDefault(require("./routes/cloneAnalytics.routes"));
const myStatus_routes_1 = __importDefault(require("./routes/myStatus.routes"));
const talents_routes_1 = __importDefault(require("./routes/talents.routes"));
const influencers_routes_1 = __importDefault(require("./routes/influencers.routes"));
const manifest_routes_1 = __importDefault(require("./routes/manifest.routes"));
const business_routes_1 = __importDefault(require("./routes/business.routes"));
const landing_routes_1 = __importDefault(require("./routes/landing.routes"));
const azure_routes_1 = __importDefault(require("./routes/azure.routes"));
const msOauth_routes_1 = __importDefault(require("./routes/msOauth.routes"));
const datascientist_routes_1 = __importDefault(require("./routes/datascientist.routes"));
const kora_routes_1 = __importDefault(require("./routes/kora.routes"));
// Genkit flows — import to register all flows with the Genkit runtime
require("./genkit");
// MCP availability check
const mcp_config_1 = require("./config/mcp.config");
// Initialize Firebase
(0, firebase_config_1.initFirebase)();
// Check MCP server availability (non-blocking — agents degrade gracefully if offline)
(0, mcp_config_1.checkMcpAvailability)().catch(() => { });
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', 1); // Cloud Run / Firebase Hosting proxy
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Socket.io for real-time features
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: env_config_1.env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io.on('connection', (socket) => {
    logger_1.logger.debug(`Socket connected: ${socket.id}`);
    socket.on('join-company', (companyId) => {
        socket.join(`company:${companyId}`);
        logger_1.logger.debug(`Socket ${socket.id} joined company: ${companyId}`);
    });
    socket.on('disconnect', () => {
        logger_1.logger.debug(`Socket disconnected: ${socket.id}`);
    });
});
// Security
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disabled for SSE compatibility
    crossOriginEmbedderPolicy: false,
}));
// CORS — CORS_ORIGIN can be a comma-separated list of origins
const ALLOWED_ORIGINS = [
    ...env_config_1.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
    'https://orlode.com',
    'https://www.orlode.com',
    'https://mon-assistant-86bbd.web.app',
    'https://mon-assistant-86bbd.firebaseapp.com',
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Autoriser les requêtes sans origin (mobile, Postman, curl)
        if (!origin)
            return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Body parsers — rawBody preserved for webhook signature verification
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Global rate limiter
app.use('/api', rateLimit_middleware_1.apiRateLimiter);
// Audit logging (fires after response, non-blocking)
app.use('/api', auditLog_middleware_1.auditLogMiddleware);
// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        environment: env_config_1.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        version: '2.0.0',
    });
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
app.use('/api/gmail', gmail_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/telegram', telegram_routes_1.default);
app.use('/api/ccai', ccai_routes_1.default);
app.use('/api/appointments', appointments_routes_1.default);
app.use('/api/reservations', reservations_routes_1.default);
app.use('/api/quote-requests', quoteRequests_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/orders', orders_routes_1.default);
app.use('/api/clone-analytics', cloneAnalytics_routes_1.default);
app.use('/api/my-status', myStatus_routes_1.default);
app.use('/api/talents', talents_routes_1.default);
app.use('/api/influencers', influencers_routes_1.default);
app.use('/api/manifest', manifest_routes_1.default);
app.use('/api/business', business_routes_1.default);
app.use('/api/landing', landing_routes_1.default);
app.use('/api/azure', azure_routes_1.default);
app.use('/api/ms-oauth', msOauth_routes_1.default);
app.use('/api/datascientist', datascientist_routes_1.default);
app.use('/api/kora', kora_routes_1.default);
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
app.use('/api/users', users_routes_1.default);
const messaging_routes_1 = __importDefault(require("./routes/messaging.routes"));
const news_routes_1 = __importDefault(require("./routes/news.routes"));
app.use('/api/messaging', messaging_routes_1.default);
app.use('/api/news', news_routes_1.default);
const clone_routes_1 = __importDefault(require("./routes/clone.routes"));
app.use('/api/clone', clone_routes_1.default);
app.use('/api/public', public_routes_1.default);
app.use('/api/public', wemas_routes_1.publicContractRouter);
app.use('/api/public', publicCommerce_routes_1.default);
app.use('/api/team', team_routes_1.default);
app.use('/api/referral', referral_routes_1.default);
app.use('/api/website', website_routes_1.default);
app.use('/api/commerce', commerce_routes_1.default);
// Public visitor booking (no auth)
const reception_routes_2 = require("./routes/reception.routes");
app.post('/api/public/book/:companyId', reception_routes_2.publicBookingHandler);
app.use('/api/contracts', wemas_routes_1.default); // legacy direct-Firestore (used by ContractDashboard / PortfolioNotes / templates / comments)
app.use('/api/legal', legal_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/beta-feedback', betaFeedback_routes_1.default);
const dataDeletion_routes_1 = __importDefault(require("./routes/dataDeletion.routes"));
app.use('/api', dataDeletion_routes_1.default);
app.use('/api/social/ai', socialAi_routes_1.default);
app.use('/api/social', social_routes_1.default);
// Wemas bridge mounted at /api/wemas to avoid path collision with the legacy
// /api/contracts router above (which still serves ContractDashboard etc.).
// New e-signature features (HR/Sales sendForSignature, ContractsPage admin) all
// hit /api/wemas/*. Legacy callers continue to work as before.
app.use('/api/wemas', contracts_routes_1.default);
app.use('/api/video', video_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/subscription', subscription_routes_1.default);
app.use('/api/marketplace', marketplace_routes_1.default);
app.use('/api/creator', creator_routes_1.default);
app.use('/api/superadmin', superadmin_routes_1.default);
app.use('/api/me', me_routes_1.default);
// 404 handler
app.use(error_middleware_1.notFoundMiddleware);
// Global error handler (must be last)
app.use(error_middleware_1.errorMiddleware);
//# sourceMappingURL=app.js.map