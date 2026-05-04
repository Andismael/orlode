"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMagicToken = signMagicToken;
exports.verifyMagicToken = verifyMagicToken;
exports.buildMagicLink = buildMagicLink;
/**
 * Magic link tokens for client self-service pages.
 *
 * Format:  base64url(payload).base64url(hmac-sha256)
 * Signed with JWT_SECRET (already in env).
 *
 * Payload:
 *   {
 *     companyId: string,
 *     id: string,           // email or phone (normalized)
 *     type: 'email' | 'phone',
 *     exp: number,          // seconds since epoch
 *   }
 */
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_TTL_DAYS = 90;
function b64urlEncode(s) {
    const b = Buffer.isBuffer(s) ? s : Buffer.from(s);
    return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
function secret() {
    return process.env['JWT_SECRET'] || 'change-me-in-production';
}
function signMagicToken(companyId, identifier, type, ttlDays = DEFAULT_TTL_DAYS) {
    const payload = {
        companyId,
        id: (type === 'email' ? identifier.toLowerCase().trim() : identifier.replace(/[^0-9+]/g, '')),
        type,
        exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
    };
    const body = b64urlEncode(JSON.stringify(payload));
    const sig = crypto_1.default.createHmac('sha256', secret()).update(body).digest();
    return `${body}.${b64urlEncode(sig)}`;
}
function verifyMagicToken(token) {
    try {
        const [body, sig] = token.split('.');
        if (!body || !sig)
            return null;
        const expectedSig = crypto_1.default.createHmac('sha256', secret()).update(body).digest();
        const providedSig = b64urlDecode(sig);
        if (expectedSig.length !== providedSig.length || !crypto_1.default.timingSafeEqual(expectedSig, providedSig))
            return null;
        const payload = JSON.parse(b64urlDecode(body).toString('utf-8'));
        if (!payload.companyId || !payload.id || !payload.type)
            return null;
        if (payload.exp < Math.floor(Date.now() / 1000))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
/** Build a full URL for the client status page, picking the best identifier. */
function buildMagicLink(companyId, opts, publicBase) {
    const email = (opts.email ?? '').trim();
    const phone = (opts.phone ?? '').trim();
    const type = email ? 'email' : (phone ? 'phone' : 'email');
    const id = email || phone;
    if (!id)
        return null;
    const token = signMagicToken(companyId, id, type);
    const base = publicBase || process.env['CORS_ORIGIN'] || 'https://orlode.com';
    return `${base}/my/${token}`;
}
//# sourceMappingURL=magicToken.js.map