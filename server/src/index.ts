import { httpServer } from './app';
import { env } from './config/env.config';
import { logger } from './utils/logger';
import { startContractReminders, stopContractReminders } from './services/wemas/contractReminderService';
import { checkAppointmentReminders } from './services/notificationService';

const PORT = env.PORT;

httpServer.listen(PORT, () => {
  logger.info(`Orlode API server running on port ${PORT} [${env.NODE_ENV}]`);
  logger.info(`Health: http://localhost:${PORT}/health`);
  startContractReminders();

  // Appointment reminders — check every 30 minutes
  setInterval(() => {
    checkAppointmentReminders().catch(err => logger.error('[Reminders] Failed', { error: err }));
  }, 30 * 60 * 1000);
  // Run once on startup after 10s
  setTimeout(() => checkAppointmentReminders().catch(() => {}), 10000);

  // ── Eager-load heavy modules so the FIRST user message doesn't pay the
  // import cost (Genkit + 30+ agent tools = ~3-4s on a cold start). Doing
  // this 2s after listen lets the server become healthy first.
  setTimeout(() => {
    Promise.all([
      import('./agents/orchestrator.agent').then(() => logger.info('[Warmup] orchestrator.agent loaded')),
      import('./services/teamAgentResponder').then(() => logger.info('[Warmup] teamAgentResponder loaded')),
      import('./services/whatsapp/whatsappService').then(() => logger.info('[Warmup] whatsappService loaded')),
      import('./services/telegram/telegramService').then(() => logger.info('[Warmup] telegramService loaded')),
    ]).catch(err => logger.warn('[Warmup] some modules failed to preload', { error: err }));
  }, 2000);

  // ── Backfill the platform-wide WhatsApp business-numbers index so the
  // bot-to-bot loop guard recognizes already-connected numbers (without
  // requiring users to reconnect). Idempotent: safe on every boot.
  setTimeout(async () => {
    try {
      const { getFirestore } = await import('./config/firebase.config');
      const { FieldValue } = await import('firebase-admin/firestore');
      const db = getFirestore();
      const companiesSnap = await db.collection('companies').limit(500).get();
      let registered = 0;
      for (const company of companiesSnap.docs) {
        const waDoc = await db.collection(`companies/${company.id}/integrations`).doc('whatsapp').get().catch(() => null);
        if (!waDoc?.exists) continue;
        const data = waDoc.data() ?? {};
        const phoneNumberId = data['phoneNumberId'] as string;
        const accessTokenEnc = data['accessToken'] as string;
        if (!phoneNumberId || !accessTokenEnc) continue;

        // Decrypt the token via the service to call Meta and get displayPhone.
        // We tolerate failure — if Meta call fails, we skip this entry.
        const { whatsappService } = await import('./services/whatsapp/whatsappService');
        const cfg = await whatsappService.getConfig(company.id).catch(() => null);
        if (!cfg) continue;
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}?fields=display_phone_number`, {
            headers: { Authorization: `Bearer ${cfg.accessToken}` },
          });
          const j = await r.json() as { display_phone_number?: string };
          if (j.display_phone_number) {
            const digits = j.display_phone_number.replace(/\D/g, '');
            if (digits) {
              await db.collection('_platformBusinessNumbers').doc(digits).set({
                companyId: company.id,
                phoneNumberId: cfg.phoneNumberId,
                displayPhone: j.display_phone_number,
                registeredAt: FieldValue.serverTimestamp(),
                source: 'backfill',
              }, { merge: true });
              registered++;
            }
          }
        } catch { /* skip on Meta error */ }
      }
      logger.info(`[Backfill] Platform business numbers registered: ${registered}`);
    } catch (err) {
      logger.warn('[Backfill] platform business numbers failed', { error: err instanceof Error ? err.message : err });
    }
  }, 4000);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopContractReminders();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});
