/**
 * CloneVoicePage — Public voice Clone (Gemini Live).
 * URL: /clone/:companyId/voice
 * No auth required.
 */
import { useParams } from 'react-router-dom';
import { ArrowLeft, Phone } from 'lucide-react';
import VoiceCloneChat from '@/components/clone/VoiceCloneChat';

export default function CloneVoicePage() {
  const { companyId } = useParams<{ companyId: string }>();

  if (!companyId) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-gray-600">ID entreprise manquant.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur border-b border-gray-200">
        <button onClick={() => history.back()} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Assistant vocal</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-4 text-center">
            <h1 className="text-xl font-bold text-gray-900">Parlez avec notre assistant</h1>
            <p className="text-sm text-gray-500 mt-1">Conversation vocale temps réel — toutes les actions sensibles sont validées par un agent.</p>
          </div>
          <VoiceCloneChat companyId={companyId} autoConnect={false} />
        </div>
      </div>
    </div>
  );
}
