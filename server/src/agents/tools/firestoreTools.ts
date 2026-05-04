import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { Timestamp } from 'firebase-admin/firestore';

function toDate(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp || v instanceof Date) out[k] = toDate(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = sanitize(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

// ── Get documents for a company ───────────────────────────────────────────────
export const getDocumentsTool = ai.defineTool(
  {
    name: 'getDocuments',
    description: 'List indexed documents for the company. Returns metadata (name, type, status, chunks).',
    inputSchema: z.object({
      companyId: z.string(),
      limit:     z.number().optional().default(20),
      status:    z.enum(['completed', 'processing', 'failed', 'all']).optional().default('completed'),
    }),
    outputSchema: z.object({
      documents: z.array(z.object({
        id:           z.string(),
        originalName: z.string(),
        fileType:     z.string(),
        status:       z.string(),
        chunksCreated: z.number().optional(),
        uploadedAt:   z.string(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, limit, status }) => {
    if (!companyId) throw new Error('companyId is required');
    const db = getFirestore();
    let query = db.collection('documents').where('companyId', '==', companyId);
    // Only add status filter if provided AND not 'all' — prevents `undefined` from hitting .where()
    if (status && status !== 'all') query = query.where('status', '==', status) as typeof query;

    const snap = await query.limit(Math.floor(Number(limit) || 20)).get();
    const documents = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id:            doc.id,
          originalName:  (d['originalName'] as string) ?? '',
          fileType:      (d['fileType'] as string) ?? '',
          status:        (d['status'] as string) ?? '',
          chunksCreated: (d['chunksCreated'] as number | undefined),
          uploadedAt:    toDate(d['uploadedAt']),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return { documents, total: snap.size };
  }
);

// ── Get conversations ─────────────────────────────────────────────────────────
export const getConversationsTool = ai.defineTool(
  {
    name: 'getConversations',
    description: 'List recent conversations for the company.',
    inputSchema: z.object({
      companyId: z.string(),
      limit:     z.number().optional().default(10),
    }),
    outputSchema: z.object({
      conversations: z.array(z.object({
        id:           z.string(),
        title:        z.string(),
        messageCount: z.number(),
        updatedAt:    z.string(),
      })),
    }),
  },
  async ({ companyId, limit }) => {
    const db = getFirestore();
    const snap = await db.collection('conversations')
      .where('companyId', '==', companyId)
      .orderBy('updatedAt', 'desc')
      .limit(Math.floor(Number(limit) || 20))
      .get();

    const conversations = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id:           doc.id,
        title:        (d['title'] as string) ?? 'Untitled',
        messageCount: (d['messageCount'] as number) ?? 0,
        updatedAt:    toDate(d['updatedAt']),
      };
    });
    return { conversations };
  }
);

// ── Get meetings ──────────────────────────────────────────────────────────────
export const getMeetingsTool = ai.defineTool(
  {
    name: 'getMeetings',
    description: 'List meetings for the company. Includes transcription status and summaries.',
    inputSchema: z.object({
      companyId:     z.string(),
      limit:         z.number().optional().default(10),
      hasTranscript: z.boolean().optional(),
    }),
    outputSchema: z.object({
      meetings: z.array(z.object({
        id:          z.string(),
        title:       z.string(),
        date:        z.string(),
        status:      z.string(),
        hasTranscript: z.boolean(),
        summary:     z.string().optional(),
        topics:      z.array(z.string()).optional(),
      })),
    }),
  },
  async ({ companyId, limit, hasTranscript }) => {
    const db = getFirestore();
    let query = db.collection('meetings').where('companyId', '==', companyId);
    if (hasTranscript !== undefined) query = query.where('hasTranscript', '==', hasTranscript) as typeof query;

    const snap = await query.orderBy('date', 'desc').limit(Math.floor(Number(limit) || 20)).get();
    const meetings = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id:           doc.id,
        title:        (d['title'] as string) ?? '',
        date:         toDate(d['date']),
        status:       (d['status'] as string) ?? '',
        hasTranscript: (d['hasTranscript'] as boolean) ?? false,
        summary:      (d['summary'] as string | undefined),
        topics:       (d['topics'] as string[] | undefined),
      };
    });
    return { meetings };
  }
);

// ── Get employees ─────────────────────────────────────────────────────────────
export const getEmployeesTool = ai.defineTool(
  {
    name: 'getEmployees',
    description: 'List enrolled employees with face recognition status.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      employees: z.array(z.object({
        id:         z.string(),
        name:       z.string(),
        role:       z.string(),
        department: z.string(),
        enrolled:   z.boolean(),
      })),
      totalEnrolled: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection('employees').where('companyId', '==', companyId).get();
    const employees = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id:         doc.id,
        name:       (d['name'] as string) ?? '',
        role:       (d['role'] as string) ?? '',
        department: (d['department'] as string) ?? '',
        enrolled:   !!(d['faceDescriptor']),
      };
    });
    return {
      employees,
      totalEnrolled: employees.filter((e) => e.enrolled).length,
    };
  }
);

// ── Save to Firestore ─────────────────────────────────────────────────────────
export const saveInsightTool = ai.defineTool(
  {
    name: 'saveInsight',
    description: 'Persist a generated insight to Firestore for display in the dashboard.',
    inputSchema: z.object({
      companyId: z.string(),
      type:      z.enum(['trend', 'anomaly', 'recommendation', 'alert']),
      title:     z.string(),
      body:      z.string(),
      priority:  z.enum(['low', 'medium', 'high']),
      source:    z.string().optional(),
    }),
    outputSchema: z.object({ id: z.string() }),
  },
  async (insight) => {
    const db = getFirestore();
    const ref = await db.collection('insights').add({
      ...insight,
      createdAt: new Date(),
      read: false,
    });
    return { id: ref.id };
  }
);

// ── Read document content ─────────────────────────────────────────────────────
export const readDocumentTool = ai.defineTool(
  {
    name: 'readDocument',
    description: 'Read the full text content of a specific document by name or ID. Use when user asks to read, summarize, or analyze a specific document.',
    inputSchema: z.object({
      companyId: z.string(),
      documentName: z.string().optional().describe('Document name or partial name to search'),
      documentId: z.string().optional().describe('Document ID if known'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      name: z.string(),
      content: z.string().describe('Extracted text content (max 8000 chars)'),
      classification: z.string().optional(),
      summary: z.string().optional(),
    }),
  },
  async ({ companyId, documentName, documentId }) => {
    try {
      const db = getFirestore();

      let doc;
      if (documentId) {
        doc = await db.collection('documents').doc(documentId).get();
      } else if (documentName) {
        // Search by name
        const snap = await db.collection('documents').where('companyId', '==', companyId).limit(50).get();
        const search = documentName.toLowerCase();
        doc = snap.docs.find(d => {
          const name = ((d.data()['originalName'] as string) ?? '').toLowerCase();
          return name.includes(search);
        });
      }

      if (!doc || (doc && 'exists' in doc && !doc.exists)) {
        return { found: false, name: '', content: 'Document non trouvé.', classification: undefined, summary: undefined };
      }

      const data = doc.data?.() ?? (doc as FirebaseFirestore.QueryDocumentSnapshot).data();
      const docId = ('id' in doc ? doc.id : (doc as FirebaseFirestore.QueryDocumentSnapshot).id) as string;
      let content = (data['extractedText'] as string) ?? '';

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
              .sort((a, b) => ((a['chunkIndex'] as number) ?? 0) - ((b['chunkIndex'] as number) ?? 0));
            content = sorted.map(d => (d['text'] as string) ?? '').join('\n\n');
          }
        } catch { /* ignore and fall through */ }
      }

      // Final fallback: legacy top-level chunks collection (pre-migration)
      if (!content) {
        try {
          const chunksSnap = await db.collection('chunks')
            .where('documentId', '==', docId)
            .limit(20)
            .get();
          if (!chunksSnap.empty) {
            content = chunksSnap.docs.map(c => (c.data()['text'] as string) ?? '').join(' ');
          }
        } catch { /* ignore */ }
      }

      if (!content) {
        content = 'Contenu non disponible (document non encore extrait). Veuillez re-uploader le document.';
      }

      return {
        found: true,
        name: (data['originalName'] as string) ?? '',
        content: content.slice(0, 8000),
        classification: (data['classification'] as string) ?? undefined,
        summary: (data['summary'] as string) ?? undefined,
      };
    } catch {
      return { found: false, name: '', content: 'Erreur lors de la lecture.', classification: undefined, summary: undefined };
    }
  }
);

// ── Edit document content ─────────────────────────────────────────────────────
export const editDocumentTool = ai.defineTool(
  {
    name: 'editDocument',
    description: 'Edit/correct a document. Can: fix spelling/grammar, rewrite sections, translate, add content, replace text. Use when user asks to correct, modify, rewrite, or improve a document.',
    inputSchema: z.object({
      companyId: z.string(),
      documentName: z.string().describe('Document name to search'),
      action: z.enum(['correct_grammar', 'rewrite_section', 'replace_text', 'translate', 'add_content', 'full_correction']).describe('Type of edit'),
      targetText: z.string().optional().describe('The specific text to find/replace (for replace_text)'),
      newText: z.string().optional().describe('The replacement text or new content'),
      language: z.string().optional().describe('Target language for translation'),
      instructions: z.string().optional().describe('Specific editing instructions from the user'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      originalLength: z.number().optional(),
      newLength: z.number().optional(),
      changes: z.string().optional().describe('Summary of changes made'),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();

      // Find document
      const snap = await db.collection('documents').where('companyId', '==', input.companyId).limit(50).get();
      const search = input.documentName.toLowerCase();
      const docSnap = snap.docs.find(d => {
        const name = ((d.data()['originalName'] as string) ?? '').toLowerCase();
        return name.includes(search);
      });

      if (!docSnap) return { success: false, message: 'Document non trouvé.' };

      const data = docSnap.data();
      const originalText = (data['extractedText'] as string) ?? '';
      if (!originalText) return { success: false, message: 'Le document n\'a pas de contenu textuel.' };

      let newText = originalText;
      let changesSummary = '';

      if (input.action === 'replace_text' && input.targetText && input.newText) {
        // Direct text replacement
        newText = originalText.replace(input.targetText, input.newText);
        changesSummary = `Remplacé "${input.targetText.slice(0, 50)}" par "${input.newText.slice(0, 50)}"`;
      } else {
        // Use Gemini for intelligent editing
        const { ai: aiInstance, GEMINI_FLASH } = await import('../../config/genkit.config');

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
        editHistory: [...((data['editHistory'] as string[]) ?? []), `${new Date().toISOString()} — ${input.action}: ${changesSummary}`],
      });

      return {
        success: true,
        message: `Document "${data['originalName']}" modifié avec succès.`,
        originalLength: originalText.length,
        newLength: newText.length,
        changes: changesSummary,
      };
    } catch (err) {
      return { success: false, message: `Erreur: ${(err as Error).message}` };
    }
  }
);
