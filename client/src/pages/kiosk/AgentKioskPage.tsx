/**
 * AgentKioskPage — Universal kiosk for any marketplace agent
 * /kiosk/:agentId — dark premium touch UI + Gemini Live
 * Each agent gets its own kiosk with custom buttons, colors, voice prompt
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, ArrowLeft, Loader2, X } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const GeminiLiveChat = lazy(() => import('@/components/ai/GeminiLiveChat'));

interface AgentDetail {
  id: string; name: string; icon: string; description: string; industry: string;
  color: string; features: string[]; systemPrompt: string;
}

// Industry-specific kiosk configs
interface KioskConfig {
  title: string;
  subtitle: string;
  voicePrompt: string;
  actions: { icon: string; label: string; action: string; color: string }[];
}

const KIOSK_CONFIGS: Record<string, KioskConfig> = {
  restaurant: {
    title: 'Bienvenue',
    subtitle: 'Commandez, appelez le serveur ou consultez le menu',
    voicePrompt: 'Tu es l\'assistant IA du restaurant. Tu prends les commandes, tu recommandes des plats, tu appelles le serveur. Sois chaleureux et gourmand.',
    actions: [
      { icon: '📋', label: 'Voir le menu', action: 'Montre-moi le menu du jour', color: '#F97316' },
      { icon: '🍽️', label: 'Commander', action: 'Je voudrais commander', color: '#10B981' },
      { icon: '🙋', label: 'Appeler le serveur', action: 'Appelle le serveur s\'il te plaît', color: '#3B82F6' },
      { icon: '💳', label: 'L\'addition', action: 'L\'addition s\'il vous plaît', color: '#8B5CF6' },
    ],
  },
  sante: {
    title: 'Bienvenue',
    subtitle: 'Enregistrez-vous, consultez vos RDV ou posez une question',
    voicePrompt: 'Tu es l\'assistant IA de la clinique. Tu enregistres les patients, tu vérifies les RDV, tu donnes des informations sur les services. Sois rassurant et professionnel.',
    actions: [
      { icon: '📝', label: 'M\'enregistrer', action: 'Je voudrais m\'enregistrer pour mon rendez-vous', color: '#3B82F6' },
      { icon: '📅', label: 'Mon RDV', action: 'Vérifier mon prochain rendez-vous', color: '#10B981' },
      { icon: '💊', label: 'Pharmacie', action: 'Où est la pharmacie ?', color: '#F97316' },
      { icon: '🚑', label: 'Urgence', action: 'J\'ai besoin d\'aide urgente', color: '#EF4444' },
    ],
  },
  beaute: {
    title: 'Bienvenue',
    subtitle: 'RDV, soins, fidélité — votre beauté nous inspire',
    voicePrompt: 'Tu es l\'assistant IA du salon de beauté. Tu gères les RDV, tu recommandes des soins personnalisés, tu informes sur les promotions. Sois élégant et attentionné.',
    actions: [
      { icon: '📅', label: 'Mon RDV', action: 'Je voudrais vérifier mon rendez-vous', color: '#EC4899' },
      { icon: '✨', label: 'Soins', action: 'Quels soins recommandez-vous ?', color: '#8B5CF6' },
      { icon: '🎁', label: 'Fidélité', action: 'Combien de points de fidélité j\'ai ?', color: '#F59E0B' },
      { icon: '💇', label: 'Sans RDV', action: 'Est-ce possible sans rendez-vous ?', color: '#14B8A6' },
    ],
  },
  automobile: {
    title: 'Bienvenue',
    subtitle: 'Déposez votre véhicule, suivez les réparations',
    voicePrompt: 'Tu es l\'assistant IA du garage automobile. Tu enregistres les véhicules, tu fais des diagnostics, tu donnes les devis. Sois technique mais accessible.',
    actions: [
      { icon: '🚗', label: 'Déposer véhicule', action: 'Je voudrais déposer mon véhicule pour réparation', color: '#3B82F6' },
      { icon: '🔧', label: 'Suivi réparation', action: 'Où en est la réparation de mon véhicule ?', color: '#F97316' },
      { icon: '📋', label: 'Devis', action: 'J\'aimerais un devis pour mon véhicule', color: '#10B981' },
      { icon: '🔍', label: 'Diagnostic', action: 'Faire un diagnostic de mon véhicule', color: '#EF4444' },
    ],
  },
  commerce: {
    title: 'Bienvenue',
    subtitle: 'Trouvez vos produits, commandez, renseignez-vous',
    voicePrompt: 'Tu es l\'assistant IA du magasin. Tu aides les clients à trouver des produits, tu vérifies le stock, tu prends des commandes. Sois serviable et efficace.',
    actions: [
      { icon: '🔍', label: 'Chercher un produit', action: 'Je cherche un produit', color: '#3B82F6' },
      { icon: '📦', label: 'Stock', action: 'Est-ce que ce produit est en stock ?', color: '#10B981' },
      { icon: '🛒', label: 'Commander', action: 'Je voudrais passer une commande', color: '#F97316' },
      { icon: '🏷️', label: 'Promotions', action: 'Quelles sont les promotions en cours ?', color: '#EF4444' },
    ],
  },
  hotel: {
    title: 'Bienvenue',
    subtitle: 'Check-in, room service, conciergerie — à votre service',
    voicePrompt: 'Tu es le concierge IA de l\'hôtel. Tu gères le check-in/out, le room service, les recommandations locales. Sois luxueux et attentionné.',
    actions: [
      { icon: '🛎️', label: 'Check-in', action: 'Je voudrais faire le check-in', color: '#3B82F6' },
      { icon: '🍽️', label: 'Room Service', action: 'Commander le room service', color: '#F97316' },
      { icon: '🗺️', label: 'Conciergerie', action: 'Que recommandez-vous à faire dans la ville ?', color: '#8B5CF6' },
      { icon: '🚪', label: 'Check-out', action: 'Je voudrais faire le check-out', color: '#10B981' },
    ],
  },
  education: {
    title: 'Bienvenue',
    subtitle: 'Inscriptions, emploi du temps, informations',
    voicePrompt: 'Tu es l\'assistant IA de l\'établissement scolaire. Tu aides les étudiants et parents avec les inscriptions, emplois du temps, notes. Sois pédagogue et patient.',
    actions: [
      { icon: '📝', label: 'Inscription', action: 'Je voudrais m\'inscrire', color: '#3B82F6' },
      { icon: '📅', label: 'Emploi du temps', action: 'Quel est mon emploi du temps ?', color: '#10B981' },
      { icon: '📊', label: 'Résultats', action: 'Voir mes résultats', color: '#F59E0B' },
      { icon: '❓', label: 'Informations', action: 'J\'ai une question', color: '#8B5CF6' },
    ],
  },
};

// Map industry keywords to config keys
function getKioskConfig(industry: string): KioskConfig {
  const lower = (industry ?? '').toLowerCase();
  if (lower.includes('restau') || lower.includes('food') || lower.includes('cafe')) return KIOSK_CONFIGS.restaurant!;
  if (lower.includes('sant') || lower.includes('health') || lower.includes('clini') || lower.includes('medic')) return KIOSK_CONFIGS.sante!;
  if (lower.includes('beaut') || lower.includes('salon') || lower.includes('coiff')) return KIOSK_CONFIGS.beaute!;
  if (lower.includes('auto') || lower.includes('garage') || lower.includes('mecani') || lower.includes('car')) return KIOSK_CONFIGS.automobile!;
  if (lower.includes('commer') || lower.includes('shop') || lower.includes('retail') || lower.includes('magasin')) return KIOSK_CONFIGS.commerce!;
  if (lower.includes('hotel') || lower.includes('hospi')) return KIOSK_CONFIGS.hotel!;
  if (lower.includes('educ') || lower.includes('school') || lower.includes('univ')) return KIOSK_CONFIGS.education!;
  // Default generic kiosk
  return {
    title: 'Bienvenue',
    subtitle: 'Comment pouvons-nous vous aider ?',
    voicePrompt: 'Tu es l\'assistant IA. Aide les visiteurs avec leurs questions. Sois professionnel et chaleureux.',
    actions: [
      { icon: '📅', label: 'Rendez-vous', action: 'Je voudrais prendre rendez-vous', color: '#3B82F6' },
      { icon: '❓', label: 'Question', action: 'J\'ai une question', color: '#10B981' },
      { icon: '📞', label: 'Contact', action: 'Comment vous contacter ?', color: '#F97316' },
      { icon: '📋', label: 'Services', action: 'Quels sont vos services ?', color: '#8B5CF6' },
    ],
  };
}

const LANGS = [
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'ar', label: 'AR', flag: '🇸🇦' },
];

export default function AgentKioskPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { company } = useAuthStore();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('fr');
  const [mode, setMode] = useState<'home' | 'voice'>('home');
  const [voiceInitPrompt, setVoiceInitPrompt] = useState('');

  useEffect(() => {
    api.get(`/marketplace/agents/${agentId}`)
      .then(r => setAgent(r.data as AgentDetail))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-950"><Loader2 className="animate-spin text-white/30" size={32} /></div>;
  if (!agent) return <div className="flex items-center justify-center h-screen bg-gray-950 text-white/50">Agent non trouvé</div>;

  const config = getKioskConfig(agent.industry);
  const bgColor = agent.color?.startsWith('#') ? agent.color : '#0055FF';
  const companyName = company?.name ?? '';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (mode === 'voice') {
    return (
      <div className="w-full h-screen flex flex-col bg-gray-950">
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
          <button onClick={() => { setMode('home'); setVoiceInitPrompt(''); }}
            className="flex items-center gap-2 text-white/50 hover:text-white text-sm">
            <ArrowLeft size={18} /> Retour
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{agent.icon}</span>
            <span className="text-sm text-white/70 font-medium">{agent.name}</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-2" />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-white/30" size={32} /></div>}>
            <GeminiLiveChat theme="dark" language={lang} voiceName="Kore"
              enterpriseContext={{
                mode: 'kiosk',
                companyName: companyName || 'Orlode',
                companyId: (company as unknown as Record<string, unknown>)?.id as string ?? '',
                userName: 'visiteur',
                language: lang,
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col items-center justify-between bg-gray-950 text-white select-none overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-3xl" style={{ background: `${bgColor}08` }} />
      </div>

      {/* Top — time + lang */}
      <div className="w-full flex items-center justify-between px-8 pt-6 relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/kiosk')} className="text-white/30 hover:text-white/60 text-xs">← Accueil</button>
          <span className="text-2xl font-bold text-white">{timeStr}</span>
        </div>
        <div className="flex gap-1.5">
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                lang === l.code ? 'bg-white text-gray-900 font-bold' : 'text-white/30 bg-white/5 hover:bg-white/10'
              }`}>
              {l.flag}
            </button>
          ))}
        </div>
      </div>

      {/* Center — Agent + Voice */}
      <div className="text-center relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <span className="text-6xl mb-4">{agent.icon}</span>
        <h1 className="text-3xl sm:text-4xl font-bold mb-1">{config.title}</h1>
        <p className="text-base text-white/40 mb-2">{agent.name} — {companyName}</p>
        <p className="text-sm text-white/30 mb-8 max-w-md">{config.subtitle}</p>

        {/* Voice CTA */}
        <button onClick={() => setMode('voice')} className="group relative mb-4">
          <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${bgColor}15`, animationDuration: '2s' }} />
          <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105 group-active:scale-95"
            style={{ background: bgColor }}>
            <Mic size={36} className="text-white" />
          </div>
        </button>
        <p className="text-xs text-white/30">Voix + Caméra · Gemini Live</p>
      </div>

      {/* Bottom — Quick actions */}
      <div className="w-full px-6 pb-8 relative z-10">
        <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto">
          {config.actions.map(act => (
            <button key={act.label}
              onClick={() => { setVoiceInitPrompt(act.action); setMode('voice'); }}
              className="rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-all hover:opacity-90 shadow-lg"
              style={{ background: act.color }}>
              <span className="text-2xl">{act.icon}</span>
              <span className="text-[11px] font-semibold text-white text-center leading-tight">{act.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
