"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startContractReminders = startContractReminders;
exports.stopContractReminders = stopContractReminders;
exports.runContractReminders = processReminders;
/**
 * Contract Reminder Service — Auto-relance des contrats non signes
 * Envoie un email de rappel aux signataires qui n'ont pas signe apres X jours.
 * Se lance via un cron interval (configurable).
 */
const firebase_config_1 = require("../../config/firebase.config");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
const REMINDER_AFTER_DAYS = 3; // Relancer apres 3 jours
const SECOND_REMINDER_DAYS = 7; // 2eme relance apres 7 jours
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Toutes les 6h
async function sendReminderEmail(contract, companyName) {
    if (!env_config_1.env.RESEND_API_KEY)
        return false;
    const link = `${env_config_1.env.CORS_ORIGIN}/sign/${contract.uniqueLink}`;
    const subject = `Rappel : Votre contrat attend votre signature — ${companyName}`;
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:16px 16px 0 0;padding:40px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Rappel de signature</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${companyName}</p>
</td></tr>
<tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Bonjour <strong>${contract.signatoryName}</strong>,</p>
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">Un contrat est en attente de votre signature depuis plusieurs jours. Cliquez ci-dessous pour le consulter et le signer.</p>
<div style="text-align:center;margin:32px 0;">
<a href="${link}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">Signer mon contrat</a>
</div>
${contract.expiresAt ? `<p style="color:#9ca3af;font-size:12px;text-align:center;">Ce lien expire le ${new Date(contract.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>` : ''}
<p style="color:#d1d5db;font-size:11px;text-align:center;margin-top:20px;">${companyName} — Rappel automatique</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env_config_1.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: env_config_1.env.RESEND_FROM || 'Orlode AI <noreply@music.zinakonect.com>',
                to: [contract.signatoryEmail],
                subject,
                html,
            }),
        });
        return res.ok;
    }
    catch (err) {
        logger_1.logger.error('[Reminder] Email failed', { error: err, email: contract.signatoryEmail });
        return false;
    }
}
async function processReminders() {
    logger_1.logger.info('[Reminder] Checking pending contracts...');
    const db = (0, firebase_config_1.getFirestore)();
    try {
        // Get all companies
        const companiesSnap = await db.collection('companies').get();
        let totalChecked = 0;
        let totalSent = 0;
        for (const companyDoc of companiesSnap.docs) {
            const companyId = companyDoc.id;
            const companyName = companyDoc.data()?.name ?? 'Orlode';
            // Get pending contracts for this company
            const contractsSnap = await db.collection(`companies/${companyId}/contracts`)
                .where('status', '==', 'pending_signature')
                .get();
            for (const contractDoc of contractsSnap.docs) {
                const data = contractDoc.data();
                totalChecked++;
                // Skip if expired
                if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
                    await contractDoc.ref.update({ status: 'expired', updatedAt: new Date().toISOString() });
                    continue;
                }
                const createdAt = new Date(data.createdAt);
                const daysSinceCreation = (Date.now() - createdAt.getTime()) / 86400000;
                const remindersSent = data.remindersSent ?? 0;
                const lastReminderAt = data.lastReminderAt ? new Date(data.lastReminderAt) : null;
                const daysSinceLastReminder = lastReminderAt ? (Date.now() - lastReminderAt.getTime()) / 86400000 : Infinity;
                let shouldRemind = false;
                // First reminder after 3 days
                if (remindersSent === 0 && daysSinceCreation >= REMINDER_AFTER_DAYS) {
                    shouldRemind = true;
                }
                // Second reminder after 7 days (and at least 3 days since last reminder)
                else if (remindersSent === 1 && daysSinceCreation >= SECOND_REMINDER_DAYS && daysSinceLastReminder >= 3) {
                    shouldRemind = true;
                }
                // Max 2 reminders
                if (remindersSent >= 2)
                    shouldRemind = false;
                if (shouldRemind) {
                    const contract = {
                        id: contractDoc.id,
                        companyId,
                        signatoryName: data.signatoryName,
                        signatoryEmail: data.signatoryEmail,
                        uniqueLink: data.uniqueLink,
                        createdAt: data.createdAt,
                        expiresAt: data.expiresAt,
                        remindersSent,
                    };
                    const sent = await sendReminderEmail(contract, companyName);
                    if (sent) {
                        await contractDoc.ref.update({
                            remindersSent: remindersSent + 1,
                            lastReminderAt: new Date().toISOString(),
                        });
                        totalSent++;
                        logger_1.logger.info('[Reminder] Sent', { contractId: contract.id, email: contract.signatoryEmail, reminderNumber: remindersSent + 1 });
                    }
                }
            }
        }
        logger_1.logger.info('[Reminder] Done', { totalChecked, totalSent });
    }
    catch (err) {
        logger_1.logger.error('[Reminder] Error during processing', { error: err });
    }
}
let reminderInterval = null;
function startContractReminders() {
    if (reminderInterval)
        return;
    // Run immediately on start
    setTimeout(() => processReminders(), 30000); // 30s after server start
    // Then every 6 hours
    reminderInterval = setInterval(processReminders, CHECK_INTERVAL_MS);
    logger_1.logger.info(`[Reminder] Started — checking every ${CHECK_INTERVAL_MS / 3600000}h`);
}
function stopContractReminders() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
        logger_1.logger.info('[Reminder] Stopped');
    }
}
//# sourceMappingURL=contractReminderService.js.map