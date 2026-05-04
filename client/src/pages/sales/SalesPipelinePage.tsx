/**
 * Sales Pipeline — Kanban premium with drag-and-drop + responsive
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Filter, ArrowLeft, AlertTriangle, Eye, GripVertical,
  Flame, Snowflake, Thermometer, Bot, Sparkles, Zap,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SalesNav from './_SalesNav';

interface Lead {
  id: string; name: string; company?: string; email?: string;
  score: number; stage: string; estimatedValue: number;
}

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenSoft: '#E8F5EE', cream: '#FFFAF0',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  yellow: '#FFB347', yellowSoft: '#FFF4E0',
  red: '#FF3D00', redSoft: '#FFE0DA',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  purple: '#8B5CF6',
  ink: '#0A2A20', inkSoft: '#5A6B62', onGreenSoft: '#A8C9B8',
};

const STAGES_DEF: { key: string; name: string; color: string }[] = [
  { key: 'nouveau', name: 'Nouveau', color: C.blue },
  { key: 'contacte', name: 'Contacté', color: C.purple },
  { key: 'interesse', name: 'Intéressé', color: C.yellow },
  { key: 'devis_envoye', name: 'Devis envoyé', color: C.orange },
  { key: 'negociation', name: 'Négociation', color: C.red },
  { key: 'gagne', name: 'Gagné', color: C.greenDeep },
];

const heatColors = (score: number): { bg: string; color: string; label: string; icon: typeof Flame } => {
  if (score >= 70) return { bg: C.orangeSoft, color: C.orangeDeep, label: 'Chaud', icon: Flame };
  if (score >= 40) return { bg: C.yellowSoft, color: '#A87800', label: 'Tiède', icon: Thermometer };
  return { bg: C.blueSoft, color: C.blue, label: 'Froid', icon: Snowflake };
};

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

export default function SalesPipelinePage() {
  const { symbol } = useCurrency();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => {
    api.get('/sales/leads').then(r => {
      const d = r.data as unknown;
      const arr = Array.isArray(d) ? d : (d as { leads?: Lead[] })?.leads ?? [];
      setLeads(arr as Lead[]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageKey) setDragOverStage(stageKey);
  };

  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    if (!id) return;
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.stage === stageKey) {
      handleDragEnd();
      return;
    }
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: stageKey } : l));
    handleDragEnd();
    try {
      await api.patch(`/sales/leads/${id}`, { stage: stageKey });
    } catch {
      // Revert on error
      setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: lead.stage } : l));
    }
  };

  const totalValue = leads.filter(l => l.stage !== 'perdu').reduce((s, l) => s + (l.estimatedValue || 0), 0);
  const atRisk = leads.filter(l => l.score < 30 && l.stage !== 'perdu' && l.stage !== 'gagne').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .sp-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .sp-display{font-family:'Fraunces',serif;font-optical-sizing:auto;letter-spacing:-.02em}
        .sp-mono{font-family:'JetBrains Mono',monospace}

        .sp-hero{background:linear-gradient(135deg,${C.orange} 0%,${C.orangeDeep} 100%);border-radius:24px;padding:32px 36px;position:relative;overflow:hidden;color:${C.cream};box-shadow:0 30px 60px -20px rgba(255,107,26,.4)}
        .sp-grain::before{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");opacity:.06;pointer-events:none;mix-blend-mode:overlay;border-radius:inherit}
        .sp-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}

        .sp-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-family:inherit;box-shadow:0 8px 24px -8px rgba(255,107,26,.5)}
        .sp-btn-primary:hover{background:${C.orangeDeep};transform:translateY(-2px)}
        .sp-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .sp-btn-secondary:hover{background:${C.greenDeep};color:${C.cream}}
        .sp-btn-hero{background:rgba(255,250,240,.15);border:1px solid rgba(255,250,240,.25);color:${C.cream};padding:8px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none}
        .sp-btn-hero:hover{background:rgba(255,250,240,.25)}

        .sp-board{display:grid;grid-template-columns:repeat(6,minmax(260px,1fr));gap:16px}
        @media(max-width:1400px){.sp-board{grid-template-columns:repeat(3,minmax(240px,1fr))}}
        @media(max-width:900px){.sp-board{grid-template-columns:repeat(2,minmax(200px,1fr))}}
        @media(max-width:600px){.sp-board{grid-template-columns:1fr;gap:12px}}

        .sp-col{background:${C.greenDark};border-radius:18px;border:1px solid rgba(255,250,240,.06);padding:14px;display:flex;flex-direction:column;gap:10px;min-height:300px;transition:all .2s}
        .sp-col.drag-over{background:rgba(255,107,26,.15);border-color:${C.orange};box-shadow:0 0 24px rgba(255,107,26,.3) inset}
        .sp-col-head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 14px;border-bottom:1px solid rgba(255,250,240,.08);margin-bottom:4px}

        .sp-card{background:${C.cream};border-radius:14px;padding:16px;cursor:grab;transition:all .25s cubic-bezier(.4,0,.2,1);border:1px solid rgba(10,42,32,.06);position:relative;text-decoration:none;display:block;user-select:none}
        .sp-card:hover{transform:translateY(-3px);box-shadow:0 16px 32px -12px rgba(0,0,0,.25)}
        .sp-card.dragging{opacity:.4;cursor:grabbing;transform:rotate(2deg)}
        .sp-card::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--accent)}

        .sp-progress{height:6px;border-radius:3px;background:rgba(10,42,32,.08);overflow:hidden}
        .sp-progress-fill{height:100%;border-radius:3px;transition:width .4s}

        .sp-empty-zone{border:2px dashed rgba(255,250,240,.15);border-radius:12px;padding:24px 12px;text-align:center;font-size:12px;color:${C.onGreenSoft};font-weight:500;flex:1;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .sp-col.drag-over .sp-empty-zone{border-color:${C.orange};color:${C.orange};background:rgba(255,107,26,.05)}
        .sp-add-btn{background:transparent;border:1px dashed rgba(255,250,240,.15);border-radius:10px;padding:10px;color:${C.onGreenSoft};font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;transition:all .2s}
        .sp-add-btn:hover{background:rgba(255,250,240,.05);color:${C.cream}}

        .sp-drop-hint{padding:14px 18px;border-radius:12px;background:rgba(255,107,26,.15);border:1px dashed ${C.orange};color:${C.cream};font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;animation:spDrag 1.5s ease-in-out infinite}
        @keyframes spDrag{0%,100%{opacity:.7}50%{opacity:1}}

        @media(max-width:700px){.sp-root{padding:16px}.sp-hero{padding:24px}.sp-hero h1{font-size:32px !important}}
      `}</style>

      <div className="sp-root">
        <div className="sp-hero sp-grain">
          <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="140" cy="140" r="40" stroke={C.greenDeep} strokeWidth="2" fill="none" />
            <circle cx="140" cy="140" r="14" fill={C.greenDeep} />
          </svg>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <Link to="/sales" className="sp-btn-hero"><ArrowLeft size={16} /></Link>
                {atRisk > 0 && (
                  <span className="sp-pill" style={{ background: C.greenDeep, color: C.cream, border: '1px solid rgba(255,250,240,.2)' }}>
                    <AlertTriangle size={11} /> {atRisk} deal{atRisk > 1 ? 's' : ''} à risque
                  </span>
                )}
              </div>
              <h1 className="sp-display" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, margin: 0, color: C.cream, letterSpacing: '-.03em' }}>
                Pipeline <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>commercial.</em>
              </h1>
              <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,.85)', maxWidth: 540 }}>
                {leads.length} affaire{leads.length > 1 ? 's' : ''} · Pipeline <span className="sp-mono">{symbol}{fmt(totalValue)}</span> · Glissez les cartes entre les colonnes
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="sp-btn-secondary"><Filter size={14} /> Filtres</button>
              <Link to="/sales/leads" className="sp-btn-primary"><Plus size={16} /> Nouveau lead</Link>
            </div>
          </div>
        </div>

        <SalesNav />

        {/* Drag hint banner */}
        {draggingId && (
          <div style={{ marginTop: 16 }}>
            <div className="sp-drop-hint">
              <GripVertical size={16} />
              Déposez la carte sur la colonne d'étape souhaitée — la mise à jour est instantanée.
            </div>
          </div>
        )}

        {/* Kanban board */}
        <div style={{ marginTop: 24 }}>
          <div className="sp-board">
            {STAGES_DEF.map(stage => {
              const stageLeads = leads.filter(l => l.stage === stage.key);
              const stageValue = stageLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0);
              const isOver = dragOverStage === stage.key;
              return (
                <div
                  key={stage.key}
                  className={`sp-col ${isOver ? 'drag-over' : ''}`}
                  onDragOver={e => handleDragOver(e, stage.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, stage.key)}
                >
                  <div className="sp-col-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 50, background: stage.color, boxShadow: `0 0 12px ${stage.color}` }} />
                      <span className="sp-display" style={{ fontWeight: 700, fontSize: 15, color: C.cream }}>{stage.name}</span>
                      <span className="sp-mono" style={{ background: 'rgba(255,250,240,.1)', color: C.cream, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100 }}>{stageLeads.length}</span>
                    </div>
                    <span className="sp-mono" style={{ fontSize: 11, color: C.onGreenSoft }}>{symbol}{fmt(stageValue)}</span>
                  </div>

                  {loading ? null : stageLeads.length === 0 ? (
                    <div className="sp-empty-zone">
                      {isOver ? '✓ Déposer ici' : 'Aucune affaire'}
                    </div>
                  ) : (
                    stageLeads.map(lead => {
                      const heat = heatColors(lead.score);
                      const HeatIcon = heat.icon;
                      const atRiskLead = lead.score < 30;
                      const isDragging = draggingId === lead.id;
                      return (
                        <div
                          key={lead.id}
                          className={`sp-card ${isDragging ? 'dragging' : ''}`}
                          style={{ ['--accent' as never]: atRiskLead ? C.red : stage.color }}
                          draggable
                          onDragStart={e => handleDragStart(e, lead.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            {atRiskLead ? (
                              <span className="sp-pill" style={{ background: C.redSoft, color: C.red }}><AlertTriangle size={11} /> At Risk</span>
                            ) : lead.score >= 70 ? (
                              <span className="sp-pill" style={{ background: C.orangeSoft, color: C.orangeDeep }}><Flame size={11} /> Hot</span>
                            ) : (
                              <span className="sp-pill" style={{ background: C.greenSoft, color: C.greenDeep }}><Eye size={11} /> Watch</span>
                            )}
                            <GripVertical size={16} color={C.inkSoft} style={{ cursor: 'grab' }} />
                          </div>
                          <div className="sp-display" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{lead.name}</div>
                          {lead.company && <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8 }}>{lead.company}</div>}
                          <div className="sp-mono" style={{ fontSize: 18, fontWeight: 700, color: C.greenDeep, marginBottom: 12 }}>
                            {symbol}{fmt(lead.estimatedValue || 0)}
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11 }}>
                              <span style={{ color: C.inkSoft, fontWeight: 600 }}>Score IA</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="sp-mono" style={{ color: C.ink, fontWeight: 700 }}>{lead.score}%</span>
                                <span className="sp-pill" style={{ background: heat.bg, color: heat.color, padding: '2px 8px', fontSize: 10 }}>
                                  <HeatIcon size={10} /> {heat.label}
                                </span>
                              </div>
                            </div>
                            <div className="sp-progress">
                              <div className="sp-progress-fill" style={{ width: `${lead.score}%`, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}aa)` }} />
                            </div>
                          </div>
                          {atRiskLead && (
                            <div style={{ background: C.redSoft, borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 11, color: C.red, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Bot size={12} /> Action requise
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="sp-pill" style={{ background: C.yellowSoft, color: '#A87800' }}>
                              <Zap size={11} /> {lead.score >= 70 ? 'HIGH' : lead.score >= 40 ? 'MED' : 'LOW'}
                            </span>
                            <Link to={`/sales/leads/${lead.id}`} style={{ fontSize: 11, color: C.greenDeep, textDecoration: 'none', fontWeight: 600 }}>Détails →</Link>
                          </div>
                          {atRiskLead && (
                            <div style={{ marginTop: 10, padding: '8px 10px', background: C.greenSoft, borderRadius: 8, fontSize: 11, color: C.greenDeep, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Sparkles size={11} /> Lancer séquence nurturing
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {stageLeads.length > 0 && (
                    <button className="sp-add-btn"><Plus size={14} /> Ajouter</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
