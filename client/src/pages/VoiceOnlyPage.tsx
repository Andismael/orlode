/**
 * VoiceOnlyPage — Voice agent qui parle au nom de l'entreprise (pas Orlode)
 * URL param ?agent=hr (optional) pour contexte agent spécifique
 */
import { lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const GeminiLiveChat = lazy(() => import('@/components/ai/GeminiLiveChat'));

const AGENT_ROLES: Record<string, string> = {
  hr: 'Agent RH', accounting: 'Agent Comptabilité', sales: 'Agent Sales',
  marketing: 'Agent Marketing', legal: 'Agent Juridique', knowledge: 'Agent Knowledge',
  reception: 'Agent Réception', support: 'Agent Support', comms: 'Agent Communications',
  orchestrator: 'Assistant général', it: 'Agent IT', cybersecurity: 'Agent Cybersécurité',
};

export default function VoiceOnlyPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, company } = useAuthStore();

  const agentId = params.get('agent') ?? 'orchestrator';
  const agentRole = AGENT_ROLES[agentId] ?? 'Assistant';

  // Build enterprise context — uses real company + user from auth store
  const enterpriseContext = company && user ? {
    companyName: company.name,
    companyId: company.id,
    userName: user.displayName || user.email,
    userRole: user.role,
    userEmail: user.email,
    language: company.settings?.aiLanguage ?? company.settings?.language ?? 'fr',
    mode: 'enterprise' as const,
  } : undefined;

  const headerLabel = company?.name ? `${company.name} · Voice` : 'Voice';

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-white">{headerLabel}</span>
            <span className="text-[10px] text-gray-500">{agentRole}</span>
          </div>
        </div>
        <span className="text-xs text-gray-500 ml-auto">Gemini Live</span>
      </div>

      {/* Gemini Live Chat — passes enterpriseContext so the agent speaks AS the company */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        }>
          {enterpriseContext ? (
            <GeminiLiveChat enterpriseContext={enterpriseContext} theme="dark" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2 px-6 text-center">
              <Loader2 className="animate-spin" size={20} />
              Chargement du contexte entreprise…
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}
