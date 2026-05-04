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
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_config_1 = require("./config/env.config");
const logger_1 = require("./utils/logger");
const contractReminderService_1 = require("./services/wemas/contractReminderService");
const notificationService_1 = require("./services/notificationService");
const PORT = env_config_1.env.PORT;
app_1.httpServer.listen(PORT, () => {
    logger_1.logger.info(`Orlode API server running on port ${PORT} [${env_config_1.env.NODE_ENV}]`);
    logger_1.logger.info(`Health: http://localhost:${PORT}/health`);
    (0, contractReminderService_1.startContractReminders)();
    // Appointment reminders — check every 30 minutes
    setInterval(() => {
        (0, notificationService_1.checkAppointmentReminders)().catch(err => logger_1.logger.error('[Reminders] Failed', { error: err }));
    }, 30 * 60 * 1000);
    // Run once on startup after 10s
    setTimeout(() => (0, notificationService_1.checkAppointmentReminders)().catch(() => { }), 10000);
    // ── Eager-load heavy modules so the FIRST user message doesn't pay the
    // import cost (Genkit + 30+ agent tools = ~3-4s on a cold start). Doing
    // this 2s after listen lets the server become healthy first.
    setTimeout(() => {
        Promise.all([
            Promise.resolve().then(() => __importStar(require('./agents/orchestrator.agent'))).then(() => logger_1.logger.info('[Warmup] orchestrator.agent loaded')),
            Promise.resolve().then(() => __importStar(require('./services/teamAgentResponder'))).then(() => logger_1.logger.info('[Warmup] teamAgentResponder loaded')),
            Promise.resolve().then(() => __importStar(require('./services/whatsapp/whatsappService'))).then(() => logger_1.logger.info('[Warmup] whatsappService loaded')),
            Promise.resolve().then(() => __importStar(require('./services/telegram/telegramService'))).then(() => logger_1.logger.info('[Warmup] telegramService loaded')),
        ]).catch(err => logger_1.logger.warn('[Warmup] some modules failed to preload', { error: err }));
    }, 2000);
    // ── Backfill the platform-wide WhatsApp business-numbers index so the
    // bot-to-bot loop guard recognizes already-connected numbers (without
    // requiring users to reconnect). Idempotent: safe on every boot.
    setTimeout(async () => {
        try {
            const { getFirestore } = await Promise.resolve().then(() => __importStar(require('./config/firebase.config')));
            const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
            const db = getFirestore();
            const companiesSnap = await db.collection('companies').limit(500).get();
            let registered = 0;
            for (const company of companiesSnap.docs) {
                const waDoc = await db.collection(`companies/${company.id}/integrations`).doc('whatsapp').get().catch(() => null);
                if (!waDoc?.exists)
                    continue;
                const data = waDoc.data() ?? {};
                const phoneNumberId = data['phoneNumberId'];
                const accessTokenEnc = data['accessToken'];
                if (!phoneNumberId || !accessTokenEnc)
                    continue;
                // Decrypt the token via the service to call Meta and get displayPhone.
                // We tolerate failure — if Meta call fails, we skip this entry.
                const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./services/whatsapp/whatsappService')));
                const cfg = await whatsappService.getConfig(company.id).catch(() => null);
                if (!cfg)
                    continue;
                try {
                    const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}?fields=display_phone_number`, {
                        headers: { Authorization: `Bearer ${cfg.accessToken}` },
                    });
                    const j = await r.json();
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
                }
                catch { /* skip on Meta error */ }
            }
            logger_1.logger.info(`[Backfill] Platform business numbers registered: ${registered}`);
        }
        catch (err) {
            logger_1.logger.warn('[Backfill] platform business numbers failed', { error: err instanceof Error ? err.message : err });
        }
    }, 4000);
});
// Graceful shutdown
const shutdown = (signal) => {
    logger_1.logger.info(`Received ${signal}. Shutting down gracefully...`);
    (0, contractReminderService_1.stopContractReminders)();
    app_1.httpServer.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => {
        logger_1.logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled Promise Rejection', { reason });
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception', { error });
    process.exit(1);
});
//# sourceMappingURL=index.js.map