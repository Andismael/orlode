/**
 * DataDeletionPage — public confirmation page for Meta's data deletion callback.
 * User lands here after Meta redirects (with ?code=xxx) and can see status.
 * Also usable as a manual request form for GDPR-style deletions.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, Clock, XCircle, Loader2, Mail } from 'lucide-react';

interface DeletionStatus {
  status: 'pending' | 'completed' | 'failed';
  requestedAt?: string | { _seconds: number };
  completedAt?: string | { _seconds: number } | null;
}

export default function DataDeletionPage() {
  const [params] = useSearchParams();
  const code = params.get('code');
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(!!code);

  useEffect(() => {
    if (!code) return;
    const fetchStatus = async () => {
      try {
        const r = await fetch(`/api/data-deletion/status/${code}`);
        if (!r.ok) return;
        const data = await r.json() as { success: boolean; status: string; requestedAt?: unknown; completedAt?: unknown };
        setStatus({
          status: data.status as DeletionStatus['status'],
          requestedAt: data.requestedAt as DeletionStatus['requestedAt'],
          completedAt: data.completedAt as DeletionStatus['completedAt'],
        });
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchStatus();
    // Poll while pending
    const interval = setInterval(() => {
      if (!status || status.status === 'pending') fetchStatus();
      else clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [code]); // eslint-disable-line

  const fmt = (ts?: DeletionStatus['requestedAt']): string => {
    if (!ts) return '';
    const d = typeof ts === 'string' ? new Date(ts) : new Date((ts as { _seconds: number })._seconds * 1000);
    return d.toLocaleString('fr-FR');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-1">Suppression des données</h1>
          <p className="text-white/80 text-sm">Orlode — par Ouihope NGO</p>
        </div>

        <div className="p-8">
          {code && loading && (
            <div className="text-center py-8">
              <Loader2 className="animate-spin text-violet-500 mx-auto mb-3" size={32} />
              <p className="text-sm text-gray-500">Vérification de votre demande…</p>
            </div>
          )}

          {code && status && (() => {
            const s = status.status;
            const Icon = s === 'completed' ? CheckCircle : s === 'failed' ? XCircle : Clock;
            const color = s === 'completed' ? 'text-emerald-500' : s === 'failed' ? 'text-rose-500' : 'text-amber-500';
            const bg = s === 'completed' ? 'bg-emerald-50' : s === 'failed' ? 'bg-rose-50' : 'bg-amber-50';
            const title = s === 'completed' ? 'Données supprimées' : s === 'failed' ? 'Suppression échouée' : 'Suppression en cours';
            const body = s === 'completed'
              ? "Toutes les données personnelles associées à votre compte Facebook ont été supprimées de Orlode."
              : s === 'failed'
              ? "Une erreur est survenue. Contactez privacy@orlode.com et nous traiterons manuellement."
              : "Votre demande est en cours de traitement. Cette opération prend généralement moins d'une minute.";
            return (
              <div className={`${bg} rounded-2xl p-6 text-center`}>
                <Icon className={`${color} mx-auto mb-3`} size={40} />
                <p className="font-bold text-gray-900 mb-1">{title}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                <div className="mt-5 text-xs text-gray-400 space-y-0.5">
                  <p>Code de confirmation : <span className="font-mono">{code}</span></p>
                  {status.requestedAt && <p>Demande : {fmt(status.requestedAt)}</p>}
                  {status.completedAt && <p>Traitée : {fmt(status.completedAt)}</p>}
                </div>
              </div>
            );
          })()}

          {!code && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                Vous pouvez demander la suppression de vos données personnelles stockées par Orlode à tout moment.
                Conformément au RGPD et à la politique Meta, votre demande sera traitée sous 30 jours maximum.
              </p>
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-800">Comment demander la suppression</h2>
                <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>Si vous avez connecté votre compte via Facebook, allez dans <strong>Paramètres Facebook → Applications et sites web</strong> et retirez Orlode. Meta nous notifiera automatiquement.</li>
                  <li>Sinon, envoyez un email à <a href="mailto:privacy@orlode.com" className="text-violet-600 hover:underline font-medium">privacy@orlode.com</a> avec votre adresse email utilisée sur Orlode.</li>
                </ol>
                <a href="mailto:privacy@orlode.com" className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold">
                  <Mail size={14} /> Contacter privacy@orlode.com
                </a>
              </div>
              <div className="text-xs text-gray-400 leading-relaxed">
                <p className="font-semibold text-gray-500 mb-1">Ce qui sera supprimé</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Votre profil utilisateur, nom, email, photo</li>
                  <li>Tous les tokens d'authentification Meta / Facebook / WhatsApp</li>
                  <li>Les conversations du Clone / assistant vocal</li>
                  <li>Vos messages, rendez-vous, tickets liés à votre identifiant</li>
                </ul>
                <p className="mt-2 text-gray-400">
                  Les données légalement obligatoires (factures, contrats signés) sont conservées le temps prévu par la loi puis anonymisées.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 pb-6 text-center text-xs text-gray-400">
          <a href="/legal/privacy" className="text-violet-600 hover:underline mx-2">Confidentialité</a>
          <a href="/legal/terms"   className="text-violet-600 hover:underline mx-2">Conditions</a>
          <a href="/legal/notice"  className="text-violet-600 hover:underline mx-2">Mentions légales</a>
        </div>
      </div>
    </div>
  );
}
