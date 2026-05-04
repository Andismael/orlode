"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGmailConnection = getGmailConnection;
exports.sendViaGmail = sendViaGmail;
exports.clearTokenCache = clearTokenCache;
/**
 * Gmail Send Service — sends emails via Gmail API on behalf of the company.
 * Token lifecycle: refresh_token stored in Firestore at companies/{id}.gmail.refreshToken.
 * Access token is refreshed on demand (cached 50 minutes, Google expiry is 1h).
 */
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
const TOKEN_CACHE = new Map();
const TOKEN_TTL_MS = 50 * 60 * 1000; // refresh a bit before Google's 60 min expiry
/** Fetch the stored Gmail connection for a company (null if not connected) */
async function getGmailConnection(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('companies').doc(companyId).get();
    const gmail = doc.data()?.['gmail'] ?? null;
    if (!gmail?.refreshToken)
        return null;
    return gmail;
}
/** Exchange a refresh_token for a fresh access_token via Google's token endpoint */
async function refreshAccessToken(refreshToken) {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }).toString(),
    });
    if (!res.ok)
        throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.access_token;
}
/** Get a valid access token for a company (refreshes if expired, caches in memory) */
async function getAccessToken(companyId, connection) {
    const cached = TOKEN_CACHE.get(companyId);
    if (cached && cached.expiresAt > Date.now() + 60000)
        return cached.accessToken;
    const accessToken = await refreshAccessToken(connection.refreshToken);
    TOKEN_CACHE.set(companyId, {
        accessToken,
        expiresAt: Date.now() + TOKEN_TTL_MS,
        email: connection.email,
    });
    return accessToken;
}
/** Chunk a base64 string to 76-char lines (RFC 2045 compliance for some providers) */
function chunk76(s) {
    return s.match(/.{1,76}/g)?.join('\r\n') ?? s;
}
/** Build an RFC 2822 MIME message and base64url-encode it for Gmail API */
function buildRawMessage(opts) {
    const commonHeaders = [
        `From: ${opts.from}`,
        `To: ${opts.to.join(', ')}`,
    ];
    if (opts.cc?.length)
        commonHeaders.push(`Cc: ${opts.cc.join(', ')}`);
    if (opts.bcc?.length)
        commonHeaders.push(`Bcc: ${opts.bcc.join(', ')}`);
    if (opts.replyTo)
        commonHeaders.push(`Reply-To: ${opts.replyTo}`);
    commonHeaders.push(`Subject: =?UTF-8?B?${Buffer.from(opts.subject, 'utf-8').toString('base64')}?=`, 'MIME-Version: 1.0');
    let rfcMessage;
    const hasAttachments = opts.attachments && opts.attachments.length > 0;
    if (!hasAttachments) {
        // Simple HTML email — no multipart needed
        const headers = [
            ...commonHeaders,
            'Content-Type: text/html; charset="UTF-8"',
            'Content-Transfer-Encoding: base64',
        ];
        const bodyBase64 = Buffer.from(opts.html, 'utf-8').toString('base64');
        rfcMessage = `${headers.join('\r\n')}\r\n\r\n${bodyBase64}`;
    }
    else {
        // multipart/mixed with HTML body + attachments
        const boundary = `----OrlodeBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const headers = [
            ...commonHeaders,
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ];
        const parts = [];
        // HTML body part
        parts.push([
            `--${boundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            'Content-Transfer-Encoding: base64',
            '',
            chunk76(Buffer.from(opts.html, 'utf-8').toString('base64')),
        ].join('\r\n'));
        // Attachment parts
        for (const att of opts.attachments) {
            const buf = typeof att.content === 'string' ? Buffer.from(att.content) : att.content;
            const ct = att.contentType ?? (att.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
            const encodedName = `=?UTF-8?B?${Buffer.from(att.filename, 'utf-8').toString('base64')}?=`;
            parts.push([
                `--${boundary}`,
                `Content-Type: ${ct}; name="${encodedName}"`,
                `Content-Disposition: attachment; filename="${encodedName}"`,
                'Content-Transfer-Encoding: base64',
                '',
                chunk76(buf.toString('base64')),
            ].join('\r\n'));
        }
        parts.push(`--${boundary}--`);
        rfcMessage = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
    }
    return Buffer.from(rfcMessage, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
/** Send email via Gmail API. Returns Gmail message ID. */
async function sendViaGmail(opts) {
    const connection = await getGmailConnection(opts.companyId);
    if (!connection)
        throw new Error('Gmail not connected for this company');
    const accessToken = await getAccessToken(opts.companyId, connection);
    const from = opts.sendAsAlias ?? connection.email;
    const raw = buildRawMessage({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        cc: opts.cc ? (Array.isArray(opts.cc) ? opts.cc : [opts.cc]) : undefined,
        bcc: opts.bcc ? (Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc]) : undefined,
        replyTo: opts.replyTo,
        attachments: opts.attachments,
    });
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
        const errText = await res.text();
        logger_1.logger.error('[Gmail] Send failed', { companyId: opts.companyId, status: res.status, err: errText });
        throw new Error(`Gmail send failed: ${res.status} ${errText}`);
    }
    const data = await res.json();
    logger_1.logger.info('[Gmail] Email sent', { companyId: opts.companyId, id: data.id, to: opts.to, from });
    return { id: data.id, threadId: data.threadId, from };
}
/** Clear cached access token (call after disconnect or on 401) */
function clearTokenCache(companyId) {
    TOKEN_CACHE.delete(companyId);
}
//# sourceMappingURL=gmailSendService.js.map