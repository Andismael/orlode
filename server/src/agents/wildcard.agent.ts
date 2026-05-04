/**
 * Wildcard Agent — Gemini Flash
 * Agent universel. Filet de sécurité quand aucun agent spécialisé ne convient.
 * Accès à tous les tools de tous les agents.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { logger } from '../utils/logger';

// Import tools from all agents
import { searchDocumentsTool, summarizeDocumentTool } from './tools/ragTools';
import { getDocumentsTool, getConversationsTool, getMeetingsTool, getEmployeesTool } from './tools/firestoreTools';
import { createTicketTool as ticketCreateTool, getAssetsTool as inventoryTool, getServicesTool as systemStatusTool } from './it.agent';
import { securityScoreTool, incidentResponseTool } from './cybersecurity.agent';
import { generatePostTool as postGeneratorTool, getCalendarTool as contentCalendarTool, getStatsTool as analyticsReportTool, writeContentTool as articleWriterTool } from './marketing.agent';

// ── Tool list ─────────────────────────────────────────────────────────────────

const WILDCARD_TOOLS = [
  // Knowledge
  searchDocumentsTool,
  summarizeDocumentTool,
  // Data lookups
  getDocumentsTool,
  getConversationsTool,
  getMeetingsTool,
  getEmployeesTool,
  // IT
  ticketCreateTool,
  inventoryTool,
  systemStatusTool,
  // Security
  securityScoreTool,
  incidentResponseTool,
  // Marketing
  postGeneratorTool,
  contentCalendarTool,
  analyticsReportTool,
  articleWriterTool,
];

const WILDCARD_EXECUTORS = new Map<string, (i: unknown) => Promise<unknown>>([
  ['searchDocuments',        (i) => searchDocumentsTool(i as Parameters<typeof searchDocumentsTool>[0])],
  ['summarizeDocument',      (i) => summarizeDocumentTool(i as Parameters<typeof summarizeDocumentTool>[0])],
  ['getDocuments',           (i) => getDocumentsTool(i as Parameters<typeof getDocumentsTool>[0])],
  ['getConversations',       (i) => getConversationsTool(i as Parameters<typeof getConversationsTool>[0])],
  ['getMeetings',            (i) => getMeetingsTool(i as Parameters<typeof getMeetingsTool>[0])],
  ['getEmployees',           (i) => getEmployeesTool(i as Parameters<typeof getEmployeesTool>[0])],
  ['it_createTicket',        (i) => ticketCreateTool(i as Parameters<typeof ticketCreateTool>[0])],
  ['it_getInventory',        (i) => inventoryTool(i as Parameters<typeof inventoryTool>[0])],
  ['it_systemStatus',        (i) => systemStatusTool(i as Parameters<typeof systemStatusTool>[0])],
  ['sec_getSecurityScore',   (i) => securityScoreTool(i as Parameters<typeof securityScoreTool>[0])],
  ['sec_reportIncident',     (i) => incidentResponseTool(i as Parameters<typeof incidentResponseTool>[0])],
  ['mkt_generatePost',       (i) => postGeneratorTool(i as Parameters<typeof postGeneratorTool>[0])],
  ['mkt_getContentCalendar', (i) => contentCalendarTool(i as Parameters<typeof contentCalendarTool>[0])],
  ['mkt_getAnalyticsReport', (i) => analyticsReportTool(i as Parameters<typeof analyticsReportTool>[0])],
  ['mkt_writeArticle',       (i) => articleWriterTool(i as Parameters<typeof articleWriterTool>[0])],
]);

// ── Flow ──────────────────────────────────────────────────────────────────────

const INPUT = z.object({
  request:   z.string(),
  companyId: z.string(),
  userId:    z.string().optional(),
  language:  z.string().optional().default('auto'),
  history:   z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  response:   z.string(),
  toolsUsed:  z.array(z.string()),
});

export const wildcardAgentFlow = ai.defineFlow(
  { name: 'wildcardAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    try {
      logger.info(`[WildcardAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
      const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

      const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
      })();

      const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
      if (history && history.length > 0) {
        for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
      }
      messages.push({ role: 'user', content: [{ text: request }] });

      let response = await ai.generate({
        model: GEMINI_FLASH,
        system: `Tu es le Wildcard Agent — couteau suisse universel de Orlode.
Tu gères TOUTE tâche qui ne correspond pas à un agent spécialisé.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour toute tâche impliquant une date / planification / recherche temporelle, utilise cette ancre.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages précédents. Quand l'utilisateur dit "ça", "ce ticket", "lui", référence-toi à l'élément le plus récent. Ne repars PAS à zéro si le contexte est clair.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS prétendre avoir fait une action sans appel d'outil réussi.
INTERDIT :
- Pretendre avoir routé vers un agent qui n'existe pas
- Affirmer une action faite sans tool
- Inventer un résultat de tool
RÈGLE : APPELLE le tool. Si succès → confirme avec les vrais champs. Si échec → dis la vraie raison. L'utilisateur préfère "je n'ai pas pu" honnête à une fausse confirmation.

GARDE-FOUS (IMPORTANT) :
1. READ-ONLY par défaut — préfère lire/chercher/lister plutôt que créer/modifier
2. MODE SUGGESTION — pour les actions d'écriture, PROPOSE l'action d'abord :
   "Je propose de créer un ticket IT pour ce problème. Voulez-vous que je continue ?"
   N'auto-exécute PAS les opérations d'écriture sans les formuler comme suggestion.
3. PAS D'ACTIONS CRITIQUES — jamais supprimer de données, jamais envoyer d'emails sans confirmation, jamais modifier les paramètres de sécurité
4. TOUJOURS LOGGUER — mentionne les tools utilisés dans ta réponse
5. Si incertain, demande clarification plutôt que deviner

Tu as accès aux tools de TOUS les départements : Documents, IT, Sécurité, Marketing, Data.
Sois ingénieux mais SÛR. Propose, n'impose pas.
${langInstr}`,
        messages,
        tools:  WILDCARD_TOOLS as never,
        config: { temperature: 0.5 },
      });

      const toolsUsed: string[] = [];
      let loopCount = 0;

      while (response.toolRequests.length > 0 && loopCount < 8) {
        loopCount++;
        const toolResults = await Promise.all(
          response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            toolsUsed.push(name);
            const exec = WILDCARD_EXECUTORS.get(name);
            const inp = { ...(input as Record<string, unknown>), companyId };
            const output = exec ? await exec(inp) : { error: `Unknown tool: ${name}` };
            return { name, ref, output };
          })
        );
        response = await ai.generate({
          model: GEMINI_FLASH,
          messages: [
            ...response.messages,
            { role: 'tool' as const, content: toolResults.map((r) => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
          ],
          tools:  WILDCARD_TOOLS as never,
          config: { temperature: 0.5 },
        });
      }

      // PRO: Log wildcard usage for audit
      if (toolsUsed.length > 0) {
        try {
          const db = getFirestore();
          const { generateId } = await import('../utils/helpers');
          await db.collection(`companies/${companyId}/wildcardLogs`).doc(generateId()).set({
            request: request.slice(0, 200), toolsUsed: [...new Set(toolsUsed)],
            userId: userId ?? null, timestamp: new Date(),
          });
        } catch {}
      }

      return { response: response.text, toolsUsed: [...new Set(toolsUsed)] };
    } catch (err) {
      logger.error('[WildcardAgent] Flow error:', err);
      return { response: 'An error occurred in the wildcard agent. Please try again.', toolsUsed: [] };
    }
  }
);

export const wildcardAgentTool = ai.defineTool(
  {
    name: 'callWildcardAgent',
    description: 'Wildcard PRO: universal agent with guardrails (read-only default, suggestion mode for writes, mandatory logging). Multi-department fallback.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  async (input) => {
    try {
      return await wildcardAgentFlow(input);
    } catch (err) {
      logger.error('[callWildcardAgent] Error:', err);
      return { response: 'An error occurred in the wildcard agent. Please try again.', toolsUsed: [] };
    }
  }
);
