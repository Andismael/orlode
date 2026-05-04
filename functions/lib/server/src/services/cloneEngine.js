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
exports.getCloneConfig = getCloneConfig;
exports.buildClonePrompt = buildClonePrompt;
exports.cloneChat = cloneChat;
/**
 * Clone Engine — The Company's Digital Twin
 *
 * The clone IS the company. It speaks, sells, supports, and guides.
 * It sits BETWEEN the user and the Orchestrator, adding:
 *   1. Company persona (voice, tone, personality, rules)
 *   2. Brand context (name, sector, products, values)
 *   3. Conversation memory per visitor
 *   4. Lead capture + CRM integration
 *   5. Multi-role: sales, support, reception, guide
 *   6. Channel-agnostic: web, widget, WhatsApp, Telegram, API
 */
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
/** Load clone config from Firestore */
async function getCloneConfig(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const [companyDoc, cloneDoc] = await Promise.all([
        db.collection('companies').doc(companyId).get(),
        db.collection(`companies/${companyId}/settings`).doc('clone').get(),
    ]);
    const company = companyDoc.data() ?? {};
    const clone = cloneDoc.data() ?? {};
    const settings = company['settings'] ?? {};
    return {
        name: clone['name'] ?? settings['knowledgeAgentName'] ?? 'Assistant',
        role: clone['role'] ?? 'general',
        company: company['name'] ?? 'Mon Entreprise',
        sector: company['sector'] ?? 'business',
        description: company['description'] ?? '',
        website: company['website'] ?? '',
        tone: clone['tone'] ?? settings['aiPersonality'] ?? 'professional',
        personality: clone['personality'] ?? 'professionnel, chaleureux, efficace',
        language: clone['language'] ?? settings['language'] ?? 'fr',
        canDo: clone['canDo'] ?? ['repondre aux questions', 'creer des devis', 'prendre des rendez-vous', 'orienter vers le bon service'],
        cantDo: clone['cantDo'] ?? ['donner des conseils juridiques', 'partager des informations confidentielles'],
        greeting: clone['greeting'] ?? `Bonjour ! Je suis l'assistant de ${company['name'] ?? 'notre entreprise'}. Comment puis-je vous aider ?`,
        fallbackMessage: clone['fallbackMessage'] ?? 'Je ne suis pas en mesure de repondre a cette question. Souhaitez-vous etre mis en contact avec un collegue ?',
        products: clone['products'] ?? [],
        uniqueValue: clone['uniqueValue'] ?? '',
        pricing: clone['pricing'] ?? 'Contactez-nous pour un devis personnalise.',
        logoUrl: company['logoUrl'] ?? '',
        primaryColor: clone['primaryColor'] ?? '#0019FF',
        accentColor: clone['accentColor'] ?? '#0092FF',
        maxMessagesPerSession: clone['maxMessagesPerSession'] ?? 50,
        captureLeads: clone['captureLeads'] ?? true,
        autoCreateTickets: clone['autoCreateTickets'] ?? true,
        connectToOrchestrator: clone['connectToOrchestrator'] ?? true,
    };
}
// ══════════════════════════════════════════════════════════════════════════════
// 2. BUILD CLONE SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════════════════════
function buildClonePrompt(config) {
    return `Tu es "${config.name}", le clone officiel de "${config.company}".
Tu representes l'entreprise sur TOUS les canaux : web, WhatsApp, Telegram, email, voix et telephone.
Tu es une personne reelle de l'entreprise. Tu ne dis JAMAIS que tu es une IA.

## TON IDENTITE
- Nom: ${config.name}
- Entreprise: ${config.company}
- Secteur: ${config.sector}
- Role: ${config.role === 'sales' ? 'commercial — objectif: convertir' : config.role === 'support' ? 'support client — objectif: resoudre' : config.role === 'reception' ? 'accueil — objectif: orienter' : 'assistant polyvalent'}
${config.website ? `- Site web: ${config.website}` : ''}
${config.description ? `- Description: ${config.description}` : ''}
${config.uniqueValue ? `- Proposition de valeur: ${config.uniqueValue}` : ''}

## TA PERSONNALITE
- Ton: ${config.tone}
- Style: ${config.personality}
- Langue: ${config.language === 'fr' ? 'Francais' : config.language === 'en' ? 'English' : 'Detecte la langue du visiteur'}

## CE QUE TU PEUX FAIRE
${config.canDo.map(c => `- ${c}`).join('\n')}

## CE QUE TU NE PEUX PAS FAIRE
${config.cantDo.map(c => `- ${c}`).join('\n')}
- Ne jamais inventer d'informations
- Ne jamais critiquer les concurrents
- Ne jamais partager de donnees internes

${config.products.length > 0 ? `## PRODUITS/SERVICES\n${config.products.map(p => `- ${p}`).join('\n')}` : ''}
${config.pricing ? `## TARIFICATION\n${config.pricing}` : ''}

## INTENTIONS PRINCIPALES
1. DEVIS → comprendre le besoin, poser 2-3 questions, capturer infos, proposer devis ou RDV
2. RESERVATION/RDV → demander nom, date, heure, telephone, confirmer clairement
3. SUPPORT → ecouter, rassurer, proposer solution, creer ticket si besoin
4. INFORMATION → repondre directement, rester simple

## MODE VOIX (appel ou message vocal)
- Phrases COURTES (1-2 phrases max)
- Ton naturel, humain, fluide
- UNE seule question a la fois
- Reformule si besoin
- Pas de markdown ni mise en forme visuelle

## MODE TEXTE
- WhatsApp → tres court, direct (2-3 phrases)
- Email → structure et professionnel
- Telegram → concis
- Web → guide avec suggestions d'actions

## CAPTURE LEAD
Toujours essayer d'obtenir (sans forcer) : nom, telephone, email, besoin.

## ESCALADE HUMAINE OBLIGATOIRE SI:
- Demande explicite d'un humain
- Urgence, plainte grave, juridique, remboursement, menace
- Incomprehension apres 2 tentatives
- Confiance faible sur l'intention

Reponse escalade: "Je vais vous mettre en relation avec un conseiller."

## PHRASES NATURELLES
- "Je m'en occupe"
- "Parfait, je vais vous aider"
- "Tres bien, dites-moi..."
- "Je comprends"
- "Est-ce que cela vous convient ?"

## 🔴 RÈGLE CRITIQUE KIOSK / RÉCEPTION — VISITEURS QUI DEMANDENT UN EMPLOYÉ

Quand un visiteur dit "Je viens voir [Nom]", "Je cherche [Nom]", "Prévenez [Nom]", "Je dois voir [Nom]" :

ÉTAPE 1 (OBLIGATOIRE) : Appelle IMMÉDIATEMENT findEmployee(companyId, "${'${nom}'}").
  ⚠️ Même si le nom demandé ressemble à TON propre nom ("${config.name}"), tu DOIS appeler findEmployee — il peut y avoir un VRAI employé avec un nom similaire. Tu es un assistant virtuel, PAS l'employé en chair et en os.

ÉTAPE 2 (OBLIGATOIRE) : Si findEmployee retourne found=true, appelle notifyHost(companyId, hostName, visitorName, contact, reason).
  ⚠️ Appelle notifyHost MÊME si l'employé est absent, parti, ou en congé — le tool envoie WhatsApp/Telegram/email qui atteignent l'employé hors du bureau.
  ⚠️ N'offre JAMAIS "un autre conseiller" ou "laisser un message" sans avoir appelé notifyHost d'abord — c'est mensonger.

ÉTAPE 3 : Confirme au visiteur avec le résultat EXACT du tool : "J'ai prévenu [Nom] par [canaux]. [Il/Elle] va vous répondre."

ÉTAPE 4 : Si visitorName est inconnu, demande-le APRÈS avoir appelé notifyHost (le tool peut être rappelé pour mettre à jour).

EXEMPLES CONCRETS :
- Visiteur : "Je cherche Sara" → findEmployee("Sara") → notifyHost("Sara Camara", "inconnu") → "Sara a été prévenue par email. Votre nom pour que je précise ?"
- Visiteur : "Je viens voir ${config.name}" (ton propre nom) → findEmployee("${config.name}") → Si un vrai employé existe : notifyHost(). Sinon : "Je suis ${config.name}, l'assistant virtuel. Vous cherchez quelqu'un d'autre ?"
- Employé absent : findEmployee → notifyHost → "[Nom] est absent(e) aujourd'hui mais a été alerté(e) sur son téléphone."

INTERDICTIONS :
✗ "Je vais lui laisser un message" sans notifyHost
✗ "Je vais le contacter" sans notifyHost
✗ "Je peux vous proposer un autre conseiller" avant d'avoir appelé notifyHost
✗ Se prétendre l'employé demandé quand on est l'IA

## OBJECTIF FINAL
Aider rapidement, convertir en client, capturer des leads, declencher des actions utiles, donner une experience fluide et humaine.`;
}
const sessions = new Map();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour
const FIRESTORE_SESSION_COLLECTION = '_cloneSessions';
// Cleanup old in-memory sessions every 10 min
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.createdAt > SESSION_TTL)
            sessions.delete(id);
    }
}, 10 * 60 * 1000);
async function loadSession(sessionId) {
    // 1. Check in-memory cache (fastest)
    const cached = sessions.get(sessionId);
    if (cached && Date.now() - cached.createdAt < SESSION_TTL)
        return cached;
    // 2. Load from Firestore (cross-instance)
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection(FIRESTORE_SESSION_COLLECTION).doc(sessionId).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        if (!data)
            return null;
        if (Date.now() - data.createdAt > SESSION_TTL)
            return null;
        sessions.set(sessionId, data); // warm the in-memory cache
        return data;
    }
    catch {
        return null;
    }
}
async function saveSession(sessionId, session) {
    sessions.set(sessionId, session);
    // Fire-and-forget Firestore save (don't block reply)
    try {
        await (0, firebase_config_1.getFirestore)().collection(FIRESTORE_SESSION_COLLECTION).doc(sessionId).set({
            messages: session.messages.slice(-40), // cap size
            createdAt: session.createdAt,
            leadCaptured: session.leadCaptured,
            updatedAt: new Date(),
        }, { merge: true });
    }
    catch (err) {
        logger_1.logger.warn('[Clone] Session save to Firestore failed (in-memory only)', { sessionId, err: String(err) });
    }
}
/** Main clone chat function */
async function cloneChat(input) {
    const { companyId, message, channel = 'web', visitorName, visitorEmail } = input;
    const sessionId = input.sessionId || (0, helpers_1.generateId)();
    logger_1.logger.info(`[Clone] Company ${companyId}, session ${sessionId}: "${message.slice(0, 80)}"`);
    // Load config
    const config = await getCloneConfig(companyId);
    // Get or create session (persistent across instances via Firestore fallback)
    let session = await loadSession(sessionId);
    if (!session) {
        session = { messages: [], createdAt: Date.now(), leadCaptured: false };
    }
    // Check message limit
    if (session.messages.length >= config.maxMessagesPerSession * 2) {
        return {
            reply: `Merci pour cet echange ! Pour continuer, contactez-nous directement sur ${config.website || 'notre site web'}.`,
            sessionId, cloneName: config.name, leadCaptured: session.leadCaptured, ticketCreated: false,
        };
    }
    // Add user message to history
    session.messages.push({ role: 'user', content: message });
    // ── PER-CHANNEL TONE ADJUSTMENT ────────────────────────────────────────
    const channelToneOverrides = {
        whatsapp: '\n\nIMPORTANT: Tu reponds sur WhatsApp. Sois COURT et DIRECT. Max 2-3 phrases. Utilise des emojis avec parcimonie. Pas de markdown.',
        telegram: '\n\nIMPORTANT: Tu reponds sur Telegram. Sois concis et direct. Markdown leger autorise.',
        api: '\n\nIMPORTANT: Tu reponds par email. Sois structure et professionnel. Utilise des paragraphes clairs.',
        voice: '\n\nIMPORTANT: Tu reponds en VOCAL (synthese vocale). Regles strictes:\n- Phrases courtes (max 15 mots par phrase)\n- Pas de markdown (**, *, #, `, [])\n- Pas de listes a puces (lis naturellement "premierement, deuxiemement")\n- Pas d\'URL ni de caracteres speciaux\n- Langage naturel, comme une conversation telephonique\n- Confirme les chiffres et dates a l\'oral (ex: "le 20 avril" pas "20/04")\n- Si tu dois confirmer une action sensible (RDV, email), dis que ca sera valide par un agent — ne jamais confirmer directement a la voix.',
        web: '', // default behavior
        widget: '', // default behavior
    };
    const channelTone = channelToneOverrides[channel] ?? '';
    // Build conversation for AI — with tools if enabled
    const toolsEnabled = config.connectToOrchestrator !== false;
    // ── Date context: give the LLM an explicit anchor for relative dates ─────
    // Without this, "lundi" gets hallucinated (e.g. Lundi 19 mai instead of 20 avril).
    const dateAnchors = (() => {
        const now = new Date();
        const weekdaysFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const today = now.toISOString().slice(0, 10);
        const todayLabel = weekdaysFr[now.getDay()];
        const nextDays = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            const iso = d.toISOString().slice(0, 10);
            const label = weekdaysFr[d.getDay()];
            nextDays.push(`${label} prochain = ${iso}`);
        }
        return `Today: ${today} (${todayLabel}). Upcoming weekdays: ${nextDays.join(', ')}.`;
    })();
    const toolsInstruction = toolsEnabled ? `

## OUTILS DISPONIBLES
Tu PEUX appeler ces outils pour de vraies actions. Toujours passer companyId="${companyId}" et sourceChannel="${channel}".

- **findEmployee**(companyId, name) — recherche un employé par nom. APPELLE quand un visiteur mentionne quelqu'un pour confirmer qu'il existe.
- **checkEmployeePresence**(companyId, employeeName) — vérifie si l'employé est AU BUREAU aujourd'hui (présent/parti/absent). Pour INFO uniquement — tu dois TOUJOURS appeler notifyHost ensuite, même si absent.
- **notifyHost**(companyId, hostName, visitorName, visitorContact?, reason?) — PRÉVIENT l'employé via ses canaux configurés (email + WhatsApp + Telegram + dashboard). APPELLE TOUJOURS quand un visiteur veut voir quelqu'un — MÊME si la personne est absente/partie. Le tool gère les deux cas : si absent, Sara reçoit quand même la notif sur son téléphone et peut répondre. Ne dis JAMAIS "je transmets" ou "je préviens" sans avoir appelé ce tool — ce serait un mensonge.

RÈGLE KIOSK RÉCEPTION (OBLIGATOIRE) :
Quand un visiteur veut voir un employé, le flow EST :
1. findEmployee(nom) → confirme qu'il existe
2. notifyHost(nom, visiteur) → le prévient VRAIMENT (même si absent)
3. Dis au visiteur : "J'ai prévenu [Nom] par email/WhatsApp. Il/elle a été alerté(e) et va vous répondre."
JAMAIS "je vais lui laisser un message" ou "je vais le contacter" sans avoir appelé notifyHost. Le tool fait le travail, pas toi.
- **findAppointment**(companyId, clientPhone OU clientEmail, date?) — cherche un RDV existant. APPELLE TOUJOURS en premier quand l'utilisateur parle d'un RDV qu'il pense avoir pris.
- **createAppointment**(companyId, clientName, service, date YYYY-MM-DD, time HH:MM, clientPhone OU clientEmail, notes?) — crée un RDV pending.
- **confirmAppointment**(companyId, appointmentId, clientPhone OU clientEmail) — confirme un RDV PENDING. L'identité (phone/email) doit correspondre au RDV. Si requiresHuman=true, dis que quelqu'un va recontacter.
- **addClient**(companyId, name, phone OU email) — enregistre un prospect.
- **createSupportTicket**(companyId, subject, description, priority?) — ticket pending. À utiliser UNIQUEMENT en cas de vrai bug ou demande hors-sujet.
- **sendEmail**(companyId, to, subject, body) — envoi email (après avoir l'email).

## CONTEXTE TEMPOREL (OBLIGATOIRE — ne jamais hallucinier les dates)
${dateAnchors}
Quand l'utilisateur dit "lundi", "demain", "la semaine prochaine", utilise STRICTEMENT les ancres ci-dessus.
Format strict à passer à createAppointment: date en YYYY-MM-DD et time en HH:MM 24h.

## LOGIQUE DÉCISIONNELLE (respecte cet ordre)
Cas 1 — L'utilisateur parle d'un RDV qu'il pense avoir déjà pris ("j'ai pas reçu confirmation", "vous avez pris mon rdv ?"):
  1. Appelle findAppointment immédiatement
  2. Si found=true → confirme les détails exacts (date, heure, status)
  3. Si found=false → dis "Je n'ai pas de trace de ce RDV" et PROPOSE de le créer (ne crée pas sans accord)
  4. Ne jamais ouvrir un ticket support pour ce cas — c'est une requête de booking, pas un bug

Cas 2 — L'utilisateur demande un nouveau RDV:
  1. Collecte nom, service/motif, date (convertie via les ancres), heure, contact
  2. Appelle createAppointment
  3. Si success=true → confirme avec appointmentId et date/heure exactes
  4. Si success=false → dis honnêtement que ça n'a pas marché, propose fallback humain

Cas 3 — L'utilisateur veut confirmer un RDV pending ("il faut confirmer ça", "vous pouvez valider ?"):
  1. Appelle findAppointment d'abord (si pas déjà fait) pour obtenir l'appointmentId
  2. Vérifie que status="pending"
  3. Appelle confirmAppointment avec appointmentId + le phone/email que l'utilisateur A DÉJÀ fourni dans cette conversation
  4. Si success=true → confirme clairement la nouvelle date/heure
  5. Si requiresHuman=true → dis "Pour valider, un agent va vous recontacter" (ne prétends JAMAIS que c'est confirmé)
  6. Ne JAMAIS dire "je m'en occupe" sans avoir appelé confirmAppointment avec succès

Cas 4 — L'utilisateur a un vrai problème (bug, plainte, urgence):
  → createSupportTicket uniquement dans ce cas

## RÈGLE ANTI-CONFUSION
- Ne JAMAIS dire "c'est fait" ou "c'est confirmé" sans que l'outil ait renvoyé success:true
- Ne JAMAIS ouvrir un ticket de support quand l'intent est de gérer un RDV
- Si tu ne sais pas la date exacte, DEMANDE (ne devine pas)
- Après createAppointment/confirmAppointment success, utilise EXACTEMENT la date et l'heure renvoyées par l'outil` : '';
    const systemPrompt = buildClonePrompt(config) + channelTone + toolsInstruction;
    const historyForAI = session.messages.slice(-20).map(m => ({
        role: m.role,
        content: [{ text: m.content }],
    }));
    // Generate response — with Clone-safe tools (pending status + audit trail)
    const { CLONE_SAFE_TOOLS } = await Promise.resolve().then(() => __importStar(require('../agents/tools/cloneTools')));
    const response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: systemPrompt,
        messages: historyForAI,
        tools: toolsEnabled ? CLONE_SAFE_TOOLS : undefined,
        config: { temperature: 0.4 },
    });
    const reply = response.text;
    session.messages.push({ role: 'model', content: reply });
    // Extract notifyHost notification ID from tool results so the kiosk can poll
    let hostNotificationId;
    try {
        for (const msg of response.messages ?? []) {
            const content = msg.content ?? [];
            for (const part of content) {
                const tr = part['toolResponse'];
                if (tr?.name === 'notifyHost' && typeof tr.output?.['notificationId'] === 'string') {
                    hostNotificationId = tr.output['notificationId'];
                }
            }
        }
    }
    catch { /* non-critical */ }
    // ── ESCALATION DETECTION ───────────────────────────────────────────────
    const msgLower = message.toLowerCase();
    const replyLower = reply.toLowerCase();
    let escalateToHuman = false;
    let escalateReason = '';
    const escalationTriggers = ['parler a quelqu', 'parler à quelqu', 'humain', 'responsable', 'manager', 'urgent', 'plainte', 'avocat', 'juridique', 'remboursement', 'pas satisfait', 'inacceptable'];
    for (const trigger of escalationTriggers) {
        if (msgLower.includes(trigger)) {
            escalateToHuman = true;
            escalateReason = `Visiteur a demande: "${trigger}"`;
            break;
        }
    }
    // Also escalate after many messages without resolution
    if (session.messages.length > 16 && !session.leadCaptured) {
        escalateToHuman = true;
        escalateReason = 'Conversation longue sans resolution';
    }
    // ── LEAD CAPTURE + SCORING ────────────────────────────────────────────
    let leadCaptured = session.leadCaptured;
    let leadScore;
    // Detect intent and type from conversation
    const allMessages = session.messages.map(m => m.content.toLowerCase()).join(' ');
    const intentSignals = { devis: /devis|tarif|prix|combien|cout|budget/i.test(allMessages), rdv: /rendez-vous|rdv|rencontrer|disponible|agenda/i.test(allMessages), demo: /demo|demonstration|essai|tester/i.test(allMessages), support: /probleme|bug|aide|support|panne/i.test(allMessages), info: true };
    const intentType = intentSignals.devis ? 'devis' : intentSignals.rdv ? 'rdv' : intentSignals.demo ? 'demo' : intentSignals.support ? 'support' : 'info';
    const intentLevel = intentSignals.devis || intentSignals.rdv ? 'high' : intentSignals.demo ? 'medium' : 'low';
    // Score calculation
    const msgCount = session.messages.length / 2;
    const hasContact = !!(visitorEmail || message.match(/[\w.-]+@[\w.-]+\.\w+/) || message.match(/(\+?\d[\d\s.-]{8,})/));
    const scoreBase = intentLevel === 'high' ? 60 : intentLevel === 'medium' ? 40 : 20;
    const scoreMsg = Math.min(20, msgCount * 4); // more messages = more engaged
    const scoreContact = hasContact ? 20 : 0;
    const score = Math.min(100, scoreBase + scoreMsg + scoreContact);
    leadScore = { score, intent: intentLevel, type: intentType };
    if (config.captureLeads && !leadCaptured) {
        const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
        const phoneMatch = message.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}/);
        const capturedEmail = visitorEmail ?? emailMatch?.[0] ?? '';
        const capturedPhone = phoneMatch?.[0] ?? '';
        if (capturedEmail || capturedPhone) {
            const db = (0, firebase_config_1.getFirestore)();
            // ── UNIFIED CONTACT: check if this person exists across channels ──
            let existingContactId = null;
            if (capturedEmail) {
                const existing = await db.collection(`companies/${companyId}/cloneContacts`).where('email', '==', capturedEmail).limit(1).get();
                if (!existing.empty)
                    existingContactId = existing.docs[0].id;
            }
            if (!existingContactId && capturedPhone) {
                const existing = await db.collection(`companies/${companyId}/cloneContacts`).where('phone', '==', capturedPhone).limit(1).get();
                if (!existing.empty)
                    existingContactId = existing.docs[0].id;
            }
            if (existingContactId) {
                // Update existing contact with new channel info
                const { FieldValue: FV } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
                await db.collection(`companies/${companyId}/cloneContacts`).doc(existingContactId).update({
                    channels: FV.arrayUnion(channel),
                    lastMessage: message, lastChannel: channel, lastSeenAt: new Date(),
                    messageCount: FV.increment(msgCount), leadScore: Math.max(score, 0),
                });
            }
            else {
                // Create new unified contact
                existingContactId = (0, helpers_1.generateId)();
                await db.collection(`companies/${companyId}/cloneContacts`).doc(existingContactId).set({
                    id: existingContactId, name: visitorName ?? 'Visiteur',
                    email: capturedEmail, phone: capturedPhone,
                    channels: [channel], firstChannel: channel, lastChannel: channel,
                    firstMessage: session.messages[0]?.content ?? '',
                    lastMessage: message, messageCount: msgCount,
                    leadScore: score, intent: intentLevel, intentType,
                    status: 'new', // new | active | escalated | converted | closed
                    assignedTo: null, escalated: false,
                    firstSeenAt: new Date(), lastSeenAt: new Date(),
                });
            }
            // Still save individual lead record
            await db.collection(`companies/${companyId}/cloneLeads`).doc((0, helpers_1.generateId)()).set({
                name: visitorName ?? 'Visiteur', email: capturedEmail, phone: capturedPhone,
                channel, sessionId, contactId: existingContactId,
                firstMessage: session.messages[0]?.content ?? '', lastMessage: message,
                messageCount: msgCount, leadScore: score, intent: intentLevel, intentType,
                capturedAt: new Date(),
            });
            leadCaptured = true;
            session.leadCaptured = true;
            logger_1.logger.info(`[Clone] Lead captured (score ${score}, contact ${existingContactId}): ${capturedEmail || capturedPhone}`);
        }
    }
    // ── AUTO-RESOLVE + AUTO-IT-TICKET for technical issues ─────────────────
    const techKeywords = /site.*marche pas|erreur|bug|panne|lent|crash|ne.*fonctionne|probleme technique|connexion/i;
    if (intentType === 'support' && techKeywords.test(message) && config.connectToOrchestrator) {
        // Try auto-resolve first, if fails → create IT ticket
        try {
            const { cloneToITTool } = await Promise.resolve().then(() => __importStar(require('../agents/it.agent')));
            await cloneToITTool({ companyId, issue: message, customerEmail: visitorEmail, customerName: visitorName, channel });
        }
        catch { }
    }
    if (intentType === 'support' && config.connectToOrchestrator) {
        try {
            const { autoResolveTool } = await Promise.resolve().then(() => __importStar(require('../agents/support.agent')));
            const resolution = await autoResolveTool({ companyId, issue: message, customerEmail: visitorEmail ?? '' });
            if (resolution?.resolved && resolution.confidence >= 60) {
                // Append solution to reply
                session.messages[session.messages.length - 1].content += `\n\n💡 ${resolution.solution}`;
            }
        }
        catch { }
    }
    // ── CTA BUTTONS (contextual) ──────────────────────────────────────────
    const ctaButtons = [];
    if (replyLower.includes('devis') || replyLower.includes('tarif') || intentSignals.devis) {
        ctaButtons.push({ label: 'Recevoir un devis', action: 'request_quote', icon: 'FileText' });
    }
    if (replyLower.includes('rendez-vous') || replyLower.includes('rdv') || intentSignals.rdv) {
        ctaButtons.push({ label: 'Prendre rendez-vous', action: 'book_appointment', icon: 'Calendar' });
    }
    if (replyLower.includes('rappel') || replyLower.includes('contact') || msgCount >= 3) {
        ctaButtons.push({ label: 'Etre rappele', action: 'request_callback', icon: 'Phone' });
    }
    if (replyLower.includes('demo') || intentSignals.demo) {
        ctaButtons.push({ label: 'Demander une demo', action: 'request_demo', icon: 'Play' });
    }
    if (escalateToHuman) {
        ctaButtons.push({ label: 'Parler a un humain', action: 'escalate_human', icon: 'User' });
    }
    // Suggested actions (text-based)
    const suggestedActions = ctaButtons.map(c => c.label);
    // Persist session across instances (non-blocking)
    session.leadCaptured = session.leadCaptured || leadCaptured;
    saveSession(sessionId, session).catch(() => { });
    return {
        reply, sessionId, cloneName: config.name,
        leadCaptured, ticketCreated: false,
        suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
        ctaButtons: ctaButtons.length > 0 ? ctaButtons : undefined,
        leadScore, escalateToHuman, escalateReason: escalateToHuman ? escalateReason : undefined,
        hostNotificationId,
    };
}
//# sourceMappingURL=cloneEngine.js.map