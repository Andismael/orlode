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
exports.getBranding = getBranding;
exports.sendEmail = sendEmail;
exports.sendInviteEmail = sendInviteEmail;
exports.sendSecurityAlertEmail = sendSecurityAlertEmail;
exports.sendWeeklyReportEmail = sendWeeklyReportEmail;
exports.sendContractEmail = sendContractEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
exports.sendReplyEmail = sendReplyEmail;
/**
 * Email Service — Resend
 * Domain : music.zinakonect.com
 *
 * BRANDING: All emails use the COMPANY's name, logo and slogan — not Orlode.
 * The company data is fetched from Firestore via getBranding(companyId).
 */
const resend_1 = require("resend");
const logger_1 = require("../../utils/logger");
const gmailSendService_1 = require("./gmailSendService");
const firebase_config_1 = require("../../config/firebase.config");
async function logSentEmail(opts) {
    if (!opts.companyId)
        return;
    try {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection('emails').add({
            companyId: opts.companyId,
            folder: 'sent',
            to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
            cc: opts.cc ? (Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc) : '',
            from: opts.from ?? '',
            subject: opts.subject,
            body: opts.body,
            provider: opts.provider,
            externalId: opts.externalId,
            sentAt: new Date().toISOString(),
            read: true,
        });
    }
    catch (err) {
        logger_1.logger.warn('[EmailService] Failed to log sent email to Firestore', { err: String(err) });
    }
}
const resend = new resend_1.Resend(process.env['RESEND_API_KEY']);
const FROM_DEFAULT = process.env['RESEND_FROM'] ?? 'Orlode AI <noreply@music.zinakonect.com>';
const brandingCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 min
/**
 * Get company branding from Firestore (cached 10 min).
 * Falls back to "Orlode AI" if company not found.
 */
async function getBranding(companyId) {
    if (!companyId)
        return { name: 'Orlode AI', website: 'corpmind.ai' };
    const cached = brandingCache.get(companyId);
    if (cached && Date.now() - cached.at < CACHE_TTL)
        return cached.data;
    try {
        const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../../config/firebase.config')));
        const doc = await getFirestore().collection('companies').doc(companyId).get();
        const d = doc.data() ?? {};
        const branding = {
            name: d['name'] || 'Orlode AI',
            logoUrl: d['logoUrl'] || undefined,
            slogan: d['slogan'] || undefined,
            website: d['website'] || undefined,
            email: d['email'] || undefined,
        };
        brandingCache.set(companyId, { data: branding, at: Date.now() });
        return branding;
    }
    catch {
        return { name: 'Orlode AI', website: 'corpmind.ai' };
    }
}
// ── Core send ─────────────────────────────────────────────────────────────────
async function sendEmail(opts) {
    // Try Gmail first if company has a connection
    if (opts.companyId && !opts.forceResend) {
        try {
            const connection = await (0, gmailSendService_1.getGmailConnection)(opts.companyId);
            if (connection) {
                const result = await (0, gmailSendService_1.sendViaGmail)({
                    companyId: opts.companyId,
                    to: opts.to,
                    subject: opts.subject,
                    html: opts.html,
                    cc: opts.cc,
                    bcc: opts.bcc,
                    replyTo: opts.replyTo,
                    sendAsAlias: opts.sendAsAlias,
                    attachments: opts.attachments,
                });
                await logSentEmail({
                    companyId: opts.companyId, to: opts.to, subject: opts.subject, body: opts.html,
                    cc: opts.cc, provider: 'gmail', from: result.from, externalId: result.id,
                });
                return { id: result.id, success: true, provider: 'gmail', from: result.from };
            }
        }
        catch (err) {
            logger_1.logger.warn('[EmailService] Gmail send failed, falling back to Resend', { companyId: opts.companyId, err: String(err) });
        }
    }
    // Resend fallback / system emails
    // If a company is set, brand the "from" with the company name (still uses verified Resend domain)
    let brandedFrom = opts.from ?? FROM_DEFAULT;
    if (!opts.from && opts.companyId) {
        try {
            const branding = await getBranding(opts.companyId);
            // Extract email part from FROM_DEFAULT — keep verified Resend address but rebrand the display name
            const match = FROM_DEFAULT.match(/<([^>]+)>/);
            const verifiedEmail = match?.[1] ?? FROM_DEFAULT.split(' ').pop() ?? 'noreply@music.zinakonect.com';
            brandedFrom = `${branding.name} <${verifiedEmail}>`;
        }
        catch {
            // Fall through to default
        }
    }
    const resendPayload = {
        from: brandedFrom,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo: opts.replyTo,
        cc: opts.cc ? (Array.isArray(opts.cc) ? opts.cc : [opts.cc]) : undefined,
        bcc: opts.bcc ? (Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc]) : undefined,
        tags: opts.tags,
    };
    if (opts.attachments?.length) {
        resendPayload['attachments'] = opts.attachments.map(a => ({
            filename: a.filename,
            content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
        }));
    }
    const { data, error } = await resend.emails.send(resendPayload);
    if (error) {
        logger_1.logger.error('[EmailService] Resend error', { error });
        throw new Error(`Email send failed: ${error.message}`);
    }
    logger_1.logger.info('[EmailService] Email sent via Resend', { id: data.id, to: opts.to, subject: opts.subject, from: brandedFrom });
    await logSentEmail({
        companyId: opts.companyId, to: opts.to, subject: opts.subject, body: opts.html,
        cc: opts.cc, provider: 'resend', from: brandedFrom, externalId: data.id,
    });
    return { id: data.id, success: true, provider: 'resend' };
}
// ── Templates ─────────────────────────────────────────────────────────────────
/** Invitation d'un collaborateur — sent via company Gmail if connected */
async function sendInviteEmail(opts) {
    const b = await getBranding(opts.companyId);
    return sendEmail({
        to: opts.to,
        subject: `${opts.inviterName} vous invite a rejoindre ${opts.companyName}`,
        html: inviteTemplate(opts, b),
        tags: [{ name: 'type', value: 'invite' }],
        companyId: opts.companyId,
    });
}
/** Alerte securite / incident — sent via company Gmail if connected */
async function sendSecurityAlertEmail(opts) {
    const b = await getBranding(opts.companyId);
    const colorMap = { low: '#16a34a', medium: '#d97706', high: '#ea580c', critical: '#dc2626' };
    return sendEmail({
        to: opts.to,
        subject: `[${opts.severity.toUpperCase()}] Alerte securite — ${opts.alertType}`,
        html: alertTemplate({ ...opts, color: colorMap[opts.severity] }, b),
        tags: [{ name: 'type', value: 'security-alert' }, { name: 'severity', value: opts.severity }],
        companyId: opts.companyId,
    });
}
/** Rapport hebdomadaire — sent via company Gmail if connected */
async function sendWeeklyReportEmail(opts) {
    const b = await getBranding(opts.companyId);
    return sendEmail({
        to: opts.to,
        subject: `Rapport hebdomadaire ${b.name} — ${opts.period}`,
        html: reportTemplate(opts, b),
        tags: [{ name: 'type', value: 'weekly-report' }],
        companyId: opts.companyId,
    });
}
/** Notification contrat WEMAS — sent via company Gmail if connected */
async function sendContractEmail(opts) {
    const b = await getBranding(opts.companyId);
    return sendEmail({
        to: opts.to,
        subject: `Contrat a signer : ${opts.contractTitle}`,
        html: contractTemplate(opts, b),
        tags: [{ name: 'type', value: 'contract' }],
        companyId: opts.companyId,
    });
}
/** Welcome email — sent right after registration */
async function sendWelcomeEmail(opts) {
    return sendEmail({
        to: opts.to,
        subject: `Bienvenue sur Orlode AI, ${opts.userName} !`,
        html: welcomeTemplate(opts),
        tags: [{ name: 'type', value: 'welcome' }],
        forceResend: true,
    });
}
/** Confirmation de paiement — forced Resend (system email, not from company mailbox) */
async function sendPaymentConfirmationEmail(opts) {
    const b = await getBranding(opts.companyId);
    return sendEmail({
        to: opts.to,
        subject: `Paiement confirme — Plan ${opts.planName} active`,
        html: paymentConfirmationTemplate(opts, b),
        tags: [{ name: 'type', value: 'payment-confirmation' }, { name: 'plan', value: opts.planName }],
        forceResend: true, // system confirmation — always from Orlode, not the client's Gmail
    });
}
/** Reponse email via Agent Comms — sent via company Gmail if connected */
async function sendReplyEmail(opts) {
    const b = await getBranding(opts.companyId);
    return sendEmail({
        to: opts.to,
        subject: opts.subject,
        html: replyTemplate(opts.bodyHtml, b),
        replyTo: opts.replyTo,
        tags: [{ name: 'type', value: 'ai-reply' }],
        companyId: opts.companyId,
    });
}
// ── HTML Templates ────────────────────────────────────────────────────────────
function baseWrapper(content, b) {
    const logoHtml = b.logoUrl
        ? `<img src="${b.logoUrl}" alt="${b.name}" style="height:36px;max-width:180px;object-fit:contain;margin-bottom:6px;" /><br>`
        : '';
    const footerSite = b.website ?? 'corpmind.ai';
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0019FF,#0092FF);padding:28px 36px;text-align:center;">
            ${logoHtml}
            <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${b.name}</span>
            ${b.slogan ? `<br><span style="color:rgba(255,255,255,0.7);font-size:12px;">${b.slogan}</span>` : ''}
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:36px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fc;padding:20px 36px;text-align:center;border-top:1px solid #eef0f5;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} ${b.name}${footerSite ? ` · ${footerSite}` : ''}<br>
              ${b.slogan ? `${b.slogan}` : `Propulse par Orlode AI`}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function inviteTemplate(opts, b) {
    return baseWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Vous etes invite(e) 🎉</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      <strong>${opts.inviterName}</strong> vous invite a rejoindre l'espace <strong>${opts.companyName}</strong>.
    </p>
    <a href="${opts.inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#0019FF,#0092FF);color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:600;">
      Accepter l'invitation
    </a>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">Ce lien expire dans 48 heures.</p>
  `, b);
}
function alertTemplate(opts, b) {
    return baseWrapper(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
      <span style="display:inline-block;background:${opts.color};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;">${opts.severity}</span>
      <h2 style="margin:0;font-size:20px;color:#111827;">${opts.alertType}</h2>
    </div>
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">Entreprise : <strong>${opts.companyName}</strong></p>
    <div style="background:#f8f9fc;border-left:4px solid ${opts.color};padding:16px;border-radius:8px;font-size:14px;color:#374151;line-height:1.6;">
      ${opts.details}
    </div>
    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">Connectez-vous a votre tableau de bord pour plus de details.</p>
  `, b);
}
function reportTemplate(opts, b) {
    const statsRows = opts.stats.map(s => `
    <td style="width:${Math.floor(100 / opts.stats.length)}%;text-align:center;padding:16px;background:#f8f9fc;border-radius:10px;">
      <div style="font-size:22px;font-weight:700;color:#0019FF;">${s.value}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">${s.label}</div>
    </td>
  `).join('<td style="width:8px;"></td>');
    return baseWrapper(`
    <h2 style="margin:0 0 4px;font-size:22px;color:#111827;">Rapport hebdomadaire</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${opts.companyName} · ${opts.period}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>${statsRows}</tr>
    </table>
    <a href="${opts.reportUrl}" style="display:inline-block;background:linear-gradient(135deg,#0019FF,#0092FF);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
      Voir le rapport complet
    </a>
  `, b);
}
function contractTemplate(opts, b) {
    return baseWrapper(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Contrat a signer 📝</h2>
    <p style="margin:0 0 8px;color:#6b7280;font-size:15px;line-height:1.6;">
      <strong>${opts.senderName}</strong> vous envoie le contrat suivant pour signature :
    </p>
    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#1e40af;">${opts.contractTitle}</p>
    </div>
    ${opts.expiresAt ? `<p style="margin:0 0 20px;font-size:13px;color:#f59e0b;">⏰ Expire le ${opts.expiresAt}</p>` : '<div style="margin-bottom:20px;"></div>'}
    <a href="${opts.signUrl}" style="display:inline-block;background:linear-gradient(135deg,#0019FF,#0092FF);color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:600;">
      Signer le contrat
    </a>
  `, b);
}
function welcomeTemplate(opts) {
    const dashboardUrl = opts.dashboardUrl ?? 'https://orlode.com/dashboard';
    const b = { name: 'Orlode AI', website: 'mon-assistant-86bbd.web.app' };
    const planLine = opts.plan
        ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Votre plan : <strong style="color:#0019FF;text-transform:capitalize;">${opts.plan}</strong></p>`
        : '';
    return baseWrapper(`
    <h2 style="margin:0 0 8px;font-size:24px;color:#111827;">Bienvenue ${opts.userName} 🎉</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6;">
      Votre espace <strong>${opts.companyName}</strong> sur Orlode AI est prêt. Vous avez accès à 48 agents IA spécialisés prêts à travailler pour vous.
    </p>
    ${planLine}

    <div style="background:#f8f9fc;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 12px;font-weight:600;color:#111827;font-size:14px;">Vos prochaines étapes :</p>
      <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.9;">
        <li>Connectez votre Gmail pour que les agents envoient depuis votre adresse pro</li>
        <li>Choisissez vos agents dans Abonnement &amp; Agents</li>
        <li>Importez vos documents pour la mémoire de l'IA</li>
        <li>Invitez vos collaborateurs</li>
      </ul>
    </div>

    <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#0019FF,#0092FF);color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:600;">
      Accéder à mon espace
    </a>

    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
      Besoin d'aide ? Répondez simplement à cet email.
    </p>
  `, b);
}
function paymentConfirmationTemplate(opts, b) {
    const dashboardUrl = opts.dashboardUrl ?? 'https://orlode.com/admin/billing';
    const nextLine = opts.nextBillingDate
        ? `<p style="margin:0;font-size:13px;color:#6b7280;">Prochain prelevement : <strong>${new Date(opts.nextBillingDate).toLocaleDateString('fr-FR')}</strong></p>`
        : opts.interval === 'monthly'
            ? '<p style="margin:0;font-size:13px;color:#6b7280;">Renouvellement mensuel — annulable a tout moment depuis votre espace.</p>'
            : '';
    const receiptBtn = opts.receiptUrl
        ? `<a href="${opts.receiptUrl}" style="display:inline-block;margin-left:8px;padding:10px 18px;border:1px solid #e5e7eb;color:#374151;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">Recu / Facture</a>`
        : '';
    return baseWrapper(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background:#16a34a;border-radius:50%;margin-bottom:12px;line-height:56px;font-size:28px;color:#fff;">✓</div>
      <h2 style="margin:0 0 4px;font-size:22px;color:#111827;">Paiement confirme</h2>
      <p style="margin:0;color:#6b7280;font-size:14px;">Votre plan <strong>${opts.planName}</strong> est active immediatement.</p>
    </div>

    <div style="background:#f8f9fc;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="6" style="font-size:14px;">
        <tr><td style="color:#6b7280;">Plan</td><td style="text-align:right;font-weight:600;color:#111827;">${opts.planName}</td></tr>
        <tr><td style="color:#6b7280;">Montant</td><td style="text-align:right;font-weight:700;color:#111827;">${opts.amount}</td></tr>
        <tr><td style="color:#6b7280;">Methode</td><td style="text-align:right;color:#374151;">${opts.method}</td></tr>
        <tr><td style="color:#6b7280;">Reference</td><td style="text-align:right;font-family:monospace;font-size:12px;color:#374151;">${opts.reference}</td></tr>
      </table>
    </div>

    ${nextLine}

    <div style="margin:24px 0 0;">
      <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#0019FF,#0092FF);color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Acceder a mon espace
      </a>
      ${receiptBtn}
    </div>
  `, b);
}
function replyTemplate(bodyHtml, b) {
    return baseWrapper(`
    <div style="font-size:15px;color:#374151;line-height:1.7;">
      ${bodyHtml}
    </div>
    <hr style="border:none;border-top:1px solid #eef0f5;margin:24px 0;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Email redige par l'assistant IA de ${b.name}
    </p>
  `, b);
}
//# sourceMappingURL=emailService.js.map