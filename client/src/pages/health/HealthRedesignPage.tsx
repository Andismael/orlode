/**
 * Santé / Médical Pack — Phase 1 minimal.
 *
 * 2 tabs only :
 *   1. Patients      — fiches patients (identité + antécédents)
 *   2. Consultations — RDV avec motif + praticien
 *
 * Pitch : "Tes patients et tes RDV — en sécurité sur WhatsApp."
 *
 * Confidentialité : aucune donnée médicale n'est exposée dans les notifs WhatsApp.
 * Données stockées dans `patients` (subcollection dédiée, séparée des customers).
 */
import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Stethoscope, UserPlus, Plus, Loader2, X, Save, Trash2,
  Users, Clock, Calendar, Heart, Phone, Mail, Sparkles, AlertCircle, Settings,
} from 'lucide-react';
import { StoreSettingsModal } from '@/components/store/StoreSettingsModal';
import PackKpiStrip, { buildVerticalKpis } from '@/components/store/PackKpiStrip';

const NO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency = 'XOF'): string {
  const decimals = NO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency,
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n);
  } catch { return `${n.toLocaleString('fr-FR')} ${currency}`; }
}

const C = {
  teal:        '#14B8A6',
  tealDeep:    '#0F766E',
  tealSoft:    '#CCFBF1',
  tealLight:   '#5EEAD4',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  emeraldDeep: '#059669',
  emeraldSoft: '#D1FAE5',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  .btn-teal { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px; background:${C.tealDeep}; color:#fff; border:none; cursor:pointer; font-weight:700; font-size:13px; font-family:'Inter',sans-serif; box-shadow:0 6px 16px -6px ${C.teal}80; transition:transform .15s ease; }
  .btn-teal:hover { transform: translateY(-1px); }
  .btn-teal:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .btn-ghost { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px; background:transparent; color:${C.ink}; border:1.5px solid ${C.inkLight}; cursor:pointer; font-weight:600; font-size:13px; font-family:'Inter',sans-serif; }
  .pill { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px; font-weight:700; font-size:11px; }
`;

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthDate?: string;
  gender?: 'M' | 'F' | 'other';
  address?: string;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
  emergencyContact?: string;
  medicalNotes?: string;
}
interface Consultation {
  id: string;
  customerName: string;
  customerPhone: string;
  date: string;
  time: string;
  reason?: string;
  durationMinutes?: number;
  practitionerName?: string;
  patientId?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  source?: string;
}
interface Store {
  id: string;
  name: string;
  ownerPhone: string;
  currency: string;
}

function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export default function HealthRedesignPage() {
  const [tab, setTab] = useState<'patients' | 'consultations'>('patients');
  const [store, setStore] = useState<Store | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [addConsultationOpen, setAddConsultationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'health' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) { setStore(null); setPatients([]); setConsultations([]); return; }
      setStore(s);
      const [r2, r3] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/patients`).catch(() => ({ data: { patients: [] } })),
        api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
      ]);
      setPatients((r2 as any)?.data?.patients ?? []);
      setConsultations((r3 as any)?.data?.reservations ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayConsult = consultations.filter(c => c.date === today && c.status !== 'cancelled').length;
  const upcomingWeek = consultations.filter(c => {
    const d = new Date(c.date);
    const max = new Date();
    max.setDate(max.getDate() + 7);
    return d >= new Date(today) && d <= max && c.status !== 'cancelled';
  }).length;

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" color={C.teal} />
      </div>
    );
  }
  if (!store) return <HealthActivationScreen onCreated={() => fetchAll()} />;

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDeep} 100%)`,
        padding: '32px 32px 28px', color: C.cream, position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100,
            background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            <Stethoscope size={11} /> SANTÉ · CONFIDENTIEL
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="display-font" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
              {store.name}
            </h1>
            <button onClick={() => setSettingsOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
                color: C.cream, border: '1px solid rgba(255,250,240,0.25)',
                cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
              }}>
              <Settings size={13} /> Paramètres
            </button>
          </div>
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.92, maxWidth: 640 }}>
            Tes patients et tes RDV — en sécurité.
          </p>

          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Kpi label="Patients enregistrés" value={`${patients.length}`} icon={Users} />
            <Kpi label="RDV aujourd'hui"      value={`${todayConsult}`} icon={Calendar} />
            <Kpi label="Cette semaine"        value={`${upcomingWeek}`} icon={Clock} />
            <Kpi label="Total consultations"  value={`${consultations.length}`} icon={Heart} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.cream, borderBottom: '1px solid rgba(10,42,32,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 4 }}>
          {[
            { id: 'patients' as const,      label: 'Patients',      icon: Users,    count: patients.length },
            { id: 'consultations' as const, label: 'Consultations', icon: Calendar, count: consultations.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '14px 18px', background: 'transparent', border: 'none',
                borderBottom: tab === t.id ? `3px solid ${C.tealDeep}` : '3px solid transparent',
                color: tab === t.id ? C.tealDeep : C.inkSoft,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit',
              }}>
              <t.icon size={15} /> {t.label}
              {t.count > 0 && (
                <span style={{
                  background: tab === t.id ? `${C.tealDeep}15` : C.creamDeep,
                  color: tab === t.id ? C.tealDeep : C.inkSoft,
                  padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 800,
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 64px' }}>
        <PackKpiStrip items={buildVerticalKpis({
          itemsCount: patients.length, itemsLabel: 'Patients', itemsHint: 'au dossier',
          reservations: consultations as Array<{ customerPhone?: string; createdAt?: { _seconds?: number; toDate?: () => Date } | string | Date; totalAmount?: number; status?: string }>,
          currency: store.currency, bookingLabel: 'Consultations', formatPrice,
          accentColor: C.tealDeep, accentBg: `${C.tealDeep}15`,
        })} />
        {tab === 'patients' && (
          <PatientsTab patients={patients}
            onAdd={() => setAddPatientOpen(true)}
            onEdit={p => setEditingPatient(p)}
          />
        )}
        {tab === 'consultations' && (
          <ConsultationsTab consultations={consultations} patients={patients} storeId={store.id}
            onAdd={() => setAddConsultationOpen(true)} onChanged={() => fetchAll(true)}
          />
        )}
      </div>

      {addPatientOpen && (
        <PatientModal storeId={store.id}
          onClose={() => setAddPatientOpen(false)}
          onSaved={() => { setAddPatientOpen(false); fetchAll(true); }}
        />
      )}
      {editingPatient && (
        <PatientModal storeId={store.id} patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={() => { setEditingPatient(null); fetchAll(true); }}
          onDeleted={() => { setEditingPatient(null); fetchAll(true); }}
        />
      )}
      {addConsultationOpen && (
        <AddConsultationModal storeId={store.id} patients={patients}
          onClose={() => setAddConsultationOpen(false)}
          onCreated={() => { setAddConsultationOpen(false); fetchAll(true); }}
        />
      )}
      {settingsOpen && (
        <StoreSettingsModal
          accentColor={C.teal} accentDeep={C.tealDeep}
          store={store}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }}
        />
      )}
    </div>
  );
}

function HealthActivationScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('Paiement sur place ou virement.');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length >= 2 && ownerPhone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/commerce/stores', {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
        businessType: 'health',
      });
      toast.success('Cabinet activé', `${name.trim()} est en ligne.`);
      onCreated();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Activation impossible.');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{STYLES}</style>
      <div style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 24px 60px -16px rgba(10,42,32,0.18)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDeep})`, color: '#fff', padding: '36px 32px 28px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Stethoscope size={28} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Active ton <em style={{ fontStyle: 'italic', fontWeight: 500 }}>cabinet</em>
          </h1>
          <p style={{ fontSize: 13, opacity: 0.92, marginTop: 8 }}>
            Patients · Consultations · RDV — confidentiel
          </p>
        </div>
        <div style={{ padding: '26px 32px 30px' }}>
          <div style={{ background: C.tealSoft, border: `1px solid ${C.tealLight}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.tealDeep, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} />
            <span>Données patients <strong>séparées</strong> et confidentielles. Les notifs WhatsApp ne contiennent jamais de détails médicaux.</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Nom du cabinet</Label>
            <Input value={name} onChange={setName} placeholder="Ex: Cabinet Dr Konan, Clinique Banano…" autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Numéro WhatsApp réception</Label>
            <Input value={ownerPhone} onChange={setOwnerPhone} placeholder="+225 07 00 00 00 00" />
          </div>
          <div style={{ marginBottom: 22 }}>
            <Label>Instructions de paiement</Label>
            <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <a href="/agents/commerce" className="btn-ghost" style={{ textDecoration: 'none' }}>← Boutique</a>
            <button onClick={submit} disabled={!canSubmit} className="btn-teal">
              {submitting ? <><Loader2 size={14} className="spin" /> Activation…</> : <><Stethoscope size={14} /> Activer mon cabinet</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div style={{ background: 'rgba(255,250,240,0.14)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,250,240,0.20)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} style={{ opacity: 0.85 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div className="display-font" style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

// ══ TAB 1: Patients ═════════════════════════════════════════════════════════
function PatientsTab({ patients, onAdd, onEdit }: {
  patients: Patient[]; onAdd: () => void; onEdit: (p: Patient) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = patients.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        || p.phone.includes(q)
        || (p.email ?? '').toLowerCase().includes(q);
  });

  return (
    <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.tealDeep }}>patients</em>
          </h2>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
            {patients.length === 0 ? 'Ajoute ton premier patient.' : `${patients.length} patient${patients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={onAdd} className="btn-teal">
          <UserPlus size={14} /> Ajouter un patient
        </button>
      </header>

      {patients.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, email…"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
        </div>
      )}

      {patients.length === 0 ? (
        <div style={{ background: C.tealSoft, padding: 36, borderRadius: 16, textAlign: 'center', border: `2px dashed ${C.tealLight}` }}>
          <Users size={36} color={C.tealDeep} style={{ marginBottom: 12 }} />
          <div className="display-font" style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            Pas encore de patient
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16, lineHeight: 1.6 }}>
            Crée ton premier dossier patient (identité, allergies, antécédents).<br />
            Tes patients pourront ensuite prendre RDV via WhatsApp.
          </div>
          <button onClick={onAdd} className="btn-teal">
            <UserPlus size={14} /> Ajouter un patient
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: C.inkSoft, fontSize: 13 }}>
          Aucun patient ne correspond à "{search}".
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(p => {
            const age = calcAge(p.birthDate);
            const initials = `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();
            return (
              <article key={p.id} onClick={() => onEdit(p)} role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') onEdit(p); }}
                style={{
                  background: C.creamDeep, borderRadius: 14, padding: 14,
                  border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer',
                  transition: 'transform .2s ease, box-shadow .2s ease',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 24px -10px ${C.teal}40`; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.teal}, ${C.tealDeep})`,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, flexShrink: 0,
                  boxShadow: `0 6px 14px -4px ${C.teal}60`,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>
                    {p.firstName} {p.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                    {p.gender === 'M' ? '♂' : p.gender === 'F' ? '♀' : ''} {age !== null ? `${age} ans` : ''}{p.bloodType ? ` · ${p.bloodType}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={10} /> {p.phone}
                  </div>
                  {p.email && (
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Mail size={10} /> {p.email}
                    </div>
                  )}
                  {(p.allergies || p.chronicConditions) && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.allergies && (
                        <span className="pill" style={{ background: C.redSoft, color: C.red, fontSize: 10 }}>
                          ⚠ Allergies
                        </span>
                      )}
                      {p.chronicConditions && (
                        <span className="pill" style={{ background: C.yellowSoft, color: '#92400E', fontSize: 10 }}>
                          🏥 Antécédents
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ══ TAB 2: Consultations ════════════════════════════════════════════════════
function ConsultationsTab({ consultations, patients, storeId, onAdd, onChanged }: {
  consultations: Consultation[]; patients: Patient[]; storeId: string;
  onAdd: () => void; onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<'upcoming' | 'today' | 'all'>('upcoming');
  const filtered = consultations.filter(c => {
    if (filter === 'today') return c.date === today;
    if (filter === 'upcoming') return c.date >= today && c.status !== 'cancelled';
    return true;
  });

  const setStatus = async (id: string, status: Consultation['status']) => {
    try {
      await api.patch(`/commerce/stores/${storeId}/reservations/${id}`, { status });
      toast.success('Consultation mise à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };
  const remove = async (id: string) => {
    if (!confirm('Supprimer cette consultation ?')) return;
    try {
      await api.delete(`/commerce/stores/${storeId}/reservations/${id}`);
      toast.success('Consultation supprimée');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  return (
    <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.tealDeep }}>consultations</em>
          </h2>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
            {filtered.length} RDV
          </p>
        </div>
        <button onClick={onAdd} className="btn-teal">
          <Plus size={14} /> Nouvelle consultation
        </button>
      </header>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['upcoming', 'À venir'], ['today', "Aujourd'hui"], ['all', 'Toutes']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{
              padding: '6px 14px', borderRadius: 100,
              background: filter === id ? C.tealDeep : 'transparent',
              color: filter === id ? '#fff' : C.inkSoft,
              border: filter === id ? 'none' : `1.5px solid ${C.inkLight}50`,
              cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            }}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: C.creamDeep, padding: 32, borderRadius: 14, textAlign: 'center', border: `1.5px dashed ${C.teal}40` }}>
          <Calendar size={36} color={C.tealDeep} style={{ marginBottom: 10 }} />
          <div className="display-font" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Aucune consultation</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>
            Tes patients peuvent prendre RDV via WhatsApp ou tu peux ajouter manuellement.
          </div>
          <button onClick={onAdd} className="btn-teal">
            <Plus size={14} /> Ajouter une consultation
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const linkedPatient = c.patientId ? patients.find(p => p.id === c.patientId) : null;
            return (
              <div key={c.id} style={{
                background: C.creamDeep, borderRadius: 12, padding: 14,
                border: '1px solid rgba(10,42,32,0.05)',
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center',
              }}>
                <div style={{
                  width: 64, padding: 8, borderRadius: 10,
                  background: '#fff', textAlign: 'center', border: `1px solid ${C.teal}30`,
                }}>
                  <div style={{ fontSize: 10, color: C.tealDeep, fontWeight: 700, textTransform: 'uppercase' }}>
                    {new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </div>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                    {new Date(c.date).getDate()}
                  </div>
                  <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>
                    {new Date(c.date).toLocaleDateString('fr-FR', { month: 'short' })}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                    {linkedPatient ? `${linkedPatient.firstName} ${linkedPatient.lastName}` : c.customerName}
                    {' '}<span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>({c.customerPhone})</span>
                    {linkedPatient && (
                      <span className="pill" style={{ background: C.tealSoft, color: C.tealDeep, fontSize: 9, marginLeft: 6 }}>
                        Dossier lié
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} /> {c.time}
                    </span>
                    {c.durationMinutes && (
                      <span style={{ fontSize: 10, color: C.inkSoft }}>
                        ({c.durationMinutes} min)
                      </span>
                    )}
                    {c.practitionerName && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        👨‍⚕️ {c.practitionerName}
                      </span>
                    )}
                  </div>
                  {c.reason && (
                    <div style={{ fontSize: 12, color: C.tealDeep, marginTop: 4, fontWeight: 600 }}>
                      💬 Motif : {c.reason}
                    </div>
                  )}
                  {c.notes && <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: 'italic' }}>📝 {c.notes}</div>}
                  <div style={{ marginTop: 6 }}>
                    <ConsultStatusPill status={c.status} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {c.status === 'pending' && (
                    <button onClick={() => setStatus(c.id, 'confirmed')}
                      style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: C.emeraldSoft, color: C.emeraldDeep, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Confirmer
                    </button>
                  )}
                  {c.status === 'confirmed' && (
                    <button onClick={() => setStatus(c.id, 'seated')}
                      style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: C.blueSoft, color: C.blue, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      🏥 En consultation
                    </button>
                  )}
                  <button onClick={() => remove(c.id)} title="Supprimer"
                    style={{ padding: '6px 8px', borderRadius: 6, background: 'transparent', color: C.red, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ConsultStatusPill({ status }: { status: Consultation['status'] }) {
  const c: Record<string, [string, string, string]> = {
    pending:    [C.yellowSoft, '#92400E', '⏳ En attente'],
    confirmed:  [C.emeraldSoft, C.emeraldDeep, '✓ Confirmé'],
    seated:     [C.blueSoft, C.blue, '🏥 En consultation'],
    cancelled:  [C.redSoft, C.red, '✗ Annulé'],
    no_show:    ['#fce7f3', '#9D174D', '👻 No show'],
  };
  const [bg, fg, txt] = c[status] ?? c.pending;
  return <span className="pill" style={{ background: bg, color: fg }}>{txt}</span>;
}

// ══ MODALS ═══════════════════════════════════════════════════════════════════
const BLOOD_TYPES: Array<Patient['bloodType']> = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function PatientModal({ storeId, patient, onClose, onSaved, onDeleted }: {
  storeId: string; patient?: Patient;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const [firstName, setFirstName] = useState(patient?.firstName ?? '');
  const [lastName, setLastName] = useState(patient?.lastName ?? '');
  const [phone, setPhone] = useState(patient?.phone ?? '');
  const [email, setEmail] = useState(patient?.email ?? '');
  const [birthDate, setBirthDate] = useState(patient?.birthDate ?? '');
  const [gender, setGender] = useState<Patient['gender']>(patient?.gender ?? 'M');
  const [address, setAddress] = useState(patient?.address ?? '');
  const [bloodType, setBloodType] = useState<Patient['bloodType']>(patient?.bloodType);
  const [allergies, setAllergies] = useState(patient?.allergies ?? '');
  const [chronicConditions, setChronic] = useState(patient?.chronicConditions ?? '');
  const [emergencyContact, setEmergency] = useState(patient?.emergencyContact ?? '');
  const [medicalNotes, setMedicalNotes] = useState(patient?.medicalNotes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = !!patient;
  const canSubmit = firstName.trim().length >= 1 && lastName.trim().length >= 1 && phone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
      email: email.trim(), birthDate, gender, address: address.trim(),
      bloodType, allergies: allergies.trim(), chronicConditions: chronicConditions.trim(),
      emergencyContact: emergencyContact.trim(), medicalNotes: medicalNotes.trim(),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/patients/${patient!.id}`, payload);
        toast.success('Patient mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/patients`, payload);
        toast.success('Patient ajouté', `${firstName.trim()} ${lastName.trim()}`);
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/patients/${patient!.id}`);
      toast.success('Patient supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? `Patient: ${patient!.firstName} ${patient!.lastName}` : 'Nouveau patient'} color={C.tealDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Prénom *</Label><Input value={firstName} onChange={setFirstName} autoFocus={!isEdit} /></div>
        <div><Label>Nom *</Label><Input value={lastName} onChange={setLastName} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Téléphone *</Label><Input value={phone} onChange={setPhone} placeholder="+225 07..." /></div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={setEmail} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Date de naissance</Label><Input type="date" value={birthDate} onChange={setBirthDate} /></div>
        <div>
          <Label>Sexe</Label>
          <select value={gender} onChange={e => setGender(e.target.value as Patient['gender'])}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            <option value="M">Homme</option>
            <option value="F">Femme</option>
            <option value="other">Autre</option>
          </select>
        </div>
        <div>
          <Label>Groupe sanguin</Label>
          <select value={bloodType ?? ''} onChange={e => setBloodType((e.target.value || undefined) as Patient['bloodType'])}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            <option value="">—</option>
            {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}><Label>Adresse</Label><Input value={address} onChange={setAddress} /></div>
      <div style={{ marginBottom: 12 }}>
        <Label>⚠ Allergies</Label>
        <textarea value={allergies} onChange={e => setAllergies(e.target.value)} rows={2}
          placeholder="Ex: pénicilline, fruits à coque…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>🏥 Antécédents / Pathologies chroniques</Label>
        <textarea value={chronicConditions} onChange={e => setChronic(e.target.value)} rows={2}
          placeholder="Ex: hypertension, diabète type 2, asthme…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 12 }}><Label>📞 Contact d'urgence</Label><Input value={emergencyContact} onChange={setEmergency} placeholder="Mme Konan +225 ..." /></div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes médicales (privées, praticien uniquement)</Label>
        <textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>

      {isEdit && confirmDelete && (
        <div style={{ padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
            Supprimer définitivement le dossier de {patient!.firstName} {patient!.lastName} ?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost" style={{ borderColor: '#FCA5A5', color: '#7F1D1D' }}>Annuler</button>
            <button onClick={remove} disabled={submitting}
              style={{ padding: '8px 14px', borderRadius: 8, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
              {submitting ? <><Loader2 size={12} className="spin" /> …</> : <><Trash2 size={12} /> Confirmer</>}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={() => setConfirmDelete(true)} disabled={confirmDelete || submitting}
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', opacity: confirmDelete ? 0.4 : 1 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={submitting} className="btn-ghost">Annuler</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-teal">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><UserPlus size={14} /> Ajouter</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function AddConsultationModal({ storeId, patients, onClose, onCreated }: {
  storeId: string; patients: Patient[]; onClose: () => void; onCreated: () => void;
}) {
  const [patientId, setPatientId] = useState<string>(patients[0]?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [practitionerName, setPractitioner] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill from patient
  useEffect(() => {
    if (patientId) {
      const p = patients.find(x => x.id === patientId);
      if (p) {
        setCustomerName(`${p.firstName} ${p.lastName}`);
        setCustomerPhone(p.phone);
      }
    }
  }, [patientId, patients]);

  const canSubmit = customerName.trim().length >= 2 && customerPhone.length >= 6
    && date && time && reason.trim().length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/commerce/stores/${storeId}/reservations`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        date, time, partySize: 1,
        reason: reason.trim(),
        durationMinutes: duration,
        ...(practitionerName.trim() ? { practitionerName: practitionerName.trim() } : {}),
        ...(patientId ? { patientId } : {}),
        notes: notes.trim(),
      });
      toast.success('Consultation créée', `${customerName.trim()} · ${date} ${time}`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Nouvelle consultation" color={C.tealDeep} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <Label>Patient (du dossier)</Label>
        <select value={patientId} onChange={e => setPatientId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">— Patient externe (sans dossier) —</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.phone})</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Nom *</Label><Input value={customerName} onChange={setCustomerName} /></div>
        <div><Label>Téléphone *</Label><Input value={customerPhone} onChange={setCustomerPhone} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Motif de consultation *</Label>
        <Input value={reason} onChange={setReason} placeholder="Ex: contrôle annuel, mal de tête, vaccination…" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
        <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
        <div><Label>Durée (min)</Label><Input type="number" value={String(duration)} onChange={v => setDuration(parseInt(v) || 30)} mono /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Praticien (optionnel)</Label>
        <Input value={practitionerName} onChange={setPractitioner} placeholder="Dr Konan, Dr Diallo…" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={submitting} className="btn-ghost">Annuler</button>
        <button onClick={submit} disabled={!canSubmit} className="btn-teal">
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Plus size={14} /> Créer</>}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, color, onClose, children }: { title: string; color: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, padding: 16,
      background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 620, width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
      }}>
        <div style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: '#fff', padding: '20px 24px', borderRadius: '22px 22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{title}</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '22px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{children}</label>;
}

function Input({ value, onChange, placeholder, type = 'text', autoFocus, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; autoFocus?: boolean; mono?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} autoFocus={autoFocus}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: 10,
        border: `1.5px solid ${C.creamDeep}`, fontSize: 13,
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        outline: 'none', background: '#fff', color: C.ink,
      }} />
  );
}
