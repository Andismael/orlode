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
exports.editDocumentTool = exports.readDocumentTool = exports.saveInsightTool = exports.getEmployeesTool = exports.getMeetingsTool = exports.getConversationsTool = exports.getDocumentsTool = void 0;
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
function toDate(val) {
    if (val instanceof firestore_1.Timestamp)
        return val.toDate().toISOString();
    if (val instanceof Date)
        return val.toISOString();
    return String(val);
}
function sanitize(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (v instanceof firestore_1.Timestamp || v instanceof Date)
            out[k] = toDate(v);
        else if (v && typeof v === 'object' && !Array.isArray(v))
            out[k] = sanitize(v);
        else
            out[k] = v;
    }
    return out;
}
// ── Get documents for a company ───────────────────────────────────────────────
exports.getDocumentsTool = genkit_config_1.ai.defineTool({
    name: 'getDocuments',
    description: 'List indexed documents for the company. Returns metadata (name, type, status, chunks).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        limit: zod_1.z.number().optional().default(20),
        status: zod_1.z.enum(['completed', 'processing', 'failed', 'all']).optional().default('completed'),
    }),
    outputSchema: zod_1.z.object({
        documents: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            originalName: zod_1.z.string(),
            fileType: zod_1.z.string(),
            status: zod_1.z.string(),
            chunksCreated: zod_1.z.number().optional(),
            uploadedAt: zod_1.z.string(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, limit, status }) => {
    if (!companyId)
        throw new Error('companyId is required');
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection('documents').where('companyId', '==', companyId);
    // Only add status filter if provided AND not 'all' — prevents `undefined` from hitting .where()
    if (status && status !== 'all')
        query = query.where('status', '==', status);
    const snap = await query.limit(Math.floor(Number(limit) || 20)).get();
    const documents = snap.docs
        .map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            originalName: d['originalName'] ?? '',
            fileType: d['fileType'] ?? '',
            status: d['status'] ?? '',
            chunksCreated: d['chunksCreated'],
            uploadedAt: toDate(d['uploadedAt']),
        };
    })
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return { documents, total: snap.size };
});
// ── Get conversations ─────────────────────────────────────────────────────────
exports.getConversationsTool = genkit_config_1.ai.defineTool({
    name: 'getConversations',
    description: 'List recent conversations for the company.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        limit: zod_1.z.number().optional().default(10),
    }),
    outputSchema: zod_1.z.object({
        conversations: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            title: zod_1.z.string(),
            messageCount: zod_1.z.number(),
            updatedAt: zod_1.z.string(),
        })),
    }),
}, async ({ companyId, limit }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('conversations')
        .where('companyId', '==', companyId)
        .orderBy('updatedAt', 'desc')
        .limit(Math.floor(Number(limit) || 20))
        .get();
    const conversations = snap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            title: d['title'] ?? 'Untitled',
            messageCount: d['messageCount'] ?? 0,
            updatedAt: toDate(d['updatedAt']),
        };
    });
    return { conversations };
});
// ── Get meetings ──────────────────────────────────────────────────────────────
exports.getMeetingsTool = genkit_config_1.ai.defineTool({
    name: 'getMeetings',
    description: 'List meetings for the company. Includes transcription status and summaries.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        limit: zod_1.z.number().optional().default(10),
        hasTranscript: zod_1.z.boolean().optional(),
    }),
    outputSchema: zod_1.z.object({
        meetings: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            title: zod_1.z.string(),
            date: zod_1.z.string(),
            status: zod_1.z.string(),
            hasTranscript: zod_1.z.boolean(),
            summary: zod_1.z.string().optional(),
            topics: zod_1.z.array(zod_1.z.string()).optional(),
        })),
    }),
}, async ({ companyId, limit, hasTranscript }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection('meetings').where('companyId', '==', companyId);
    if (hasTranscript !== undefined)
        query = query.where('hasTranscript', '==', hasTranscript);
    const snap = await query.orderBy('date', 'desc').limit(Math.floor(Number(limit) || 20)).get();
    const meetings = snap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            title: d['title'] ?? '',
            date: toDate(d['date']),
            status: d['status'] ?? '',
            hasTranscript: d['hasTranscript'] ?? false,
            summary: d['summary'],
            topics: d['topics'],
        };
    });
    return { meetings };
});
// ── Get employees ─────────────────────────────────────────────────────────────
exports.getEmployeesTool = genkit_config_1.ai.defineTool({
    name: 'getEmployees',
    description: 'List enrolled employees with face recognition status.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        employees: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            role: zod_1.z.string(),
            department: zod_1.z.string(),
            enrolled: zod_1.z.boolean(),
        })),
        totalEnrolled: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('employees').where('companyId', '==', companyId).get();
    const employees = snap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            name: d['name'] ?? '',
            role: d['role'] ?? '',
            department: d['department'] ?? '',
            enrolled: !!(d['faceDescriptor']),
        };
    });
    return {
        employees,
        totalEnrolled: employees.filter((e) => e.enrolled).length,
    };
});
// ── Save to Firestore ─────────────────────────────────────────────────────────
exports.saveInsightTool = genkit_config_1.ai.defineTool({
    name: 'saveInsight',
    description: 'Persist a generated insight to Firestore for display in the dashboard.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        type: zod_1.z.enum(['trend', 'anomaly', 'recommendation', 'alert']),
        title: zod_1.z.string(),
        body: zod_1.z.string(),
        priority: zod_1.z.enum(['low', 'medium', 'high']),
        source: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ id: zod_1.z.string() }),
}, async (insight) => {
    const db = (0, firebase_config_1.getFirestore)();
    const ref = await db.collection('insights').add({
        ...insight,
        createdAt: new Date(),
        read: false,
    });
    return { id: ref.id };
});
// ── Read document content ─────────────────────────────────────────────────────
exports.readDocumentTool = genkit_config_1.ai.defineTool({
    name: 'readDocument',
    description: 'Read the full text content of a specific document by name or ID. Use when user asks to read, summarize, or analyze a specific document.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentName: zod_1.z.string().optional().describe('Document name or partial name to search'),
        documentId: zod_1.z.string().optional().describe('Document ID if known'),
    }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        name: zod_1.z.string(),
        content: zod_1.z.string().describe('Extracted text content (max 8000 chars)'),
        classification: zod_1.z.string().optional(),
        summary: zod_1.z.string().optional(),
    }),
}, async ({ companyId, documentName, documentId }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let doc;
        if (documentId) {
            doc = await db.collection('documents').doc(documentId).get();
        }
        else if (documentName) {
            // Search by name
            const snap = await db.collection('documents').where('companyId', '==', companyId).limit(50).get();
            const search = documentName.toLowerCase();
            doc = snap.docs.find(d => {
                const name = (d.data()['originalName'] ?? '').toLowerCase();
                return name.includes(search);
            });
        }
        if (!doc || (doc && 'exists' in doc && !doc.exists)) {
            return { found: false, name: '', content: 'Document non trouvé.', classification: undefined, summary: undefined };
        }
        const data = doc.data?.() ?? doc.data();
        const docId = ('id' in doc ? doc.id : doc.id);
        let content = data['extractedText'] ?? '';
        // Fallback: reconstruct from vectorChunks sub-collection if extractedText is missing
        if (!content) {
            try {
                const chunksSnap = await db.collection(`companies/${companyId}/vectorChunks`)
                    .where('documentId', '==', docId)
                    .limit(30)
                    .get();
                if (!chunksSnap.empty) {
                    // Sort by chunkIndex in memory (avoids composite index requirement)
                    const sorted = chunksSnap.docs
                        .map(c => c.data())
                        .sort((a, b) => (a['chunkIndex'] ?? 0) - (b['chunkIndex'] ?? 0));
                    content = sorted.map(d => d['text'] ?? '').join('\n\n');
                }
            }
            catch { /* ignore and fall through */ }
        }
        // Final fallback: legacy top-level chunks collection (pre-migration)
        if (!content) {
            try {
                const chunksSnap = await db.collection('chunks')
                    .where('documentId', '==', docId)
                    .limit(20)
                    .get();
                if (!chunksSnap.empty) {
                    content = chunksSnap.docs.map(c => c.data()['text'] ?? '').join(' ');
                }
            }
            catch { /* ignore */ }
        }
        if (!content) {
            content = 'Contenu non disponible (document non encore extrait). Veuillez re-uploader le document.';
        }
        return {
            found: true,
            name: data['originalName'] ?? '',
            content: content.slice(0, 8000),
            classification: data['classification'] ?? undefined,
            summary: data['summary'] ?? undefined,
        };
    }
    catch {
        return { found: false, name: '', content: 'Erreur lors de la lecture.', classification: undefined, summary: undefined };
    }
});
// ── Edit document content ─────────────────────────────────────────────────────
exports.editDocumentTool = genkit_config_1.ai.defineTool({
    name: 'editDocument',
    description: 'Edit/correct a document. Can: fix spelling/grammar, rewrite sections, translate, add content, replace text. Use when user asks to correct, modify, rewrite, or improve a document.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentName: zod_1.z.string().describe('Document name to search'),
        action: zod_1.z.enum(['correct_grammar', 'rewrite_section', 'replace_text', 'translate', 'add_content', 'full_correction']).describe('Type of edit'),
        targetText: zod_1.z.string().optional().describe('The specific text to find/replace (for replace_text)'),
        newText: zod_1.z.string().optional().describe('The replacement text or new content'),
        language: zod_1.z.string().optional().describe('Target language for translation'),
        instructions: zod_1.z.string().optional().describe('Specific editing instructions from the user'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string(),
        originalLength: zod_1.z.number().optional(),
        newLength: zod_1.z.number().optional(),
        changes: zod_1.z.string().optional().describe('Summary of changes made'),
    }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Find document
        const snap = await db.collection('documents').where('companyId', '==', input.companyId).limit(50).get();
        const search = input.documentName.toLowerCase();
        const docSnap = snap.docs.find(d => {
            const name = (d.data()['originalName'] ?? '').toLowerCase();
            return name.includes(search);
        });
        if (!docSnap)
            return { success: false, message: 'Document non trouvé.' };
        const data = docSnap.data();
        const originalText = data['extractedText'] ?? '';
        if (!originalText)
            return { success: false, message: 'Le document n\'a pas de contenu textuel.' };
        let newText = originalText;
        let changesSummary = '';
        if (input.action === 'replace_text' && input.targetText && input.newText) {
            // Direct text replacement
            newText = originalText.replace(input.targetText, input.newText);
            changesSummary = `Remplacé "${input.targetText.slice(0, 50)}" par "${input.newText.slice(0, 50)}"`;
        }
        else {
            // Use Gemini for intelligent editing
            const { ai: aiInstance, GEMINI_FLASH } = await Promise.resolve().then(() => __importStar(require('../../config/genkit.config')));
            const editPrompt = input.action === 'correct_grammar'
                ? `Corrige TOUTES les fautes d'orthographe, de grammaire et de ponctuation dans ce texte. Garde le même sens et la même structure. Retourne UNIQUEMENT le texte corrigé, rien d'autre.\n\nTexte:\n${originalText.slice(0, 15000)}`
                : input.action === 'full_correction'
                    ? `Corrige et améliore ce document : orthographe, grammaire, clarté, mise en forme. ${input.instructions ?? ''}. Retourne UNIQUEMENT le texte corrigé.\n\nTexte:\n${originalText.slice(0, 15000)}`
                    : input.action === 'translate'
                        ? `Traduis ce texte en ${input.language ?? 'anglais'}. Retourne UNIQUEMENT la traduction.\n\nTexte:\n${originalText.slice(0, 15000)}`
                        : input.action === 'rewrite_section'
                            ? `Réécris/améliore cette section du document selon ces instructions: ${input.instructions ?? 'améliorer la clarté'}. Retourne UNIQUEMENT le texte réécrit.\n\nTexte:\n${(input.targetText ?? originalText).slice(0, 15000)}`
                            : input.action === 'add_content'
                                ? `Ajoute le contenu suivant au document de manière cohérente: ${input.newText ?? input.instructions ?? ''}. Retourne le document complet avec l'ajout.\n\nDocument:\n${originalText.slice(0, 12000)}`
                                : `Édite ce document: ${input.instructions}.\n\nTexte:\n${originalText.slice(0, 15000)}`;
            const result = await aiInstance.generate({
                model: GEMINI_FLASH,
                prompt: editPrompt,
                config: { temperature: 0.2 },
            });
            newText = result.text.trim();
            changesSummary = `${input.action} effectué par IA`;
        }
        // Save edited document
        await docSnap.ref.update({
            extractedText: newText,
            lastEditedAt: new Date(),
            lastEditAction: input.action,
            editHistory: [...(data['editHistory'] ?? []), `${new Date().toISOString()} — ${input.action}: ${changesSummary}`],
        });
        return {
            success: true,
            message: `Document "${data['originalName']}" modifié avec succès.`,
            originalLength: originalText.length,
            newLength: newText.length,
            changes: changesSummary,
        };
    }
    catch (err) {
        return { success: false, message: `Erreur: ${err.message}` };
    }
});
//# sourceMappingURL=firestoreTools.js.map