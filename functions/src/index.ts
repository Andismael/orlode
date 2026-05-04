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

// Genkit flows
import '../../server/src/genkit';

// Initialize Firebase
initFirebase();
checkMcpAvailability().catch(() => {});

const app = express();

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
