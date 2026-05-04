import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Search, RotateCcw, Zap } from 'lucide-react';

interface Skill {
  id: string; name: string; description: string; agent: string;
  category: string; plan: string; mcpRequired: string[]; enabled: boolean;
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-600',
  business: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`block w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function SkillsManagerPage() {
  const { t } = useLangStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterPlan, setFilterPlan] = useState('');

  useEffect(() => {
    api.get('/agents/skills').then(r => setSkills(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSkills(p => p.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    const skill = skills.find(s => s.id === id);
    if (skill) api.patch(`/agents/skills/${id}`, { enabled: !skill.enabled }).catch(() => {});
  };

  const reset = () => setSkills(p => p.map(s => ({ ...s, enabled: true })));

  const agents = [...new Set(skills.map(s => s.agent))].sort();

  const filtered = skills.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterAgent && s.agent !== filterAgent) return false;
    if (filterPlan && s.plan !== filterPlan) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.agent]) acc[s.agent] = [];
    acc[s.agent].push(s);
    return acc;
  }, {} as Record<string, Skill[]>);

  const enabledCount = skills.filter(s => s.enabled).length;

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">{enabledCount} activés sur {skills.length} disponibles</p>
        </div>
        <button onClick={reset} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          <RotateCcw size={13} /> Reset défaut
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('search')} />
        </div>
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les agents</option>
          {agents.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-12">{`${t('loading')}`}</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([agent, agentSkills]) => (
            <div key={agent} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Zap size={14} className="text-blue-600" />
                <span className="font-semibold text-gray-800 capitalize text-sm">{agent}</span>
                <span className="text-xs text-gray-400 ml-1">({agentSkills.filter(s => s.enabled).length}/{agentSkills.length})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {agentSkills.map(skill => (
                  <div key={skill.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{skill.id}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLAN_COLORS[skill.plan] ?? 'bg-gray-100 text-gray-600'}`}>{skill.plan}</span>
                        {skill.mcpRequired.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">MCP: {skill.mcpRequired.join(', ')}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{skill.description}</p>
                    </div>
                    <Toggle checked={skill.enabled} onChange={() => toggle(skill.id)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center text-sm text-gray-400 py-12">{`${t('no_data')}`}</div>
          )}
        </div>
      )}
    </div>
  );
}
