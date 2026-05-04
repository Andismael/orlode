/**
 * VoiceCloneChat — Public voice Clone for visitors.
 *
 * Phase 1 behavior:
 *   - Loads the company's Clone system prompt from /api/clone/:companyId/voice-prompt
 *   - Starts Gemini Live with that prompt (voice rules embedded)
 *   - Gemini acts as the Clone conversationally — NO tool calls yet
 *   - Sensitive actions are always deferred to human (per system prompt)
 *   - Transcripts are logged to /api/clone/:companyId/chat (channel='voice')
 *     so admin gets the session in the Clone Inbox for follow-up
 */
import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Loader2, Mic } from 'lucide-react';
import { useGeminiLive, type LiveToolDecl } from '@/hooks/useGeminiLive';
import api from '@/services/api';

// Tool schemas exposed to Gemini Live — matches Clone-safe tools on the backend.
// `confirmAppointment` and `sendEmail` intentionally NOT declared here: voice clients
// should never be able to self-confirm or send email. Backend also blocks at tool level.
const VOICE_TOOLS: LiveToolDecl[] = [
  {
    functionDeclarations: [
      {
        name: 'findAppointment',
        description: "Rechercher un rendez-vous existant par téléphone ou email du client. À APPELER EN PREMIER si l'utilisateur parle d'un rendez-vous qu'il pense avoir pris.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientPhone: { type: 'STRING', description: 'Numéro de téléphone du client (optionnel)' },
            clientEmail: { type: 'STRING', description: 'Email du client (optionnel)' },
            date: { type: 'STRING', description: 'Date YYYY-MM-DD pour affiner (optionnel)' },
          },
        },
      },
      {
        name: 'createAppointment',
        description: "Créer un nouveau rendez-vous (statut 'pending' — un agent validera). À appeler quand l'utilisateur veut prendre un RDV et a fourni nom + service + date + heure + contact.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientName: { type: 'STRING', description: 'Nom complet du client' },
            clientPhone: { type: 'STRING', description: 'Téléphone du client (ou email)' },
            clientEmail: { type: 'STRING', description: 'Email du client (ou téléphone)' },
            service: { type: 'STRING', description: 'Service ou motif du RDV' },
            date: { type: 'STRING', description: 'Date au format YYYY-MM-DD' },
            time: { type: 'STRING', description: 'Heure au format HH:MM (24h)' },
            notes: { type: 'STRING', description: 'Notes additionnelles (optionnel)' },
          },
          required: ['clientName', 'service', 'date', 'time'],
        },
      },
      {
        name: 'addClient',
        description: "Enregistrer un nouveau prospect/contact dans le CRM. À appeler après avoir obtenu nom + téléphone OU email.",
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Nom du contact' },
            phone: { type: 'STRING', description: 'Téléphone (ou email requis)' },
            email: { type: 'STRING', description: 'Email (ou téléphone requis)' },
            notes: { type: 'STRING', description: 'Notes sur le contact' },
          },
          required: ['name'],
        },
      },
      {
        name: 'createSupportTicket',
        description: "Créer un ticket de support UNIQUEMENT en cas de vrai bug ou problème technique rapporté par l'utilisateur. Ne JAMAIS utiliser pour une demande de RDV.",
        parameters: {
          type: 'OBJECT',
          properties: {
            subject: { type: 'STRING', description: 'Sujet court du problème' },
            description: { type: 'STRING', description: 'Description détaillée' },
            clientName: { type: 'STRING', description: 'Nom du client (optionnel)' },
            clientContact: { type: 'STRING', description: 'Téléphone ou email du client' },
            priority: { type: 'STRING', description: 'low, medium, high ou urgent' },
          },
          required: ['subject', 'description'],
        },
      },
      {
        name: 'findReservation',
        description: "Rechercher une réservation (table/chambre/salle/véhicule) par téléphone ou email. Appeler quand l'utilisateur parle d'une réservation existante.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
            date: { type: 'STRING', description: 'YYYY-MM-DD optionnel' },
          },
        },
      },
      {
        name: 'createReservation',
        description: "Créer une réservation: table (restaurant), room (hôtel), hall (salle événement), vehicle (voiture), other. Statut pending — un agent validera.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientName: { type: 'STRING' },
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
            resourceType: { type: 'STRING', description: "'table', 'room', 'hall', 'vehicle' ou 'other'" },
            date: { type: 'STRING', description: 'YYYY-MM-DD' },
            startTime: { type: 'STRING', description: 'HH:MM 24h — heure d\'arrivée' },
            endTime: { type: 'STRING', description: 'HH:MM optionnel (fin/check-out)' },
            guests: { type: 'NUMBER', description: 'Nombre de personnes' },
            notes: { type: 'STRING' },
          },
          required: ['clientName', 'resourceType', 'date', 'startTime'],
        },
      },
      {
        name: 'cancelReservation',
        description: "Annuler une réservation existante. Nécessite l'identifiant + téléphone/email du client qui doit correspondre.",
        parameters: {
          type: 'OBJECT',
          properties: {
            reservationId: { type: 'STRING' },
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
          required: ['reservationId'],
        },
      },
      {
        name: 'listResources',
        description: "Lister les ressources disponibles d'un type donné (combien de tables, de chambres, etc.). Utile avant createReservation pour informer le client.",
        parameters: {
          type: 'OBJECT',
          properties: {
            resourceType: { type: 'STRING', description: "'table', 'room', 'hall', 'vehicle', 'other'" },
            minCapacity: { type: 'NUMBER', description: 'Capacité minimum requise' },
          },
          required: ['resourceType'],
        },
      },
      {
        name: 'createLead',
        description: "Enregistrer un prospect qui montre un intérêt commercial ('je veux acheter', 'parlez-moi de vos offres', 'j'aimerais en savoir plus sur un produit').",
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            phone: { type: 'STRING' },
            email: { type: 'STRING' },
            company: { type: 'STRING', description: 'Nom de la société du prospect (si B2B)' },
            interest: { type: 'STRING', description: 'Ce qui intéresse le prospect (produit, service, besoin)' },
            estimatedValue: { type: 'NUMBER', description: 'Valeur estimée du deal si mentionnée' },
          },
          required: ['name', 'interest'],
        },
      },
      {
        name: 'createQuoteRequest',
        description: "Enregistrer une demande de devis pour un ou plusieurs articles/services specifiques. Pour un intérêt vague, utiliser createLead.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientName: { type: 'STRING' },
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
            company: { type: 'STRING' },
            items: {
              type: 'ARRAY',
              description: "Liste d'articles demandés",
              items: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING' },
                  quantity: { type: 'NUMBER' },
                  notes: { type: 'STRING' },
                },
                required: ['name'],
              },
            },
            deadline: { type: 'STRING', description: 'Délai souhaité YYYY-MM-DD' },
            notes: { type: 'STRING' },
          },
          required: ['clientName', 'items'],
        },
      },
      {
        name: 'listServices',
        description: "Lister les services/produits de l'entreprise. À utiliser pour répondre 'que proposez-vous ?'",
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'listProducts',
        description: "Lister les produits du catalogue avec leurs prix. Utile pour 'que vendez-vous ?' ou 'montrez-moi le menu'.",
        parameters: {
          type: 'OBJECT',
          properties: {
            category: { type: 'STRING', description: 'Filtre par catégorie (optionnel)' },
            search: { type: 'STRING', description: 'Recherche par mot-clé (optionnel)' },
          },
        },
      },
      {
        name: 'findProduct',
        description: "Rechercher un produit précis par son nom. Retourne prix + stock.",
        parameters: {
          type: 'OBJECT',
          properties: { name: { type: 'STRING' } },
          required: ['name'],
        },
      },
      {
        name: 'createOrderDraft',
        description: "Créer une commande. Appeler UNIQUEMENT après avoir confirmé avec le client les articles + quantités. Utiliser les productId retournés par listProducts/findProduct.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientName: { type: 'STRING' },
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
            items: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  productId: { type: 'STRING' },
                  quantity: { type: 'NUMBER' },
                },
                required: ['productId'],
              },
            },
            notes: { type: 'STRING' },
          },
          required: ['clientName', 'items'],
        },
      },
      {
        name: 'generatePaymentLink',
        description: "Générer un lien de paiement pour une commande existante. Le lien est envoyé automatiquement par email au client. Méthodes: wave, stripe, paypal, manual.",
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING' },
            method: { type: 'STRING', description: "'wave', 'stripe', 'paypal' ou 'manual'" },
          },
          required: ['orderId'],
        },
      },
      {
        name: 'findOrder',
        description: "Retrouver la dernière commande d'un client par téléphone ou email.",
        parameters: {
          type: 'OBJECT',
          properties: {
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
          },
        },
      },
      {
        name: 'cancelOrder',
        description: "Annuler une commande non payée. Nécessite l'orderId + identité.",
        parameters: {
          type: 'OBJECT',
          properties: {
            orderId: { type: 'STRING' },
            clientPhone: { type: 'STRING' },
            clientEmail: { type: 'STRING' },
            reason: { type: 'STRING' },
          },
          required: ['orderId'],
        },
      },
    ],
  },
];

interface VoicePromptData {
  systemInstruction: string;
  greeting: string;
  cloneName: string;
  language: string;
}

interface VoiceCloneChatProps {
  companyId: string;
  voiceName?: string;
  autoConnect?: boolean;
  className?: string;
}

export default function VoiceCloneChat({ companyId, voiceName = 'Kore', autoConnect = false, className = '' }: VoiceCloneChatProps) {
  const { isConnected, isConnecting, isListening, isSpeaking, messages, currentText, error, connect, disconnect } = useGeminiLive();
  const [prompt, setPrompt] = useState<VoicePromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const autoRef = useRef(false);
  const lastLoggedRef = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get<VoicePromptData>(`/clone/${companyId}/voice-prompt`);
        const raw = r.data as unknown as Record<string, unknown>;
        const d = (raw?.data ?? raw) as VoicePromptData;
        if (alive) setPrompt(d);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [companyId]);

  useEffect(() => {
    if (autoConnect && prompt && !autoRef.current && !isConnected && !isConnecting) {
      autoRef.current = true;
      handleConnect();
    }
  }, [autoConnect, prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Log completed user turns to the Clone backend so admin sees them in the Inbox
  useEffect(() => {
    if (messages.length <= lastLoggedRef.current) return;
    const newMsgs = messages.slice(lastLoggedRef.current);
    lastLoggedRef.current = messages.length;
    // Only log when a user turn is followed by an assistant turn (pair)
    for (let i = 0; i < newMsgs.length; i++) {
      const m = newMsgs[i];
      if (m.role !== 'user') continue;
      api.post(`/clone/${companyId}/chat`, {
        message: m.text,
        sessionId,
        channel: 'voice',
        visitorName: 'Visiteur vocal',
      }).catch(() => { /* non-blocking — Gemini already handled the conversation */ });
    }
  }, [messages, companyId, sessionId]);

  const handleConnect = async () => {
    if (!prompt) return;
    await connect({
      language: prompt.language ?? 'fr',
      voiceName,
      systemInstruction: prompt.systemInstruction,
      tools: VOICE_TOOLS,
      onToolCall: async (name, args) => {
        try {
          const r = await api.post(`/clone/${companyId}/voice-tool`, { toolName: name, params: args });
          const raw = r.data as unknown as Record<string, unknown>;
          return (raw?.data ?? raw) as Record<string, unknown>;
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  };

  if (loading) return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
  );

  if (!prompt) return (
    <div className={`p-6 text-center text-sm text-gray-500 ${className}`}>
      Assistant vocal indisponible.
    </div>
  );

  return (
    <div className={`flex flex-col rounded-2xl bg-white border border-gray-200 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-violet-50">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm font-semibold text-gray-900">{prompt.cloneName} — Voix</span>
          {isSpeaking && <span className="text-xs text-blue-500 animate-pulse">Parle…</span>}
          {isListening && !isSpeaking && <span className="text-xs text-green-500">Écoute…</span>}
        </div>
        {!isConnected ? (
          <button onClick={handleConnect} disabled={isConnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50">
            <Phone size={14} /> {isConnecting ? 'Connexion…' : 'Démarrer'}
          </button>
        ) : (
          <button onClick={disconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-red-500 hover:bg-red-600">
            <PhoneOff size={14} /> Arrêter
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[420px]">
        {!isConnected && messages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Mic size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Cliquez "Démarrer" pour parler avec {prompt.cloneName}</p>
            <p className="text-xs mt-1 opacity-60">Les actions sensibles seront validées par un agent.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>{m.text}</div>
          </div>
        ))}
        {currentText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-gray-100 text-gray-800 animate-pulse">
              {currentText}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      {isConnected && (
        <div className="flex items-center justify-center gap-3 py-2 bg-gray-50">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i}
                className={`w-1 rounded-full transition-all ${
                  isListening && !isSpeaking ? 'bg-green-500 animate-pulse'
                    : isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                }`}
                style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {isSpeaking ? `${prompt.cloneName} parle` : isListening ? 'Parlez…' : 'En pause'}
          </span>
        </div>
      )}
    </div>
  );
}
