/**
 * Sales Activities — Activity feed (calls, emails, meetings, notes)
 */
import { useEffect, useState } from 'react';
import { Activity, Phone, Mail, Calendar, FileText, MessageSquare, Filter, Download } from 'lucide-react';
import api from '@/services/api';
import SalesHero from './_SalesHero';
import SalesNav from './_SalesNav';

interface ActivityItem {
  id: string; type: 'call' | 'email' | 'meeting' | 'note' | 'message' | string;
  date?: string; summary?: string; leadName?: string; leadId?: string;
  user?: string;
}

const C = {
  greenDeep: '#0A4F3C', greenSoft: '#E8F5EE', cream: '#FFFAF0',
  orange: '#FF6B1A', orangeDeep: '#E5530C',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  yellow: '#FFB347', yellowSoft: '#FFF4E0',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const typeStyle = (t: string): { icon: typeof Phone; color: string; bg: string; label: string } => {
  switch (t) {
    case 'call': return { icon: Phone, color: C.purple, bg: C.purpleSoft, label: 'Appel' };
    case 'email': return { icon: Mail, color: C.blue, bg: C.blueSoft, label: 'Email' };
    case 'meeting': return { icon: Calendar, color: C.orange, bg: '#FFE8D6', label: 'Réunion' };
    case 'note': return { icon: FileText, color: C.greenDeep, bg: C.greenSoft, label: 'Note' };
    case 'message':
    default: return { icon: MessageSquare, color: '#A87800', bg: C.yellowSoft, label: t || 'Activité' };
  }
};

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

export default function SalesActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sales/activities').then(r => {
      const d = r.data as unknown;
      const arr = Array.isArray(d) ? d : (d as { activities?: ActivityItem[] })?.activities ?? [];
      setActivities(arr as ActivityItem[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <style>{`
        .sa-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .sa-mono{font-family:'JetBrains Mono',monospace}
        .sa-display{font-family:'Fraunces',serif}
        .sa-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
        .sa-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-family:inherit}
        .sa-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .sa-row{background:${C.cream};border-radius:16px;padding:18px 20px;border:1px solid rgba(10,42,32,.06);transition:all .2s;display:flex;align-items:center;gap:16px}
        .sa-row:hover{transform:translateX(4px);border-color:${C.orange};box-shadow:0 12px 24px -12px rgba(255,107,26,.25)}
      `}</style>
      <div className="sa-root">
        <SalesHero
          title="Activités"
          italic="& interactions."
          subtitle={<>Tous les appels, emails, réunions et notes — historique complet de votre équipe commerciale.</>}
          pills={
            <span className="sa-pill" style={{ background: C.greenDeep, color: C.cream }}>
              <Activity size={11} /> {activities.length} ÉVÉNEMENTS
            </span>
          }
          actions={
            <>
              <button className="sa-btn-secondary"><Filter size={14} /> Filtres</button>
              <button className="sa-btn-secondary"><Download size={14} /> Export</button>
            </>
          }
        />
        <SalesNav />

        <div style={{ marginTop: 24 }}>
          {loading ? (
            <div style={{ background: 'rgba(255,250,240,.06)', borderRadius: 16, height: 80, animation: 'sivP 1.5s infinite' }} />
          ) : activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Activity size={28} color={C.cream} />
              </div>
              <h3 className="sa-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Aucune activité enregistrée</h3>
              <p style={{ fontSize: 13, color: C.inkSoft }}>Les appels, emails et réunions apparaîtront ici.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activities.map(a => {
                const t = typeStyle(a.type);
                const TypeIcon = t.icon;
                return (
                  <div key={a.id} className="sa-row">
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TypeIcon size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span className="sa-display" style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{a.leadName || a.user || 'Activité'}</span>
                        <span className="sa-pill" style={{ background: t.bg, color: t.color }}>{t.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.inkSoft }}>{a.summary || '—'}</div>
                    </div>
                    <span className="sa-mono" style={{ fontSize: 11, color: C.inkSoft, whiteSpace: 'nowrap' }}>{fmtDate(a.date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
