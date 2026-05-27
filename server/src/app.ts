import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env.config';
import { initFirebase } from './config/firebase.config';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { auditLogMiddleware } from './middleware/auditLog.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import dataRoutes from './routes/data.routes';
import meetingRoutes from './routes/meeting.routes';
import analyticsRoutes from './routes/analytics.routes';
import facesRoutes from './routes/faces.routes';
import agentRoutes from './routes/agent.routes';
import gdprRoutes from './routes/gdpr.routes';
import billingRoutes from './routes/billing.routes';
import apiKeyRoutes from './routes/apiKey.routes';
import onboardingRoutes from './routes/onboarding.routes';
import setupRoutes from './routes/setup.routes';
import connectorsRoutes from './routes/connectors.routes';
import emailsRoutes from './routes/emails.routes';
import receptionRoutes from './routes/reception.routes';
import agentsRoutes from './routes/agents.routes';
import supportRoutes from './routes/support.routes';
import financeRoutes from './routes/finance.routes';
import marketingRoutes from './routes/marketing.routes';
import itRoutes from './routes/it.routes';
import salesRoutes from './routes/sales.routes';
import hrRoutes from './routes/hr.routes';
import securityRoutes from './routes/security.routes';
import trainingRoutes from './routes/training.routes';
import companyRoutes from './routes/company.routes';
import usersRoutes from './routes/users.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import betaFeedbackRoutes from './routes/betaFeedback.routes';
import socialRoutes from './routes/social.routes';
import socialAiRoutes from './routes/socialAi.routes';
import contractsRoutes from './routes/contracts.routes';
import videoRoutes from './routes/video.routes';
import publicRoutes from './routes/public.routes';
import wemasRoutes, { publicContractRouter } from './routes/wemas.routes';
import subscriptionRoutes from './routes/subscription.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import teamRoutes from './routes/team.routes';
import referralRoutes from './routes/referral.routes';
import websiteRoutes from './routes/website.routes';
import commerceRoutes from './routes/commerce.routes';
import publicCommerceRoutes from './routes/publicCommerce.routes';
import creatorRoutes from './routes/creator.routes';
import superadminRoutes from './routes/superadmin.routes';
import meRoutes from './routes/me.routes';
import notificationRoutes from './routes/notification.routes';
import legalRoutes from './routes/legal.routes';
import gmailRoutes from './routes/gmail.routes';
import aiRoutes from './routes/ai.routes';
import telegramRoutes from './routes/telegram.routes';
import ccaiRoutes from './routes/ccai.routes';
import appointmentsRoutes from './routes/appointments.routes';
import reservationsRoutes from './routes/reservations.routes';
import quoteRequestsRoutes from './routes/quoteRequests.routes';
import productsRoutes from './routes/products.routes';
import ordersRoutes from './routes/orders.routes';
import cloneAnalyticsRoutes from './routes/cloneAnalytics.routes';
import myStatusRoutes from './routes/myStatus.routes';
import talentsRoutes from './routes/talents.routes';
import influencersRoutes from './routes/influencers.routes';
import manifestRoutes from './routes/manifest.routes';
import azureRoutes from './routes/azure.routes';
import msOauthRoutes from './routes/msOauth.routes';
import dataScientistRoutes from './routes/datascientist.routes';
import koraRoutes from './routes/kora.routes';

// Genkit flows — import to register all flows with the Genkit runtime
import './genkit';

// MCP availability check
import { checkMcpAvailability } from './config/mcp.config';

// Initialize Firebase
initFirebase();

// Check MCP server availability (non-blocking — agents degrade gracefully if offline)
checkMcpAvailability().catch(() => {});

const app = express();
app.set('trust proxy', 1); // Cloud Run / Firebase Hosting proxy
const httpServer = createServer(app);

// Socket.io for real-time features
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);

  socket.on('join-company', (companyId: string) => {
    socket.join(`company:${companyId}`);
    logger.debug(`Socket ${socket.id} joined company: ${companyId}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// Security
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for SSE compatibility
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — CORS_ORIGIN can be a comma-separated list of origins
const ALLOWED_ORIGINS = [
  ...env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
  'https://orlode.com',
  'https://www.orlode.com',
  'https://mon-assistant-86bbd.web.app',
  'https://mon-assistant-86bbd.firebaseapp.com',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin (mobile, Postman, curl)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers — rawBody preserved for webhook signature verification
app.use(express.json({
  limit: '10mb',
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiter
app.use('/api', apiRateLimiter);

// Audit logging (fires after response, non-blocking)
app.use('/api', auditLogMiddleware as never);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/faces', facesRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/apikeys', apiKeyRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/connectors', connectorsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/ccai', ccaiRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/quote-requests', quoteRequestsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/clone-analytics', cloneAnalyticsRoutes);
app.use('/api/my-status', myStatusRoutes);
app.use('/api/talents', talentsRoutes);
app.use('/api/influencers', influencersRoutes);
app.use('/api/manifest', manifestRoutes);
app.use('/api/azure', azureRoutes);
app.use('/api/ms-oauth', msOauthRoutes);
app.use('/api/datascientist', dataScientistRoutes);
app.use('/api/kora', koraRoutes);
app.use('/api/reception', receptionRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/it', itRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/users', usersRoutes);
import messagingRoutes from './routes/messaging.routes';
import newsRoutes from './routes/news.routes';
app.use('/api/messaging', messagingRoutes);
app.use('/api/news', newsRoutes);

import cloneRoutes from './routes/clone.routes';
app.use('/api/clone', cloneRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/public', publicContractRouter);
app.use('/api/public', publicCommerceRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/commerce', commerceRoutes);

// Public visitor booking (no auth)
import { publicBookingHandler } from './routes/reception.routes';
app.post('/api/public/book/:companyId', publicBookingHandler);
app.use('/api/contracts', wemasRoutes);  // legacy direct-Firestore (used by ContractDashboard / PortfolioNotes / templates / comments)
app.use('/api/legal', legalRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/beta-feedback', betaFeedbackRoutes);
import dataDeletionRoutes from './routes/dataDeletion.routes';
app.use('/api', dataDeletionRoutes);
app.use('/api/social/ai', socialAiRoutes);
app.use('/api/social', socialRoutes);
// Wemas bridge mounted at /api/wemas to avoid path collision with the legacy
// /api/contracts router above (which still serves ContractDashboard etc.).
// New e-signature features (HR/Sales sendForSignature, ContractsPage admin) all
// hit /api/wemas/*. Legacy callers continue to work as before.
app.use('/api/wemas', contractsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/me', meRoutes);

// 404 handler
app.use(notFoundMiddleware);

// Global error handler (must be last)
app.use(errorMiddleware);

export { app, httpServer };
