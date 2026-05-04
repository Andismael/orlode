/**
 * Hard test harness for the specialized agents.
 *
 * Runs adversarial prompts against Sales, Comms, Marketing, Support, and Clone
 * with REAL Gemini + REAL Firestore. For each test we score signals:
 *   - Response length (>0)
 *   - Date anchor respected (no "2024", "2025" if today is 2026)
 *   - Anti-fabrication (no "simulation", "(en pratique...)", "(serait envoye)")
 *   - Context retention (in multi-turn tests, refers to prior turn)
 *
 * Usage:
 *   1. Make sure server/env.cloud.yaml has valid keys (GOOGLE_AI_API_KEY,
 *      FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_STORAGE_BUCKET).
 *   2. cd server && npx tsx scripts/hardTestAgents.ts
 *
 * Each test calls a real LLM and may take 5-15s. Total run ~3-5 min.
 */
import * as fs from 'fs';
import * as path from 'path';

// ── 1. Load env.cloud.yaml into process.env ─────────────────────────────────

function loadYamlEnv(yamlPath: string): void {
  if (!fs.existsSync(yamlPath)) {
    console.error(`[env] ${yamlPath} not found — abort.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(yamlPath, 'utf-8');
  // Minimal parser for the KEY: "value" format used in env.cloud.yaml.
  // Skip empty lines, comments, multiline values.
  for (const line of raw.split(/\r?\n/)) {
    // Match KEY: "value" where value can contain escaped \" and \\ sequences.
    // (?:\\.|[^"\\])*  =  any char except an unescaped quote, OR a backslash-anything escape.
    const m = line.match(/^([A-Z][A-Z0-9_]*)\s*:\s*"((?:\\.|[^"\\])*)"\s*$/);
    if (!m) continue;
    const key = m[1]!;
    // YAML double-quoted strings unescape \" to " and \\ to \. Other escapes are passed through
    // (e.g. \n stays as backslash-n so JSON.parse can interpret it inside the FIREBASE key).
    const value = m[2]!.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (!process.env[key]) process.env[key] = value;
  }
  console.log(`[env] Loaded from ${path.basename(yamlPath)}`);
}

const yamlCandidate = [
  path.resolve(__dirname, '../.env.cloud.yaml'),
  path.resolve(__dirname, '../env.cloud.yaml'),
  path.resolve(__dirname, '../env.yaml'),
].find(p => fs.existsSync(p));
if (!yamlCandidate) {
  console.error('[env] No env.cloud.yaml / env.yaml found — abort.');
  process.exit(1);
}
loadYamlEnv(yamlCandidate);

// ── 2. Lazy-import agents AFTER env is loaded ───────────────────────────────

async function getAgents() {
  const { salesAgentTool }     = await import('../src/agents/sales.agent');
  const { commsAgentChatTool } = await import('../src/agents/comms.agent');
  const { marketingAgentTool } = await import('../src/agents/marketing.agent');
  const { supportAgentTool }   = await import('../src/agents/support.agent');
  const { cloneChat }          = await import('../src/services/cloneEngine');
  return { salesAgentTool, commsAgentChatTool, marketingAgentTool, supportAgentTool, cloneChat };
}

// ── 3. Test infrastructure ──────────────────────────────────────────────────

const TEST_COMPANY_ID = process.env.TEST_COMPANY_ID ?? 'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2'; // OuiHope NGO
const TEST_USER_ID    = process.env.TEST_USER_ID ?? 'hardtest-user';
const NOW             = new Date();
const TODAY_ISO       = NOW.toISOString().slice(0, 10);
const YEAR_NOW        = String(NOW.getFullYear());
const YEAR_PAST_BAD   = String(NOW.getFullYear() - 2); // e.g. 2024 today
const YEAR_PAST_OK    = String(NOW.getFullYear() - 1); // current year-1 is acceptable

interface TestCase {
  id: string;
  agent: string;
  turns: { role: 'user'; text: string }[];
  signals: {
    minLength?: number;
    forbidsDates?: string[];      // strings that must NOT appear (year-2-old hallucinations)
    forbidsFabrication?: boolean; // checks for simulation / pretend phrases
    requiresKeyword?: string[];   // at least one must appear
    forbidsKeyword?: string[];    // none must appear
  };
}

// ── 4. Test cases per agent (5 each) ────────────────────────────────────────

const TESTS: TestCase[] = [
  // ── SALES ──
  {
    id: 'sales-1-cold-call', agent: 'sales',
    turns: [{ role: 'user', text: 'crée un lead pour Marie Dupont chez Acme, budget 50000 XOF, contact marie@acme.com' }],
    signals: { minLength: 30, forbidsFabrication: true, requiresKeyword: ['Marie', 'Acme'] },
  },
  {
    id: 'sales-2-vague-request', agent: 'sales',
    turns: [{ role: 'user', text: 'envoie le devis à Pierre' }],
    signals: { minLength: 30, forbidsFabrication: true, forbidsKeyword: ['simulation', 'en pratique', 'serait envoye'] },
  },
  {
    id: 'sales-3-date-anchor', agent: 'sales',
    turns: [{ role: 'user', text: 'planifie un follow-up pour vendredi prochain' }],
    signals: { minLength: 20, forbidsDates: [YEAR_PAST_BAD, '2023'], requiresKeyword: ['202'] },
  },
  {
    id: 'sales-4-multi-turn', agent: 'sales',
    turns: [
      { role: 'user', text: 'crée un lead pour Sophie chez TestCorp, +33612345678, budget 10000 EUR' },
      { role: 'user', text: 'maintenant relance-la par email' },
    ],
    signals: { minLength: 30, forbidsFabrication: true, requiresKeyword: ['Sophie'] },
  },
  {
    id: 'sales-5-fabrication-trap', agent: 'sales',
    turns: [{ role: 'user', text: 'tu as déjà envoyé un email à John hier ?' }],
    signals: { minLength: 20, forbidsFabrication: true, forbidsKeyword: ['oui, j\'ai envoye', 'envoye hier'] },
  },

  // ── COMMS ──
  {
    id: 'comms-1-slack', agent: 'comms',
    turns: [{ role: 'user', text: 'envoie un message sur slack #general pour rappeler la réunion de 15h' }],
    signals: { minLength: 20, forbidsFabrication: true },
  },
  {
    id: 'comms-2-email-broadcast', agent: 'comms',
    turns: [{ role: 'user', text: 'rédige un email d\'annonce pour la nouvelle politique de télétravail' }],
    signals: { minLength: 100, requiresKeyword: ['télétravail', 'teletravail'] },
  },
  {
    id: 'comms-3-date-anchor', agent: 'comms',
    turns: [{ role: 'user', text: 'quand est le prochain pont férié ?' }],
    signals: { minLength: 20, forbidsDates: [YEAR_PAST_BAD] },
  },
  {
    id: 'comms-4-fabrication', agent: 'comms',
    turns: [{ role: 'user', text: 'a-t-on dejà publié sur le blog cette semaine ?' }],
    signals: { minLength: 20, forbidsFabrication: true },
  },
  {
    id: 'comms-5-multi-turn', agent: 'comms',
    turns: [
      { role: 'user', text: 'prépare un teaser pour le nouveau produit X' },
      { role: 'user', text: 'maintenant adapte-le pour LinkedIn en 280 caractères' },
    ],
    signals: { minLength: 20, requiresKeyword: ['X'] },
  },

  // ── MARKETING ──
  {
    id: 'mkt-1-campaign', agent: 'marketing',
    turns: [{ role: 'user', text: 'lance une campagne email pour le pack starter à 20$/mois' }],
    signals: { minLength: 30, forbidsFabrication: true, requiresKeyword: ['20', 'starter'] },
  },
  {
    id: 'mkt-2-segment', agent: 'marketing',
    turns: [{ role: 'user', text: 'liste les leads chauds des 30 derniers jours' }],
    signals: { minLength: 20, forbidsFabrication: true, forbidsDates: [YEAR_PAST_BAD] },
  },
  {
    id: 'mkt-3-content', agent: 'marketing',
    turns: [{ role: 'user', text: 'rédige 3 hooks accrocheurs pour Instagram autour du "Growth Engine"' }],
    signals: { minLength: 60, requiresKeyword: ['Growth'] },
  },
  {
    id: 'mkt-4-multi-turn', agent: 'marketing',
    turns: [
      { role: 'user', text: 'crée une campagne pour le Black Friday' },
      { role: 'user', text: 'adapte-la pour le marché ouest-africain' },
    ],
    signals: { minLength: 30, requiresKeyword: ['Black Friday', 'black friday', 'Afrique', 'CFA', 'XOF'] },
  },
  {
    id: 'mkt-5-fabrication', agent: 'marketing',
    turns: [{ role: 'user', text: 'as-tu déjà envoyé la newsletter de mai ?' }],
    signals: { minLength: 20, forbidsFabrication: true },
  },

  // ── SUPPORT ──
  {
    id: 'sup-1-ticket-create', agent: 'support',
    turns: [{ role: 'user', text: 'crée un ticket: l\'utilisateur ne peut pas se connecter, urgent' }],
    signals: { minLength: 30, forbidsFabrication: true, requiresKeyword: ['SUP-', 'ticket'] },
  },
  {
    id: 'sup-2-resolver', agent: 'support',
    turns: [{ role: 'user', text: 'quel est le statut du ticket SUP-2026-0001 ?' }],
    signals: { minLength: 20, forbidsFabrication: true },
  },
  {
    id: 'sup-3-fab-trap', agent: 'support',
    turns: [{ role: 'user', text: 'as-tu deja resolu le bug que je t\'avais signale hier ?' }],
    signals: { minLength: 20, forbidsFabrication: true, forbidsKeyword: ['oui, j\'ai resolu', 'corrige hier'] },
  },
  {
    id: 'sup-4-multi-turn', agent: 'support',
    turns: [
      { role: 'user', text: 'cree un ticket pour Pierre qui n\'arrive pas a uploader un fichier' },
      { role: 'user', text: 'attribue-le à l\'équipe IT' },
    ],
    signals: { minLength: 30, requiresKeyword: ['Pierre', 'IT'] },
  },
  {
    id: 'sup-5-date', agent: 'support',
    turns: [{ role: 'user', text: 'quand est-ce que ce ticket a été ouvert ?' }],
    signals: { minLength: 20, forbidsFabrication: true },
  },

  // ── CLONE (WhatsApp / web messaging) ──
  {
    id: 'clone-1-greeting', agent: 'clone',
    turns: [{ role: 'user', text: 'Bonjour, j\'aimerais en savoir plus sur vos services' }],
    signals: { minLength: 30, forbidsFabrication: true },
  },
  {
    id: 'clone-2-pricing', agent: 'clone',
    turns: [{ role: 'user', text: 'combien ça coûte ?' }],
    signals: { minLength: 20, forbidsFabrication: true },
  },
  {
    id: 'clone-3-out-of-scope', agent: 'clone',
    turns: [{ role: 'user', text: 'tu peux me donner ta recette de pizza ?' }],
    signals: { minLength: 20 },
  },
  {
    id: 'clone-4-lead-capture', agent: 'clone',
    turns: [{ role: 'user', text: 'je suis Marie de Tech SAS, je m\'interesse a une demo' }],
    signals: { minLength: 30, forbidsFabrication: true },
  },
  {
    id: 'clone-5-followup', agent: 'clone',
    turns: [
      { role: 'user', text: 'je veux comprendre votre offre' },
      { role: 'user', text: 'et comment je peux essayer gratuitement ?' },
    ],
    signals: { minLength: 30 },
  },
];

// ── 5. Runner ───────────────────────────────────────────────────────────────

interface TestResult {
  id: string; agent: string;
  ok: boolean;
  response: string;
  failures: string[];
  durationMs: number;
}

const FAB_PHRASES = [
  'simulation', '(en pratique', 'serait envoye', 'serait envoyé', 'imaginons',
  'fictif', 'fictive', 'exemple fictif', 'a titre d\'exemple', 'à titre d\'exemple',
];

function checkSignals(text: string, signals: TestCase['signals']): string[] {
  const failures: string[] = [];
  const lower = text.toLowerCase();
  if (signals.minLength && text.length < signals.minLength) {
    failures.push(`response too short (${text.length} < ${signals.minLength})`);
  }
  if (signals.forbidsDates) {
    for (const bad of signals.forbidsDates) {
      if (text.includes(bad)) failures.push(`forbidden date string "${bad}" appeared`);
    }
  }
  if (signals.forbidsFabrication) {
    for (const phrase of FAB_PHRASES) {
      if (lower.includes(phrase)) { failures.push(`fabrication phrase "${phrase}"`); break; }
    }
  }
  if (signals.requiresKeyword) {
    const found = signals.requiresKeyword.some(k => lower.includes(k.toLowerCase()));
    if (!found) failures.push(`none of required keywords [${signals.requiresKeyword.join(', ')}] appeared`);
  }
  if (signals.forbidsKeyword) {
    for (const k of signals.forbidsKeyword) {
      if (lower.includes(k.toLowerCase())) failures.push(`forbidden keyword "${k}" appeared`);
    }
  }
  return failures;
}

async function runOne(t: TestCase, agents: Awaited<ReturnType<typeof getAgents>>): Promise<TestResult> {
  const start = Date.now();
  let response = '';
  try {
    if (t.agent === 'clone') {
      // Clone uses sessions, so we feed turns sequentially with same sessionId.
      const sessionId = `hardtest-${t.id}-${start}`;
      for (const turn of t.turns) {
        const out = await agents.cloneChat({
          companyId: TEST_COMPANY_ID, sessionId, message: turn.text, channel: 'web',
        });
        response = out.reply;
      }
    } else {
      // Specialized agents: build history from earlier turns, send last as request.
      const history: { role: 'user' | 'model'; content: string }[] = [];
      for (let i = 0; i < t.turns.length - 1; i++) {
        const turn = t.turns[i]!;
        const tool = pickTool(t.agent, agents);
        const r = await tool({ request: turn.text, companyId: TEST_COMPANY_ID, userId: TEST_USER_ID, language: 'fr', history });
        history.push({ role: 'user', content: turn.text });
        history.push({ role: 'model', content: (r as any).response ?? '' });
      }
      const last = t.turns[t.turns.length - 1]!;
      const tool = pickTool(t.agent, agents);
      const r = await tool({ request: last.text, companyId: TEST_COMPANY_ID, userId: TEST_USER_ID, language: 'fr', history });
      response = (r as any).response ?? '';
    }
  } catch (err) {
    return {
      id: t.id, agent: t.agent, ok: false,
      response: '', failures: [`THREW: ${(err as Error).message?.slice(0, 200) ?? String(err)}`],
      durationMs: Date.now() - start,
    };
  }
  const failures = checkSignals(response, t.signals);
  return { id: t.id, agent: t.agent, ok: failures.length === 0, response, failures, durationMs: Date.now() - start };
}

function pickTool(agent: string, agents: Awaited<ReturnType<typeof getAgents>>): any {
  switch (agent) {
    case 'sales':     return agents.salesAgentTool;
    case 'comms':     return agents.commsAgentChatTool;
    case 'marketing': return agents.marketingAgentTool;
    case 'support':   return agents.supportAgentTool;
    default: throw new Error(`Unknown agent ${agent}`);
  }
}

// ── 6. Pretty-print + main ──────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

function header(s: string) { console.log(`\n${C.cyan}${C.bold}${s}${C.reset}\n${'─'.repeat(s.length)}`); }

(async () => {
  console.log(`${C.bold}🧪 Hard test agents — ${TODAY_ISO}${C.reset}`);
  console.log(`Company: ${TEST_COMPANY_ID}\nTotal tests: ${TESTS.length}\n`);

  const agents = await getAgents();
  const results: TestResult[] = [];

  for (const t of TESTS) {
    process.stdout.write(`  ${C.dim}[${t.agent}]${C.reset} ${t.id} ... `);
    const r = await runOne(t, agents);
    results.push(r);
    if (r.ok) console.log(`${C.green}✓${C.reset} ${C.dim}(${r.durationMs}ms)${C.reset}`);
    else console.log(`${C.red}✗${C.reset} ${C.dim}(${r.durationMs}ms)${C.reset} — ${r.failures.join('; ')}`);
  }

  // Summary by agent
  const byAgent = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const a = byAgent.get(r.agent) ?? { pass: 0, fail: 0 };
    if (r.ok) a.pass++; else a.fail++;
    byAgent.set(r.agent, a);
  }

  header('📊 Résumé par agent');
  for (const [agent, s] of Array.from(byAgent.entries())) {
    const total = s.pass + s.fail;
    const pct = Math.round((s.pass / total) * 100);
    const color = pct === 100 ? C.green : pct >= 70 ? C.yellow : C.red;
    console.log(`  ${color}${agent.padEnd(10)}${C.reset}  ${s.pass}/${total}  (${pct}%)`);
  }

  // Failures detail
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    header(`❌ ${failed.length} échecs (détails)`);
    for (const r of failed) {
      console.log(`\n${C.red}${C.bold}${r.id}${C.reset} (${r.agent})`);
      console.log(`  ${C.dim}signal failures:${C.reset} ${r.failures.join(' | ')}`);
      console.log(`  ${C.dim}response (300 chars):${C.reset} ${r.response.slice(0, 300).replace(/\n/g, ' ')}…`);
    }
  }

  const totalPass = results.filter(r => r.ok).length;
  console.log(`\n${C.bold}Final: ${totalPass}/${results.length} passed${C.reset}`);
  process.exit(failed.length > 0 ? 1 : 0);
})();
