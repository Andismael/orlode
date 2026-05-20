/**
 * Meta Ads — admin config + test API call.
 *
 * Goal of this page : let the owner satisfy Meta's "make 1 successful API
 * call before requesting advanced access" requirement on ads_management.
 */
import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { Megaphone, CheckCircle2, AlertTriangle, Loader2, ExternalLink, Save, FlaskConical } from 'lucide-react';

export default function MetaAdsConfigPage() {
  const [adAccountId, setAdAccountId] = useState('');
  const [pageId, setPageId] = useState('');
  const [whatsappLinked, setWhatsappLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; campaignCount?: number; sample?: Array<{ id: string; name: string; status: string }> } | null>(null);

  useEffect(() => {
    api.get('/commerce/admin/meta-ads/config').then((r: any) => {
      setAdAccountId(r?.data?.adAccountId ?? '');
      setPageId(r?.data?.pageId ?? '');
      setWhatsappLinked(!!r?.data?.whatsappLinked);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/commerce/admin/meta-ads/config', {
        adAccountId: adAccountId.trim(),
        pageId: pageId.trim(),
      });
      toast.success('Configuration sauvegardée');
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? ''); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r: any = await api.post('/commerce/admin/meta-ads/test');
      const data = r?.data ?? {};
      setTestResult({
        ok: !!data.success,
        message: data.message ?? '',
        campaignCount: data.campaignCount,
        sample: data.sampleCampaigns,
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.response?.data?.message ?? String(e?.message ?? e) });
    } finally { setTesting(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone size={24} className="text-blue-600" />
          Meta Ads — Configuration
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connecte ton compte Meta Ads pour piloter les campagnes Click-to-WhatsApp directement depuis l'orchestrator (mode `@admin`).
        </p>
      </div>

      {!loading && !whatsappLinked && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>WhatsApp Business pas encore connecté.</strong> Les pubs Click-to-WhatsApp ont besoin d'un numéro WhatsApp Business + d'une page Facebook liée. Va sur <a href="/admin/whatsapp" className="underline font-semibold">/admin/whatsapp</a> d'abord.
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-800 mb-3">1. Identifiants Meta</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Ad Account ID</label>
            <input
              value={adAccountId}
              onChange={e => setAdAccountId(e.target.value)}
              placeholder="123456789012345"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Trouve-le sur <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noreferrer" className="underline">business.facebook.com → Comptes publicitaires</a>. Numérique uniquement (sans le préfixe <code className="bg-gray-100 px-1 rounded">act_</code>).
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">Page Facebook ID</label>
            <input
              value={pageId}
              onChange={e => setPageId(e.target.value)}
              placeholder="123456789012345"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Page liée au compte WhatsApp Business — requis par Meta pour les pubs CTW. Trouve-le sur ta page Facebook → À propos → ID.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-800 mb-1">2. Tester la connexion API</h2>
        <p className="text-xs text-gray-500 mb-3">
          Meta exige <strong>au moins 1 appel API réussi</strong> avant que le bouton "Demander l'accès avancé" pour <code className="bg-gray-100 px-1 rounded">ads_management</code> devienne actif (24h après l'appel). Ce test fait un GET listCampaigns — read-only, safe.
        </p>
        <button
          onClick={test}
          disabled={testing || !adAccountId}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
          Tester maintenant
        </button>
        {testResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-start gap-3 ${testResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-red-50 border border-red-200 text-red-900'}`}>
            {testResult.ok ? <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />}
            <div className="text-sm flex-1">
              <div className="font-semibold">{testResult.message}</div>
              {testResult.campaignCount !== undefined && (
                <div className="text-xs mt-1">
                  {testResult.campaignCount} campagne(s) lues.
                  {testResult.sample && testResult.sample.length > 0 && (
                    <ul className="mt-1 list-disc list-inside">
                      {testResult.sample.map(c => <li key={c.id}>{c.name} <span className="opacity-60">({c.status})</span></li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-3">3. Demander l'accès avancé sur Meta</h2>
        <p className="text-xs text-gray-500 mb-3">
          Une fois le test réussi (étape 2), attends <strong>jusqu'à 24h</strong>, puis va sur ta dashboard d'app Meta pour activer l'accès avancé du scope <code className="bg-gray-100 px-1 rounded">ads_management</code>.
        </p>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold"
        >
          Ouvrir Meta App Dashboard <ExternalLink size={13} />
        </a>
      </section>
    </div>
  );
}
