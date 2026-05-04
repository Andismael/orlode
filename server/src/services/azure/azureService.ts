/**
 * Azure AI services — per-tenant config.
 *
 * Supported:
 *   - Document Intelligence (Form Recognizer) — OCR + structured extraction from invoices/contracts
 *   - Speech (stub, for future)
 *   - OpenAI (stub, for future)
 *
 * Config stored in `tenants/{companyId}/azure` (encrypted secrets):
 *   {
 *     docIntel: { endpoint, keyEncrypted },
 *     speech:   { region, keyEncrypted },
 *     openai:   { endpoint, keyEncrypted, deployment },
 *   }
 */
import { getFirestore } from '../../config/firebase.config';
import { decrypt, encrypt } from '../../config/encryption';
import { logger } from '../../utils/logger';

export interface AzureConfig {
  docIntel?: { endpoint: string; key: string };
  speech?:   { region: string; key: string };
  openai?:   { endpoint: string; key: string; deployment: string };
}

async function loadAzureConfig(companyId: string): Promise<AzureConfig> {
  try {
    const doc = await getFirestore().collection('tenants').doc(companyId).get();
    if (!doc.exists) return {};
    const az = (doc.data()?.['azure'] as Record<string, Record<string, string>>) ?? {};
    const out: AzureConfig = {};
    if (az['docIntel']?.['endpoint'] && az['docIntel']?.['keyEncrypted']) {
      try { out.docIntel = { endpoint: az['docIntel']['endpoint'], key: decrypt(az['docIntel']['keyEncrypted']) }; } catch { /* ignore */ }
    }
    if (az['speech']?.['region'] && az['speech']?.['keyEncrypted']) {
      try { out.speech = { region: az['speech']['region'], key: decrypt(az['speech']['keyEncrypted']) }; } catch { /* ignore */ }
    }
    if (az['openai']?.['endpoint'] && az['openai']?.['keyEncrypted']) {
      try {
        out.openai = {
          endpoint: az['openai']['endpoint'],
          key: decrypt(az['openai']['keyEncrypted']),
          deployment: az['openai']['deployment'] ?? 'gpt-4',
        };
      } catch { /* ignore */ }
    }
    return out;
  } catch (err) {
    logger.warn('[Azure] config load failed', { err: String(err) });
    return {};
  }
}

export async function saveAzureConfig(companyId: string, input: {
  docIntel?: { endpoint?: string; key?: string };
  speech?:   { region?: string; key?: string };
  openai?:   { endpoint?: string; key?: string; deployment?: string };
}): Promise<void> {
  const existing = await getFirestore().collection('tenants').doc(companyId).get();
  const current = (existing.data()?.['azure'] as Record<string, Record<string, unknown>>) ?? {};

  const merged: Record<string, Record<string, unknown>> = { ...current };

  if (input.docIntel) {
    merged['docIntel'] = {
      ...(current['docIntel'] ?? {}),
      ...(input.docIntel.endpoint ? { endpoint: input.docIntel.endpoint } : {}),
      ...(input.docIntel.key ? { keyEncrypted: encrypt(input.docIntel.key) } : {}),
    };
  }
  if (input.speech) {
    merged['speech'] = {
      ...(current['speech'] ?? {}),
      ...(input.speech.region ? { region: input.speech.region } : {}),
      ...(input.speech.key ? { keyEncrypted: encrypt(input.speech.key) } : {}),
    };
  }
  if (input.openai) {
    merged['openai'] = {
      ...(current['openai'] ?? {}),
      ...(input.openai.endpoint ? { endpoint: input.openai.endpoint } : {}),
      ...(input.openai.key ? { keyEncrypted: encrypt(input.openai.key) } : {}),
      ...(input.openai.deployment ? { deployment: input.openai.deployment } : {}),
    };
  }

  await getFirestore().collection('tenants').doc(companyId).set(
    { azure: merged, updatedAt: new Date() }, { merge: true },
  );
}

export async function getAzureStatus(companyId: string): Promise<{
  docIntel: boolean; speech: boolean; openai: boolean;
}> {
  const cfg = await loadAzureConfig(companyId);
  return { docIntel: !!cfg.docIntel, speech: !!cfg.speech, openai: !!cfg.openai };
}

/** Call Azure Document Intelligence (Form Recognizer) — prebuilt invoice model. */
export async function analyzeInvoice(companyId: string, documentUrl: string): Promise<{
  success: boolean;
  data?: {
    vendor?: string;
    invoiceId?: string;
    invoiceDate?: string;
    dueDate?: string;
    total?: number;
    subtotal?: number;
    tax?: number;
    currency?: string;
    items?: Array<{ description?: string; quantity?: number; unitPrice?: number; amount?: number }>;
  };
  message: string;
}> {
  const cfg = await loadAzureConfig(companyId);
  if (!cfg.docIntel) {
    return { success: false, message: "Azure Document Intelligence non configuré pour cette entreprise." };
  }
  const endpoint = cfg.docIntel.endpoint.replace(/\/+$/, '');
  const key = cfg.docIntel.key;
  try {
    // Start analysis (prebuilt-invoice model, API version 2024-07-31)
    const submit = await fetch(`${endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-07-31-preview`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlSource: documentUrl }),
    });
    if (!submit.ok) {
      const errText = await submit.text().catch(() => '');
      return { success: false, message: `Azure a refusé: ${submit.status} ${errText.slice(0, 200)}` };
    }
    const operationUrl = submit.headers.get('operation-location');
    if (!operationUrl) return { success: false, message: 'Azure: pas d\'operation URL' };

    // Poll for result (up to ~20 seconds)
    let result: Record<string, unknown> | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const poll = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': key } });
      if (!poll.ok) continue;
      const j = await poll.json() as Record<string, unknown>;
      const status = j['status'] as string;
      if (status === 'succeeded') { result = j; break; }
      if (status === 'failed') return { success: false, message: 'Azure: analyse échouée' };
    }
    if (!result) return { success: false, message: 'Azure: timeout (> 20s)' };

    // Parse invoice fields
    const analyzeResult = result['analyzeResult'] as Record<string, unknown>;
    const docs = (analyzeResult?.['documents'] as Array<Record<string, unknown>>) ?? [];
    const doc = docs[0];
    if (!doc) return { success: false, message: 'Azure: aucun document reconnu' };

    const fields = (doc['fields'] as Record<string, { valueString?: string; valueNumber?: number; valueCurrency?: { amount?: number; currencyCode?: string }; valueDate?: string; valueArray?: Array<Record<string, unknown>> }>) ?? {};
    const getStr = (k: string) => fields[k]?.valueString;
    const getCur = (k: string) => fields[k]?.valueCurrency;

    const items = ((fields['Items']?.valueArray) ?? []).map((it: Record<string, unknown>) => {
      const v = (it['valueObject'] as Record<string, { valueString?: string; valueNumber?: number; valueCurrency?: { amount?: number } }>) ?? {};
      return {
        description: v['Description']?.valueString,
        quantity: v['Quantity']?.valueNumber,
        unitPrice: v['UnitPrice']?.valueCurrency?.amount,
        amount: v['Amount']?.valueCurrency?.amount,
      };
    });

    return {
      success: true,
      data: {
        vendor:      getStr('VendorName'),
        invoiceId:   getStr('InvoiceId'),
        invoiceDate: fields['InvoiceDate']?.valueDate,
        dueDate:     fields['DueDate']?.valueDate,
        total:       getCur('InvoiceTotal')?.amount,
        subtotal:    getCur('SubTotal')?.amount,
        tax:         getCur('TotalTax')?.amount,
        currency:    getCur('InvoiceTotal')?.currencyCode,
        items,
      },
      message: 'Facture analysée.',
    };
  } catch (err) {
    logger.error('[Azure] analyzeInvoice failed', { err: String(err) });
    return { success: false, message: `Erreur Azure: ${String(err)}` };
  }
}
