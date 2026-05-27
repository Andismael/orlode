/**
 * Orlode AI — Firebase Cloud Functions entry point
 * Wraps the Express server as a 2nd-gen Cloud Function.
 * Socket.io is disabled in this context (Cloud Functions don't support WebSockets).
 */
import './env-setup'; // MUST be first — loads .env before any server module

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Config
import { initFirebase } from '../../server/src/config/firebase.config';
import { checkMcpAvailability } from '../../server/src/config/mcp.config';
import { apiRateLimiter } from '../../server/src/middleware/rateLimit.middleware';
import { auditLogMiddleware } from '../../server/src/middleware/auditLog.middleware';
import { errorMiddleware, notFoundMiddleware } from '../../server/src/middleware/error.middleware';

// Routes
import authRoutes from '../../server/src/routes/auth.routes';
import chatRoutes from '../../server/src/routes/chat.routes';
import dataRoutes from '../../server/src/routes/data.routes';
import meetingRoutes from '../../server/src/routes/meeting.routes';
import analyticsRoutes from '../../server/src/routes/analytics.routes';
import facesRoutes from '../../server/src/routes/faces.routes';
import agentRoutes from '../../server/src/routes/agent.routes';
import gdprRoutes from '../../server/src/routes/gdpr.routes';
import billingRoutes from '../../server/src/routes/billing.routes';
import apiKeyRoutes from '../../server/src/routes/apiKey.routes';
import onboardingRoutes from '../../server/src/routes/onboarding.routes';
import setupRoutes from '../../server/src/routes/setup.routes';
import connectorsRoutes from '../../server/src/routes/connectors.routes';
import emailsRoutes from '../../server/src/routes/emails.routes';
import receptionRoutes from '../../server/src/routes/reception.routes';
import agentsRoutes from '../../server/src/routes/agents.routes';
import supportRoutes from '../../server/src/routes/support.routes';
import financeRoutes from '../../server/src/routes/finance.routes';
import marketingRoutes from '../../server/src/routes/marketing.routes';
import itRoutes from '../../server/src/routes/it.routes';
import salesRoutes from '../../server/src/routes/sales.routes';
import hrRoutes from '../../server/src/routes/hr.routes';
import securityRoutes from '../../server/src/routes/security.routes';
import trainingRoutes from '../../server/src/routes/training.routes';
import companyRoutes from '../../server/src/routes/company.routes';
import whatsappRoutes from '../../server/src/routes/whatsapp.routes';
import socialRoutes from '../../server/src/routes/social.routes';
import videoRoutes from '../../server/src/routes/video.routes';
import publicRoutes from '../../server/src/routes/public.routes';
import wemasRoutes from '../../server/src/routes/wemas.routes';
import commerceRoutes from '../../server/src/routes/commerce.routes';
import subscriptionRoutes from '../../server/src/routes/subscription.routes';
import marketplaceRoutes from '../../server/src/routes/marketplace.routes';
import superadminRoutes from '../../server/src/routes/superadmin.routes';
import creatorRoutes from '../../server/src/routes/creator.routes';
import teamRoutes from '../../server/src/routes/team.routes';
import websiteRoutes from '../../server/src/routes/website.routes';
import meRoutes from '../../server/src/routes/me.routes';
import usersRoutes from '../../server/src/routes/users.routes';
import notificationRoutes from '../../server/src/routes/notification.routes';
import referralRoutes from '../../server/src/routes/referral.routes';
import gmailRoutes from '../../server/src/routes/gmail.routes';
import legalRoutes from '../../server/src/routes/legal.routes';
import productsRoutes from '../../server/src/routes/products.routes';
import ordersRoutes from '../../server/src/routes/orders.routes';
import reservationsRoutes from '../../server/src/routes/reservations.routes';
import appointmentsRoutes from '../../server/src/routes/appointments.routes';
import publicCommerceRoutes from '../../server/src/routes/publicCommerce.routes';
import quoteRequestsRoutes from '../../server/src/routes/quoteRequests.routes';
import myStatusRoutes from '../../server/src/routes/myStatus.routes';
import betaFeedbackRoutes from '../../server/src/routes/betaFeedback.routes';
import dataDeletionRoutes from '../../server/src/routes/dataDeletion.routes';
import aiRoutes from '../../server/src/routes/ai.routes';
import newsRoutes from '../../server/src/routes/news.routes';
import cloneRoutes from '../../server/src/routes/clone.routes';
import cloneAnalyticsRoutes from '../../server/src/routes/cloneAnalytics.routes';
import datascientistRoutes from '../../server/src/routes/datascientist.routes';
import messagingRoutes from '../../server/src/routes/messaging.routes';
import telegramRoutes from '../../server/src/routes/telegram.routes';
import socialAiRoutes from '../../server/src/routes/socialAi.routes';
import talentsRoutes from '../../server/src/routes/talents.routes';
import influencersRoutes from '../../server/src/routes/influencers.routes';
import manifestRoutes from '../../server/src/routes/manifest.routes';
import businessRoutes from '../../server/src/routes/business.routes';

// Genkit flows
import '../../server/src/genkit';

// Initialize Firebase
initFirebase();
checkMcpAvailability().catch(() => {});

const app = express();

// Cloud Run sits behind Google's front-end proxy. Tell Express to trust the
// X-Forwarded-For header so req.ip resolves to the real client (not Cloud Run).
// Without this, the rate limiter sees a single IP for every request → 429 storms.
app.set('trust proxy', true);

// Security
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS — allow Firebase Hosting domain + custom domains
app.use(cors({
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
app.use(express.json({
  limit: '10mb',
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting + audit
app.use('/api', apiRateLimiter);
app.use('/api', auditLogMiddleware as never);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: 'firebase-functions', timestamp: new Date().toISOString(), version: '2.0.0' });
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
app.use('/api/public', publicRoutes);
app.use('/api/contracts', wemasRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/website', websiteRoutes);
app.use('/api/me', meRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/publicCommerce', publicCommerceRoutes);
app.use('/api/quote-requests', quoteRequestsRoutes);
app.use('/api/my-status', myStatusRoutes);
app.use('/api/beta-feedback', betaFeedbackRoutes);
app.use('/api/data-deletion', dataDeletionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/clone', cloneRoutes);
app.use('/api/clone-analytics', cloneAnalyticsRoutes);
app.use('/api/datascientist', datascientistRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/social-ai', socialAiRoutes);
app.use('/api/talents', talentsRoutes);
app.use('/api/influencers', influencersRoutes);
app.use('/api/manifest', manifestRoutes);
app.use('/api/business', businessRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Export as Firebase Cloud Function (2nd gen) — public access
export const api = onRequest(
  {
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
    concurrency: 80,
    minInstances: 0,
    invoker: 'public',
  },
  app as any
);

logger.info('Orlode API function initialized');
