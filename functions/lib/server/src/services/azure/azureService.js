"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAzureConfig = saveAzureConfig;
exports.getAzureStatus = getAzureStatus;
exports.analyzeInvoice = analyzeInvoice;
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
const firebase_config_1 = require("../../config/firebase.config");
const encryption_1 = require("../../config/encryption");
const logger_1 = require("../../utils/logger");
async function loadAzureConfig(companyId) {
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection('tenants').doc(companyId).get();
        if (!doc.exists)
            return {};
        const az = doc.data()?.['azure'] ?? {};
        const out = {};
        if (az['docIntel']?.['endpoint'] && az['docIntel']?.['keyEncrypted']) {
            try {
                out.docIntel = { endpoint: az['docIntel']['endpoint'], key: (0, encryption_1.decrypt)(az['docIntel']['keyEncrypted']) };
            }
            catch { /* ignore */ }
        }
        if (az['speech']?.['region'] && az['speech']?.['keyEncrypted']) {
            try {
                out.speech = { region: az['speech']['region'], key: (0, encryption_1.decrypt)(az['speech']['keyEncrypted']) };
            }
            catch { /* ignore */ }
        }
        if (az['openai']?.['endpoint'] && az['openai']?.['keyEncrypted']) {
            try {
                out.openai = {
                    endpoint: az['openai']['endpoint'],
                    key: (0, encryption_1.decrypt)(az['openai']['keyEncrypted']),
                    deployment: az['openai']['deployment'] ?? 'gpt-4',
                };
            }
            catch { /* ignore */ }
        }
        return out;
    }
    catch (err) {
        logger_1.logger.warn('[Azure] config load failed', { err: String(err) });
        return {};
    }
}
async function saveAzureConfig(companyId, input) {
    const existing = await (0, firebase_config_1.getFirestore)().collection('tenants').doc(companyId).get();
    const current = existing.data()?.['azure'] ?? {};
    const merged = { ...current };
    if (input.docIntel) {
        merged['docIntel'] = {
            ...(current['docIntel'] ?? {}),
            ...(input.docIntel.endpoint ? { endpoint: input.docIntel.endpoint } : {}),
            ...(input.docIntel.key ? { keyEncrypted: (0, encryption_1.encrypt)(input.docIntel.key) } : {}),
        };
    }
    if (input.speech) {
        merged['speech'] = {
            ...(current['speech'] ?? {}),
            ...(input.speech.region ? { region: input.speech.region } : {}),
            ...(input.speech.key ? { keyEncrypted: (0, encryption_1.encrypt)(input.speech.key) } : {}),
        };
    }
    if (input.openai) {
        merged['openai'] = {
            ...(current['openai'] ?? {}),
            ...(input.openai.endpoint ? { endpoint: input.openai.endpoint } : {}),
            ...(input.openai.key ? { keyEncrypted: (0, encryption_1.encrypt)(input.openai.key) } : {}),
            ...(input.openai.deployment ? { deployment: input.openai.deployment } : {}),
        };
    }
    await (0, firebase_config_1.getFirestore)().collection('tenants').doc(companyId).set({ azure: merged, updatedAt: new Date() }, { merge: true });
}
async function getAzureStatus(companyId) {
    const cfg = await loadAzureConfig(companyId);
    return { docIntel: !!cfg.docIntel, speech: !!cfg.speech, openai: !!cfg.openai };
}
/** Call Azure Document Intelligence (Form Recognizer) — prebuilt invoice model. */
async function analyzeInvoice(companyId, documentUrl) {
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
        if (!operationUrl)
            return { success: false, message: 'Azure: pas d\'operation URL' };
        // Poll for result (up to ~20 seconds)
        let result = null;
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const poll = await fetch(operationUrl, { headers: { 'Ocp-Apim-Subscription-Key': key } });
            if (!poll.ok)
                continue;
            const j = await poll.json();
            const status = j['status'];
            if (status === 'succeeded') {
                result = j;
                break;
            }
            if (status === 'failed')
                return { success: false, message: 'Azure: analyse échouée' };
        }
        if (!result)
            return { success: false, message: 'Azure: timeout (> 20s)' };
        // Parse invoice fields
        const analyzeResult = result['analyzeResult'];
        const docs = analyzeResult?.['documents'] ?? [];
        const doc = docs[0];
        if (!doc)
            return { success: false, message: 'Azure: aucun document reconnu' };
        const fields = doc['fields'] ?? {};
        const getStr = (k) => fields[k]?.valueString;
        const getCur = (k) => fields[k]?.valueCurrency;
        const items = ((fields['Items']?.valueArray) ?? []).map((it) => {
            const v = it['valueObject'] ?? {};
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
                vendor: getStr('VendorName'),
                invoiceId: getStr('InvoiceId'),
                invoiceDate: fields['InvoiceDate']?.valueDate,
                dueDate: fields['DueDate']?.valueDate,
                total: getCur('InvoiceTotal')?.amount,
                subtotal: getCur('SubTotal')?.amount,
                tax: getCur('TotalTax')?.amount,
                currency: getCur('InvoiceTotal')?.currencyCode,
                items,
            },
            message: 'Facture analysée.',
        };
    }
    catch (err) {
        logger_1.logger.error('[Azure] analyzeInvoice failed', { err: String(err) });
        return { success: false, message: `Erreur Azure: ${String(err)}` };
    }
}
//# sourceMappingURL=azureService.js.map