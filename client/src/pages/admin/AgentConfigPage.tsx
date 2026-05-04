import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Brain, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { toast } from '@/components/common/Toast';

interface AgentConfig {
  name: string; displayName: string; model: string; enabled: boolean;
  customInstructions: string; callsToday: number; status: string;
}

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'claude-opus-4-6', 'claude-sonnet-4-6', 'gpt-4o'];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`block w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function AgentConfigPage() {
  const { t } = useLangStore();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/agents/status').then(r => setAgents(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleAgent = (name: string) => {
    const agent = agents.find(a => a.name === name);
    const newEnabled = agent ? !agent.enabled : true;
    setAgents(p => p.map(a => a.name === name ? { ...a, enabled: newEnabled } : a));
    // Real endpoint: POST /agents/:agentId/toggle
    api.post(`/agents/${name}/toggle`, { enabled: newEnabled })
      .then(() => toast.success(newEnabled ? 'Agent activé' : 'Agent désactivé', name))
      .catch((e: any) => {
        // Revert on failure
        setAgents(p => p.map(a => a.name === name ? { ...a, enabled: !newEnabled } : a));
        toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
      });
  };

  const updateModel = (name: string, model: string) => {
    setAgents(p => p.map(a => a.name === name ? { ...a, model } : a));
  };

  const updateInstructions = (name: string, instructions: string) => {
    setAgents(p => p.map(a => a.name === name ? { ...a, customInstructions: instructions } : a));
  };

  const save = (_name: string) => {
    // Per-agent model override + custom instructions endpoint not yet implemented server-side.
    // Kept visible so users can preview the planned UX, but doesn't pretend to save.
    toast.info(
      'Configuration avancée — bientôt',
      'Le choix du modèle et les instructions custom seront persistés dans la prochaine release. Le toggle activé/désactivé fonctionne déjà.',
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuration des agents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Activez, configurez et personnalisez chaque agent IA</p>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-12">{`${t('loading')}`}</div>
      ) : (
        <div className="space-y-2">
          {agents.map(agent => (
            <div key={agent.name} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === agent.name ? null : agent.name)}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0019FF15, #0092FF15)' }}>
                  <Brain size={15} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{agent.displayName}</p>
                  <p className="text-xs text-gray-400">{agent.model} · {agent.callsToday} calls aujourd'hui</p>
                </div>
                <Toggle checked={agent.enabled} onChange={() => toggleAgent(agent.name)} />
                {expanded === agent.name ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>

              {expanded === agent.name && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Modèle AI</label>
                    <select value={agent.model} onChange={e => updateModel(agent.name, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Instructions custom (override le prompt par défaut)</label>
                    <textarea rows={4} value={agent.customInstructions} onChange={e => updateInstructions(agent.name, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Laissez vide pour utiliser les instructions par défaut..." />
                  </div>
                  <button onClick={() => save(agent.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                    style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
                    <Save size={12} /> Sauvegarder
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
