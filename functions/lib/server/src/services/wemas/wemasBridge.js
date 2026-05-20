"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionOrgIfNeeded = provisionOrgIfNeeded;
exports.createAndSendContract = createAndSendContract;
exports.listContracts = listContracts;
exports.getContract = getContract;
exports.resendContract = resendContract;
exports.isWemasConfigured = isWemasConfigured;
exports.getWemasFrontendUrl = getWemasFrontendUrl;
/**
 * Wemas Bridge — Orlode → wemas.click contract & signature service.
 *
 * Wemas runs as a standalone app at wemas.click (Vite + Supabase). This
 * service is the thin Orlode-side client that hits Wemas's `api-bridge`
 * Edge Function. Auth is via the shared X-API-Key header.
 *
 * Flow:
 *   1. provisionOrgIfNeeded(companyId)   — one-time per Orlode company
 *   2. createAndSendContract(...)         — agents call this when an action
 *                                           requires a contract (HR CDI, Sales devis, etc.)
 *   3. listContracts / getContract        — read-only views in /admin/contracts
 *
 * Required env (set in .env.cloud.yaml):
 *   WEMAS_BRIDGE_URL      — e.g. https://dppeetmrzmjkpavgwdbs.supabase.co/functions/v1/api-bridge
 *   WEMAS_BRIDGE_API_KEY  — shared secret with the Wemas Edge Function
 *   WEMAS_FRONTEND_URL    — e.g. https://wemas.click (used for display links only)
 */
const logger_1 = require("../../utils/logger");
const firebase_config_1 = require("../../config/firebase.config");
const BRIDGE_URL = () => process.env['WEMAS_BRIDGE_URL'] ?? '';
const BRIDGE_API_KEY = () => process.env['WEMAS_BRIDGE_API_KEY'] ?? '';
const FRONTEND_URL = () => process.env['WEMAS_FRONTEND_URL'] ?? 'https://wemas.click';
class WemasUnavailableError extends Error {
    constructor() { super('Wemas bridge is not configured (set WEMAS_BRIDGE_URL + WEMAS_BRIDGE_API_KEY).'); }
}
async function call(path, init) {
    const url = BRIDGE_URL();
    const key = BRIDGE_API_KEY();
    if (!url || !key)
        throw new WemasUnavailableError();
    const r = await fetch(`${url}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': key,
            ...(init?.headers ?? {}),
        },
    });
    // The Supabase Edge Function returns { success, data?, error? }.
    // Don't trust HTTP status alone — read the body.
    let body;
    try {
        body = await r.json();
    }
    catch {
        throw new Error(`Wemas bridge returned non-JSON (status ${r.status})`);
    }
    if (!body.success)
        throw new Error(body.error ?? `Wemas bridge call failed (status ${r.status})`);
    return body.data;
}
/**
 * Idempotent: creates a Wemas org for this Orlode company if none exists,
 * caches the wemasOrgId on the company doc to avoid repeat lookups.
 */
async function provisionOrgIfNeeded(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const companyRef = db.collection('companies').doc(companyId);
    const snap = await companyRef.get();
    if (!snap.exists)
        throw new Error(`Company ${companyId} not found`);
    const company = snap.data() ?? {};
    // Cached?
    if (company['wemasOrgId'])
        return company['wemasOrgId'];
    const r = await call('/orgs/provision', {
        method: 'POST',
        body: JSON.stringify({
            orlodeCompanyId: companyId,
            name: company['name'] ?? 'Mon Entreprise',
            email: company['email'] ?? null,
            color: company['primaryColor'] ?? '#2563eb',
            logoUrl: company['logoUrl'] ?? null,
        }),
    });
    await companyRef.set({ wemasOrgId: r.id, wemasProvisionedAt: new Date() }, { merge: true });
    logger_1.logger.info('[Wemas] Org provisioned', { companyId, wemasOrgId: r.id, alreadyProvisioned: r.alreadyProvisioned });
    return r.id;
}
async function createAndSendContract(args) {
    await provisionOrgIfNeeded(args.companyId);
    const result = await call('/contracts', {
        method: 'POST',
        body: JSON.stringify({
            orlodeCompanyId: args.companyId,
            signatoryName: args.signatoryName,
            signatoryEmail: args.signatoryEmail,
            signatoryPhone: args.signatoryPhone,
            contractContent: args.contractContent,
            contractType: args.contractType ?? 'prestation_services',
            senderName: args.senderName,
            sendNow: args.sendNow ?? true,
        }),
    });
    // Mirror the Wemas record into Firestore for fast Orlode-side lookups.
    // Source of truth remains Wemas — this is just a cache for the /admin/contracts list.
    try {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(`companies/${args.companyId}/contracts`).doc(result.id).set({
            wemasId: result.id,
            signatoryName: args.signatoryName,
            signatoryEmail: args.signatoryEmail,
            contractType: args.contractType ?? 'prestation_services',
            // Cache the contract body so the email tool can attach it as a PDF
            // without round-tripping to Wemas. Source of truth remains Wemas.
            contractContent: args.contractContent,
            senderName: args.senderName ?? null,
            signingUrl: result.signingUrl,
            verificationCode: result.verificationCode,
            status: result.status,
            expiresAt: result.expiresAt,
            createdAt: new Date(),
            sentVia: 'wemas',
        });
    }
    catch (cacheErr) {
        logger_1.logger.warn('[Wemas] Firestore cache write failed (non-fatal)', { err: String(cacheErr) });
    }
    return result;
}
// ── Read operations ────────────────────────────────────────────────────────
async function listContracts(companyId, limit = 50) {
    const params = new URLSearchParams({ orlodeCompanyId: companyId, limit: String(limit) });
    return await call(`/contracts?${params.toString()}`, { method: 'GET' });
}
async function getContract(companyId, contractId) {
    const params = new URLSearchParams({ orlodeCompanyId: companyId });
    return await call(`/contracts/${contractId}?${params.toString()}`, { method: 'GET' });
}
async function resendContract(companyId, contractId) {
    return await call(`/contracts/${contractId}/send`, {
        method: 'POST',
        body: JSON.stringify({ orlodeCompanyId: companyId }),
    });
}
// ── Convenience helper: is the bridge available? ─────────────────────────────
function isWemasConfigured() {
    return !!(BRIDGE_URL() && BRIDGE_API_KEY());
}
function getWemasFrontendUrl() {
    return FRONTEND_URL();
}
//# sourceMappingURL=wemasBridge.js.map