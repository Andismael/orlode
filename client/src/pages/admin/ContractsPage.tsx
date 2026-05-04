/**
 * /admin/contracts — list of e-signature contracts (powered by Wemas).
 *
 * The page is intentionally minimal: list view, status badges, signing-link
 * actions. Heavy contract work (templates, multi-party negotiation, audit log,
 * portfolios) lives in Wemas at wemas.click — we link out for that.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  FileSignature, Loader2, ExternalLink, RefreshCw, CheckCircle2, Clock, XCircle, AlertCircle, Send, Copy, Search,
} from 'lucide-react';

type Status = 'draft' | 'pending_signature' | 'signed' | 'rejected' | 'expired';

interface Contract {
  id: string;
  signatoryName: string;
  signatoryEmail: string;
  status: Status;
  contractType: string;
  signingUrl: string;
  createdAt: string;
  expiresAt: string;
  senderSignedAt?: string | null;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: any }> = {
  draft:             { label: 'Brouillon',  color: '#6B7280', bg: '#F3F4F6', icon: AlertCircle },
  pending_signature: { label: 'En attente', color: '#D97706', bg: '#FEF3C7', icon: Clock },
  signed:            { label: 'Signé',      color: '#059669', bg: '#D1FAE5', icon: CheckCircle2 },
  rejected:          { label: 'Refusé',     color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  expired:           { label: 'Expiré',     color: '#6B7280', bg: '#F3F4F6', icon: Clock },
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  cdi: 'CDI', cdd: 'CDD', stage: 'Stage', freelance: 'Freelance',
  prestation_services: 'Prestation de services', partenariat: 'Partenariat',
  nda: 'NDA', licence: 'Licence', custom: 'Personnalisé',
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [wemasConfigured, setWemasConfigured] = useState(true);
  const [wemasFrontendUrl, setWemasFrontendUrl] = useState('https://wemas.click');
  const [resending, setResending] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [statusR, listR] = await Promise.all([
        api.get<{ data: { configured: boolean; frontendUrl: string } }>('/contracts/status'),
        api.get<{ data: Contract[]; wemasConfigured: boolean }>('/contracts'),
      ]);
      const status = statusR.data as any;
      const list = listR.data as any;
      setWemasConfigured(status?.data?.configured ?? false);
      setWemasFrontendUrl(status?.data?.frontendUrl ?? 'https://wemas.click');
      setContracts(list?.data ?? []);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Impossible de charger les contrats');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleResend = async (id: string) => {
    setResending(id);
    try {
      await api.post(`/contracts/${id}/resend`, {});
      toast.success('Email de signature renvoyé');
      load();
    } catch (e: any) {
      toast.error('Échec renvoi', e?.response?.data?.message ?? 'Réessaie');
    } finally { setResending(null); }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Lien copié');
  };

  const filtered = contracts.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search && !`${c.signatoryName} ${c.signatoryEmail}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<Status | 'all', number> = {
    all: contracts.length,
    draft: contracts.filter(c => c.status === 'draft').length,
    pending_signature: contracts.filter(c => c.status === 'pending_signature').length,
    signed: contracts.filter(c => c.status === 'signed').length,
    rejected: contracts.filter(c => c.status === 'rejected').length,
    expired: contracts.filter(c => c.status === 'expired').length,
  };

  if (!wemasConfigured) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center">
          <FileSignature size={48} className="text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Signature électronique non configurée</h1>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Pour permettre à tes agents IA de faire signer les contrats, devis et NDA automatiquement,
            connecte ton workspace à <strong>Wemas</strong> (notre moteur de signatures).
          </p>
          <a href="https://wemas.click" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-semibold"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
            <ExternalLink size={14} /> Découvrir Wemas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileSignature size={26} className="text-blue-600" />
            Contrats & signatures
          </h1>
          <p className="text-sm text-gray-500 mt-1">Signature électronique propulsée par <a href={wemasFrontendUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Wemas</a> — tes agents peuvent envoyer pour signature directement depuis le chat.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
          <a href={wemasFrontendUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white rounded-lg font-semibold"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
            Ouvrir Wemas <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending_signature', 'signed', 'draft', 'rejected', 'expired'] as const).map(s => {
          const isActive = filter === s;
          const cfg = s === 'all' ? null : STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'Tous' : cfg?.label} <span className="opacity-60">({counts[s]})</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Empty / loading / list */}
      {loading ? (
        <div className="bg-white rounded-2xl p-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <FileSignature size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 mb-1">Aucun contrat {filter !== 'all' ? `· ${STATUS_CONFIG[filter].label}` : ''}</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Demande à un agent : <em>"Prépare un CDI pour Moussa et envoie-le pour signature"</em> ou <em>"Envoie le devis Q-2026-0042 au client pour signature"</em>.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {filtered.map(c => {
            const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending_signature;
            const Icon = cfg.icon;
            const typeLabel = CONTRACT_TYPE_LABEL[c.contractType?.toLowerCase()] ?? c.contractType;
            return (
              <div key={c.id} className="p-4 flex items-start gap-4 hover:bg-gray-50">
                <div style={{ background: cfg.bg, color: cfg.color }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{c.signatoryName}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-gray-100 text-gray-600">{typeLabel}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{c.signatoryEmail}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Créé le {new Date(c.createdAt).toLocaleDateString('fr-FR')} · Expire le {new Date(c.expiresAt).toLocaleDateString('fr-FR')}
                    {c.senderSignedAt && ` · Signé par toi le ${new Date(c.senderSignedAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => copyLink(c.signingUrl)}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600" title="Copier le lien">
                    <Copy size={13} />
                  </button>
                  {c.status === 'pending_signature' && (
                    <button onClick={() => handleResend(c.id)} disabled={resending === c.id}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 disabled:opacity-50" title="Renvoyer l'email de signature">
                      {resending === c.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  )}
                  <a href={c.signingUrl} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200" title="Ouvrir dans Wemas">
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-900 flex items-start gap-3">
        <FileSignature size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Comment générer un contrat depuis le chat ?</p>
          <p className="text-xs leading-relaxed">
            Demande à l'agent <strong>RH</strong> : <em>"Prépare un CDI pour [employé] et envoie-le pour signature"</em>.<br />
            Demande à l'agent <strong>Sales</strong> : <em>"Envoie le devis [Q-...] au client pour signature"</em>.<br />
            Pour la négociation multi-parties, les templates avancés ou les portfolios, ouvre <Link to="#" onClick={() => window.open(wemasFrontendUrl, '_blank')} className="underline">Wemas</Link> directement.
          </p>
        </div>
      </div>
    </div>
  );
}
