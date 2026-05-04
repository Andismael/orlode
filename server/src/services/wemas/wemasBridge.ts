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
import { logger } from '../../utils/logger';
import { getFirestore } from '../../config/firebase.config';

const BRIDGE_URL = () => process.env['WEMAS_BRIDGE_URL'] ?? '';
const BRIDGE_API_KEY = () => process.env['WEMAS_BRIDGE_API_KEY'] ?? '';
const FRONTEND_URL = () => process.env['WEMAS_FRONTEND_URL'] ?? 'https://wemas.click';

class WemasUnavailableError extends Error {
  constructor() { super('Wemas bridge is not configured (set WEMAS_BRIDGE_URL + WEMAS_BRIDGE_API_KEY).'); }
}

interface BridgeResponse<T> { success: boolean; data?: T; error?: string }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BRIDGE_URL();
  const key = BRIDGE_API_KEY();
  if (!url || !key) throw new WemasUnavailableError();

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
  let body: BridgeResponse<T>;
  try { body = await r.json() as BridgeResponse<T>; }
  catch { throw new Error(`Wemas bridge returned non-JSON (status ${r.status})`); }
  if (!body.success) throw new Error(body.error ?? `Wemas bridge call failed (status ${r.status})`);
  return body.data as T;
}

// ── Public types ─────────────────────────────────────────────────────────────

export type WemasContractStatus =
  | 'draft' | 'pending_signature' | 'signed' | 'rejected' | 'expired';

export interface WemasContract {
  id: string;
  signatoryName: string;
  signatoryEmail: string;
  status: WemasContractStatus;
  contractType: string;
  signingUrl: string;
  verifyUrl?: string;
  createdAt: string;
  expiresAt: string;
  senderSignedAt?: string | null;
}

// ── Org provisioning ────────────────────────────────────────────────────────

interface ProvisionResult { id: string; alreadyProvisioned: boolean }

/**
 * Idempotent: creates a Wemas org for this Orlode company if none exists,
 * caches the wemasOrgId on the company doc to avoid repeat lookups.
 */
export async function provisionOrgIfNeeded(companyId: string): Promise<string> {
  const db = getFirestore();
  const companyRef = db.collection('companies').doc(companyId);
  const snap = await companyRef.get();
  if (!snap.exists) throw new Error(`Company ${companyId} not found`);
  const company = snap.data() ?? {};

  // Cached?
  if (company['wemasOrgId']) return company['wemasOrgId'] as string;

  const r = await call<ProvisionResult>('/orgs/provision', {
    method: 'POST',
    body: JSON.stringify({
      orlodeCompanyId: companyId,
      name:    (company['name'] as string)    ?? 'Mon Entreprise',
      email:   (company['email'] as string)   ?? null,
      color:   (company['primaryColor'] as string) ?? '#2563eb',
      logoUrl: (company['logoUrl'] as string) ?? null,
    }),
  });

  await companyRef.set({ wemasOrgId: r.id, wemasProvisionedAt: new Date() }, { merge: true });
  logger.info('[Wemas] Org provisioned', { companyId, wemasOrgId: r.id, alreadyProvisioned: r.alreadyProvisioned });
  return r.id;
}

// ── Contract creation ───────────────────────────────────────────────────────

export interface CreateContractArgs {
  companyId:        string;
  signatoryName:    string;
  signatoryEmail:   string;
  signatoryPhone?:  string;
  contractContent:  string;
  contractType?:    string;       // 'cdi' | 'cdd' | 'freelance' | 'nda' | 'prestation_services' | ...
  senderName?:      string;
  sendNow?:         boolean;      // true = email signatory immediately, false = save as draft
}

export interface CreateContractResult {
  id:               string;
  uniqueLink:       string;
  verificationCode: string;
  signingUrl:       string;
  status:           WemasContractStatus;
  expiresAt:        string;
}

export async function createAndSendContract(args: CreateContractArgs): Promise<CreateContractResult> {
  await provisionOrgIfNeeded(args.companyId);

  const result = await call<CreateContractResult>('/contracts', {
    method: 'POST',
    body: JSON.stringify({
      orlodeCompanyId: args.companyId,
      signatoryName:   args.signatoryName,
      signatoryEmail:  args.signatoryEmail,
      signatoryPhone:  args.signatoryPhone,
      contractContent: args.contractContent,
      contractType:    args.contractType ?? 'prestation_services',
      senderName:      args.senderName,
      sendNow:         args.sendNow ?? true,
    }),
  });

  // Mirror the Wemas record into Firestore for fast Orlode-side lookups.
  // Source of truth remains Wemas — this is just a cache for the /admin/contracts list.
  try {
    const db = getFirestore();
    await db.collection(`companies/${args.companyId}/contracts`).doc(result.id).set({
      wemasId:         result.id,
      signatoryName:   args.signatoryName,
      signatoryEmail:  args.signatoryEmail,
      contractType:    args.contractType ?? 'prestation_services',
      signingUrl:      result.signingUrl,
      verificationCode: result.verificationCode,
      status:          result.status,
      expiresAt:       result.expiresAt,
      createdAt:       new Date(),
      sentVia:         'wemas',
    });
  } catch (cacheErr) {
    logger.warn('[Wemas] Firestore cache write failed (non-fatal)', { err: String(cacheErr) });
  }

  return result;
}

// ── Read operations ────────────────────────────────────────────────────────

export async function listContracts(companyId: string, limit = 50): Promise<WemasContract[]> {
  const params = new URLSearchParams({ orlodeCompanyId: companyId, limit: String(limit) });
  return await call<WemasContract[]>(`/contracts?${params.toString()}`, { method: 'GET' });
}

export async function getContract(companyId: string, contractId: string): Promise<WemasContract> {
  const params = new URLSearchParams({ orlodeCompanyId: companyId });
  return await call<WemasContract>(`/contracts/${contractId}?${params.toString()}`, { method: 'GET' });
}

export async function resendContract(companyId: string, contractId: string): Promise<{ signingUrl: string; status: string }> {
  return await call<{ signingUrl: string; status: string }>(`/contracts/${contractId}/send`, {
    method: 'POST',
    body: JSON.stringify({ orlodeCompanyId: companyId }),
  });
}

// ── Convenience helper: is the bridge available? ─────────────────────────────

export function isWemasConfigured(): boolean {
  return !!(BRIDGE_URL() && BRIDGE_API_KEY());
}

export function getWemasFrontendUrl(): string {
  return FRONTEND_URL();
}
