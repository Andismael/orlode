/**
 * ByoeGateBanner — shown globally when the company is not BYOE-configured
 * and has no active hosted exception. Blocks-in-spirit: agents return 402 until resolved.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function ByoeGateBanner() {
  const { company, user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  // Read raw company doc fields not always present in type
  const c = company as unknown as {
    byoeEnabled?: boolean;
    hostedByOrlode?: boolean;
    hostedException?: { expiresAt?: string; reason?: string };
  } | null;

  // SuperAdmin bypass — don't show the banner to the platform owner
  const isSuperAdmin = (user as unknown as { superAdmin?: boolean } | null)?.superAdmin === true;
  if (isSuperAdmin) return null;

  if (!c) return null;
  if (dismissed) return null;

  // SuperAdmin has granted permanent Orlode hosting → no BYOE needed, ever.
  // Set via PATCH /api/superadmin/companies/:id/hosted-by-orlode.
  if (c.hostedByOrlode === true) return null;

  const byoeOk = c.byoeEnabled === true;
  const ex = c.hostedException;
  const exActive = ex?.expiresAt && new Date(ex.expiresAt).getTime() > Date.now();

  // All good — don't show
  if (byoeOk) return null;

  // Active hosted exception — show soft info only
  if (exActive && ex?.expiresAt) {
    const hoursLeft = Math.ceil((new Date(ex.expiresAt).getTime() - Date.now()) / 3600 / 1000);
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center gap-3">
        <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
        <p className="text-xs text-blue-900 flex-1">
          Accès hébergé actif — <strong>{hoursLeft}h restantes</strong>. Pour un accès illimité, configurez votre propre hébergement.
        </p>
        <Link to="/admin/byoe" className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1">
          Config BYOE <ArrowRight size={11} />
        </Link>
        <button onClick={() => setDismissed(true)} className="text-xs text-blue-500 hover:text-blue-700">×</button>
      </div>
    );
  }

  // No BYOE, no exception — blocking banner
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-orange-300 px-4 py-3">
      <div className="flex items-center gap-3 max-w-6xl mx-auto">
        <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
          <Server size={18} className="text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-orange-900">Configurez votre hébergement pour activer les agents IA</p>
          <p className="text-xs text-orange-800 mt-0.5">
            Chaque entreprise héberge ses données sur son propre Firebase. Setup ~5 min.
          </p>
        </div>
        <Link to="/admin/byoe"
          className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all">
          Configurer <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
