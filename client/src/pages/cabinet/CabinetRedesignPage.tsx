/**
 * Cabinet Pack — Multi-profil professionnel.
 * Pitch: "Ton cabinet — patients, RDV, documents, équipe — depuis WhatsApp."
 *
 * 6 profils (couleur + terminologie adaptée) :
 *   - Médecin · Patients · Consultations · Ordonnances
 *   - Dentiste · Patients · Soins · Devis
 *   - Avocat · Clients · Audiences · Dossiers
 *   - Notaire · Clients · Actes · Actes
 *   - Comptable · Clients · Missions · Liasses
 *   - Vétérinaire · Animaux · Consultations · Vaccins
 *
 * 6 onglets admin, zéro mock :
 *   - Dashboard    · KPIs + agenda live + alertes + équipe live
 *   - Patients     · CRUD (label adapté au profil)
 *   - RDV          · agenda
 *   - Documents    · ordonnances / dossiers / actes / liasses (selon profil)
 *   - Équipe       · praticiens / associés
 *   - WhatsApp     · inbox
 *
 * Réutilise : /commerce/stores/:id/patients, reservations, products (category='document'),
 *             store.practitioners, store.cabinetProfile, /whatsapp/messages.
 *
 * Palette : couleur primaire dynamique selon profile.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  HeartPulse, Stethoscope, Scale, Stamp, Calculator, PawPrint,
  Plus, Loader2, X, Save, Trash2, Edit3, Camera,
  Sparkles, MessageCircle, Settings, RefreshCw, Send,
  LayoutDashboard, Users, Clock, AlertTriangle,
  CheckCircle2, BadgeCheck, Search, Phone, FileText,
  Calendar, ChevronLeft, ChevronRight, Briefcase,
  Smile, AlertCircle, Mail,
} from 'lucide-react';
import { StoreSettingsModal } from '@/components/store/StoreSettingsModal';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';
import { InboxTab } from '@/components/inbox/InboxTab';
import { StoreHeroBranding, WhatsAppQuickButton, resolveAccent } from '@/components/store/StoreHeroBranding';

type CabinetProfileId = 'medecin' | 'dentiste' | 'avocat' | 'notaire' | 'comptable' | 'veto';

interface CabinetProfile {
  id: CabinetProfileId;
  label: string;
  icon: any;
  color: string;
  colorDeep: string;
  colorSoft: string;
  emoji: string;
  tagline: string;
  clientLabel: string;       // patients / clients / animaux
  clientLabelSingular: string;
  visitLabel: string;        // consultations / audiences / missions
  docLabel: string;          // ordonnances / dossiers / actes
}

const PROFILES: CabinetProfile[] = [
  { id: 'medecin',   label: 'Médecin généraliste', icon: HeartPulse, color: '#10B981', colorDeep: '#065F46', colorSoft: '#D1FAE5', emoji: '🩺', tagline: 'Soin & confidentialité',  clientLabel: 'patients',  clientLabelSingular: 'patient',  visitLabel: 'consultations', docLabel: 'ordonnances' },
  { id: 'dentiste',  label: 'Cabinet dentaire',    icon: Smile,      color: '#06B6D4', colorDeep: '#0E7490', colorSoft: '#CFFAFE', emoji: '🦷', tagline: 'Sourire & précision',     clientLabel: 'patients',  clientLabelSingular: 'patient',  visitLabel: 'soins',         docLabel: 'devis' },
  { id: 'avocat',    label: 'Cabinet d\'avocats',  icon: Scale,      color: '#9F1239', colorDeep: '#881337', colorSoft: '#FFE4E6', emoji: '⚖️', tagline: 'Justice & rigueur',       clientLabel: 'clients',   clientLabelSingular: 'client',   visitLabel: 'audiences',     docLabel: 'dossiers' },
  { id: 'notaire',   label: 'Étude notariale',     icon: Stamp,      color: '#D97706', colorDeep: '#92400E', colorSoft: '#FEF3C7', emoji: '📜', tagline: 'Authentique & solennel',  clientLabel: 'clients',   clientLabelSingular: 'client',   visitLabel: 'actes',         docLabel: 'actes' },
  { id: 'comptable', label: 'Expert-comptable',    icon: Calculator, color: '#1E40AF', colorDeep: '#1E3A8A', colorSoft: '#DBEAFE', emoji: '💼', tagline: 'Chiffre & conformité',    clientLabel: 'clients',   clientLabelSingular: 'client',   visitLabel: 'missions',      docLabel: 'liasses' },
  { id: 'veto',      label: 'Cabinet vétérinaire', icon: PawPrint,   color: '#16A34A', colorDeep: '#15803D', colorSoft: '#DCFCE7', emoji: '🐾', tagline: 'Compagnons & soin',       clientLabel: 'animaux',   clientLabelSingular: 'animal',   visitLabel: 'consultations', docLabel: 'vaccins' },
];

const C = {
  greenDeep:'#0A4F3C', greenDark:'#063D2E',
  cream:'#FFFAF0', creamDeep:'#F5F0E8', creamWarm:'#FAF6EE',
  gold:'#D97706', goldDeep:'#B45309', goldSoft:'#FEF3C7',
  emerald:'#10B981', emeraldDeep:'#059669', emeraldDark:'#065F46', emeraldSoft:'#D1FAE5',
  coral:'#FB7185', coralDeep:'#E11D48', coralSoft:'#FFE4E6',
  whatsapp:'#25D366', whatsappDark:'#128C7E', whatsappSoft:'#DCF8C6',
  violet:'#7C3AED', violetDeep:'#5B21B6', violetSoft:'#EDE9FE',
  red:'#EF4444', redSoft:'#FEE2E2', yellow:'#F59E0B', yellowSoft:'#FEF3C7',
  blue:'#0EA5E9', blueSoft:'#E0F2FE', blueDeep:'#0284C7',
  cyan:'#06B6D4', cyanSoft:'#CFFAFE', cyanDeep:'#0891B2',
  ink:'#1F2937', inkSoft:'#4B5563', inkLight:'#9CA3AF',
};

const makeStyles = (profile: CabinetProfile) => `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  @keyframes pulse { 0%,100% { transform:scale(1); opacity:.5 } 50% { transform:scale(1.6); opacity:0 } }
  @keyframes slowRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes slideIn { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
  @keyframes shimmer { 0% { background-position:-200% center } 100% { background-position:200% center } }
  @keyframes sparkleFloat { 0%,100% { transform:translateY(0) rotate(0); opacity:.5 } 50% { transform:translateY(-8px) rotate(180deg); opacity:1 } }
  .slow-rotate { animation: slowRotate 30s linear infinite; }
  .sparkle-float { animation: sparkleFloat 4s ease-in-out infinite; }
  .stagger > * { animation: slideIn .4s ease-out backwards; }
  .stagger > *:nth-child(1){animation-delay:.05s}
  .stagger > *:nth-child(2){animation-delay:.10s}
  .stagger > *:nth-child(3){animation-delay:.15s}
  .stagger > *:nth-child(4){animation-delay:.20s}
  .stagger > *:nth-child(5){animation-delay:.25s}
  .stagger > *:nth-child(6){animation-delay:.30s}
  .card-lift { transition: all .3s cubic-bezier(.4,0,.2,1); }
  .card-lift:hover { transform: translateY(-3px); }
  .shimmer-text {
    background: linear-gradient(90deg, ${C.gold}, ${profile.color}, ${profile.colorDeep}, ${profile.color}, ${C.gold});
    background-size: 200% auto; background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite;
  }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: .02em; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content:''; position:absolute; inset:-4px; border-radius:50%; background: currentColor; opacity:.4; animation: pulse 1.8s ease-in-out infinite; }
  .btn-primary { background: linear-gradient(135deg, ${profile.color}, ${profile.colorDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; box-shadow: 0 8px 24px -8px ${profile.color}; }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .btn-gold { background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .btn-secondary { background: ${C.cream}; color: ${profile.colorDeep}; border: 1.5px solid rgba(31,41,55,.1); padding: 10px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s ease; font-family: inherit; }
  .btn-secondary:hover:not(:disabled) { background: ${profile.colorDeep}; color: ${C.cream}; }
  .btn-ghost { background: transparent; color: ${C.ink}; border: 1.5px solid ${C.inkLight}; padding: 9px 16px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; font-family: inherit; }
  .btn-ghost-light { background: rgba(255,250,240,.08); color: ${C.cream}; border: 1px solid rgba(255,250,240,.15); padding: 9px 14px; border-radius: 10px; font-weight: 600; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
  .btn-ghost-light:hover { background: ${C.cream}; color: ${profile.colorDeep}; }
  .btn-whatsapp { background: linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark}); color: ${C.cream}; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .2s ease; font-family: inherit; }
  .icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${profile.colorSoft}; color: ${profile.colorDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all .2s ease; flex-shrink: 0; }
  .icon-btn:hover { background: ${profile.colorDeep}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.emerald { background: ${C.emeraldSoft}; color: ${C.emeraldDark}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${profile.colorDeep}; }
  .grain::before { content:''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: .06; pointer-events: none; mix-blend-mode: overlay; }
  .scroll-thin::-webkit-scrollbar { width: 6px; height: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(31,41,55,.15); border-radius: 100px; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; } .map-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .hide-on-mobile { display: none !important; } .hero-title { font-size: 30px !important; } }
  @media (max-width: 480px) { .hero-pad { padding: 16px 18px !important; } .hero-title { font-size: 26px !important; } .pack-modal { max-width: 100% !important; margin: 6px !important; } .pack-modal-body { padding: 14px 16px !important; } .voice-fab, .pack-fab { bottom: max(20px, env(safe-area-inset-bottom)) !important; right: max(16px, env(safe-area-inset-right)) !important; } }
`;

interface Store {
  id: string; name: string; ownerPhone: string; currency: string;
  paymentInstructions?: string;
  cabinetProfile?: CabinetProfileId;
  practitioners?: Practitioner[];
}
interface Practitioner {
  id: string; name: string; role?: string;
  photoUrl?: string; workingHours?: string; active?: boolean;
  specialties?: string[]; color?: string;
}
interface Patient {
  id: string;
  firstName: string; lastName: string;
  phone: string; email?: string;
  birthDate?: string; gender?: 'M' | 'F' | 'other';
  address?: string;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  createdAt?: { _seconds?: number } | string;
}
interface Appointment {
  id: string; customerName: string; customerPhone: string;
  date: string; time: string; durationMinutes?: number;
  patientId?: string; practitionerName?: string;
  reason?: string; notes?: string;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show';
  createdAt?: { _seconds?: number } | string;
}
interface Document {
  id: string; name: string; description?: string;
  price?: number; currency?: string;
  imageUrl?: string;
  status: 'draft' | 'active' | 'out_of_stock' | 'archived';
  category?: string; // documents
}
interface WaMessage {
  id: string; from?: string; to?: string;
  direction?: 'inbound' | 'outbound';
  body?: string; text?: string; message?: string;
  contactName?: string; customerName?: string;
  createdAt?: { _seconds?: number } | string;
}

type TabId = 'dashboard' | 'patients' | 'agenda' | 'documents' | 'team' | 'whatsapp';

function getTimestamp(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v === 'object' && v !== null && '_seconds' in (v as Record<string, unknown>)) {
    const s = (v as { _seconds?: number })._seconds; return typeof s === 'number' ? s*1000 : 0;
  }
  return 0;
}
function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now()-ms; const min = Math.floor(diff/60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min/60); if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h/24); if (d < 7) return `il y a ${d}j`;
  return new Date(ms).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
const NO_DECIMAL = new Set(['XOF','XAF','JPY','GNF','KES','NGN','RWF','BIF','UGX']);
function formatShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(2)} Mds`;
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `${(n/1_000).toFixed(0)} k`;
  return n.toString();
}
function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min/60); const m = min%60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}
function patientFullName(p: Patient): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
function patientAge(p: Patient): number | null {
  if (!p.birthDate) return null;
  const b = new Date(p.birthDate); if (isNaN(b.getTime())) return null;
  return Math.floor((Date.now() - b.getTime()) / (365.25 * 86_400_000));
}

export default function CabinetRedesignPage() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [store, setStore] = useState<Store | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false);
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [addPractitionerOpen, setAddPractitionerOpen] = useState(false);
  const [editingPractitioner, setEditingPractitioner] = useState<Practitioner | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const profile = useMemo<CabinetProfile>(() => {
    return PROFILES.find(p => p.id === store?.cabinetProfile) ?? PROFILES[0];
  }, [store?.cabinetProfile]);

  const STYLES = useMemo(() => makeStyles(profile), [profile]);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r1: any = await api.get('/commerce/stores', { params: { businessType: 'cabinet' } })
        .catch(() => ({ data: { stores: [] } }));
      const stores = (r1?.data?.stores ?? []) as Store[];
      const s = stores[0];
      if (!s) { setStore(null); setPatients([]); setAppointments([]); setDocuments([]); setWaMessages([]); return; }
      setStore(s);
      const [r2, r3, r4, r5, r6] = await Promise.all([
        api.get(`/commerce/stores/${s.id}/patients`).catch(() => ({ data: { patients: [] } })),
        api.get(`/commerce/stores/${s.id}/reservations`).catch(() => ({ data: { reservations: [] } })),
        api.get(`/commerce/stores/${s.id}/products`).catch(() => ({ data: { products: [] } })),
        api.get('/whatsapp/messages').catch(() => ({ data: { data: [] } })),
        api.get('/whatsapp/status').catch(() => ({ data: { data: { connected: false } } })),
      ]);
      setPatients((r2 as any)?.data?.patients ?? []);
      setAppointments((r3 as any)?.data?.reservations ?? []);
      const allProducts = ((r4 as any)?.data?.products ?? []) as Document[];
      setDocuments(allProducts.filter(p => p.category === 'document'));
      const waData = (r5 as any)?.data?.data ?? (r5 as any)?.data?.messages ?? [];
      setWaMessages(Array.isArray(waData) ? waData : []);
      const waStatus = (r6 as any)?.data?.data ?? (r6 as any)?.data ?? {};
      setWaConnected(!!waStatus.connected);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter(a => a.date === today && a.status !== 'cancelled');
  const upcomingAppointments = appointments.filter(a => a.date >= today && a.status !== 'cancelled');
  const waThreads = useMemo(() => deriveWaThreads(waMessages), [waMessages]);
  const practitioners = store?.practitioners ?? [];

  if (loading && !store) {
    return (
      <div style={{ minHeight: '100vh', background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={profile.color} />
      </div>
    );
  }
  if (!store) return <CabinetActivationScreen onCreated={() => fetchAll()} />;

  const counts: Record<TabId, number | null> = {
    dashboard: null,
    patients: patients.length,
    agenda: upcomingAppointments.length,
    documents: documents.length,
    team: practitioners.length,
    whatsapp: waThreads.filter(t => t.unread).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <HeroAdmin store={store} profile={profile}
          onAddPatient={() => setAddPatientOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)} />
        <TabStrip activeTab={tab} setActiveTab={setTab} counts={counts} profile={profile} />

        {tab === 'dashboard' && (
          <DashboardTab profile={profile}
            patients={patients} appointments={appointments}
            todayAppointments={todayAppointments}
            practitioners={practitioners}
            threads={waThreads}
            onAddPatient={() => setAddPatientOpen(true)}
            onAddAppointment={() => setAddAppointmentOpen(true)} />
        )}
        {tab === 'patients' && (
          <PatientsTab profile={profile} patients={patients} appointments={appointments}
            onSelect={p => setEditingPatient(p)} onAdd={() => setAddPatientOpen(true)} />
        )}
        {tab === 'agenda' && (
          <AgendaTab profile={profile} appointments={appointments} patients={patients}
            practitioners={practitioners}
            storeId={store.id}
            onAdd={() => setAddAppointmentOpen(true)} onChanged={() => fetchAll(true)} />
        )}
        {tab === 'documents' && (
          <DocumentsTab profile={profile} documents={documents}
            onSelect={d => setEditingDocument(d)} onAdd={() => setAddDocumentOpen(true)} />
        )}
        {tab === 'team' && (
          <TeamTab profile={profile} practitioners={practitioners} appointments={appointments}
            onAdd={() => setAddPractitionerOpen(true)}
            onEdit={p => setEditingPractitioner(p)} />
        )}
        {tab === 'whatsapp' && (
          <InboxTab
            accent={profile.color}
            accentDeep={profile.colorDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint={`Dès qu'un ${profile.clientLabelSingular} t'écrit sur WhatsApp ou Telegram, sa conversation apparaît ici.`}
          />
        )}
      </div>

      {addPatientOpen && (
        <PatientModal storeId={store.id} profile={profile}
          onClose={() => setAddPatientOpen(false)}
          onSaved={() => { setAddPatientOpen(false); fetchAll(true); }} />
      )}
      {editingPatient && (
        <PatientModal storeId={store.id} profile={profile} patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={() => { setEditingPatient(null); fetchAll(true); }}
          onDeleted={() => { setEditingPatient(null); fetchAll(true); }} />
      )}
      {addAppointmentOpen && (
        <AppointmentModal storeId={store.id} profile={profile} patients={patients} practitioners={practitioners}
          onClose={() => setAddAppointmentOpen(false)}
          onCreated={() => { setAddAppointmentOpen(false); fetchAll(true); }} />
      )}
      {addDocumentOpen && (
        <DocumentModal storeId={store.id} profile={profile}
          onClose={() => setAddDocumentOpen(false)}
          onSaved={() => { setAddDocumentOpen(false); fetchAll(true); }} />
      )}
      {editingDocument && (
        <DocumentModal storeId={store.id} profile={profile} document={editingDocument}
          onClose={() => setEditingDocument(null)}
          onSaved={() => { setEditingDocument(null); fetchAll(true); }}
          onDeleted={() => { setEditingDocument(null); fetchAll(true); }} />
      )}
      {addPractitionerOpen && (
        <PractitionerModal storeId={store.id} practitioners={practitioners} profile={profile}
          onClose={() => setAddPractitionerOpen(false)}
          onSaved={() => { setAddPractitionerOpen(false); fetchAll(true); }} />
      )}
      {editingPractitioner && (
        <PractitionerModal storeId={store.id} practitioners={practitioners} profile={profile} practitioner={editingPractitioner}
          onClose={() => setEditingPractitioner(null)}
          onSaved={() => { setEditingPractitioner(null); fetchAll(true); }}
          onDeleted={() => { setEditingPractitioner(null); fetchAll(true); }} />
      )}
      {settingsOpen && (
        <CabinetSettingsModal store={store} profile={profile}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); fetchAll(true); }} />
      )}

      <VoiceAssistantFAB
        accentColor={profile.color} accentDeep={profile.colorDeep}
        label={`Assistant ${profile.label}`}
        systemInstruction={`Tu es l'assistant vocal du cabinet "${store.name}" (${profile.label}).

CONTEXTE :
- ${patients.length} ${profile.clientLabel} au fichier
- ${todayAppointments.length} ${profile.visitLabel} aujourd'hui
- ${upcomingAppointments.length} ${profile.visitLabel} à venir
- ${practitioners.length} ${practitioners.length > 1 ? 'praticiens / associés' : 'praticien'}

TON RÔLE :
- Renseigner sur disponibilités RDV
- Récupérer info ${profile.clientLabelSingular} si fourni
- Aider à planifier ${profile.visitLabel}
- Renseigner sur tarifs ${profile.docLabel} (sans donner de conseil médical/juridique précis)

RÈGLES STRICTES :
- N'auto-confirme JAMAIS un RDV. Validation orale obligatoire.
- Ne donne JAMAIS de conseil médical, juridique ou comptable. Réfère au praticien.
- Respecte la confidentialité absolue : ne dévoile pas le détail d'un dossier au téléphone sans validation d'identité.
- Reste bref et professionnel.`}
      />
    </div>
  );
}

interface WaThread { phone: string; name: string; lastMessage: string; lastAt: number; unread: boolean; messages: WaMessage[]; }
function deriveWaThreads(messages: WaMessage[]): WaThread[] {
  const byContact = new Map<string, WaMessage[]>();
  for (const m of messages) {
    const contact = m.direction === 'inbound' ? (m.from ?? '') : (m.to ?? '');
    if (!contact) continue;
    const arr = byContact.get(contact) ?? [];
    arr.push(m); byContact.set(contact, arr);
  }
  const threads: WaThread[] = [];
  for (const [phone, list] of byContact) {
    list.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    const last = list[0];
    threads.push({
      phone, name: last.contactName ?? last.customerName ?? phone,
      lastMessage: last.body ?? last.text ?? last.message ?? '',
      lastAt: getTimestamp(last.createdAt), unread: last.direction === 'inbound',
      messages: list,
    });
  }
  threads.sort((a, b) => b.lastAt - a.lastAt);
  return threads;
}

function HeroAdmin({ store, profile, onAddPatient, onOpenSettings }: { store: Store; profile: CabinetProfile; onAddPatient: () => void; onOpenSettings: () => void }) {
  const Icon = profile.icon;
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${profile.colorDeep} 0%, ${profile.color} 60%, ${C.gold} 130%)`,
      borderRadius: 22, padding: '24px 28px', overflow: 'hidden',
      border: `1px solid ${C.gold}40`, boxShadow: `0 20px 50px -20px ${profile.color}`,
    }}>
      <div className="grain"></div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .4, pointerEvents: 'none' }}>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i} cx={`${(i*41)%100}%`} cy={`${(i*73)%100}%`}
            r={((i*7)%12)/8 + 0.4}
            fill={i%2 === 0 ? C.gold : profile.colorSoft}
            opacity={0.3 + ((i*11)%60)/100} />
        ))}
      </svg>
      <div className="slow-rotate" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', border: `1px dashed ${C.gold}30`, pointerEvents: 'none' }}></div>
      <div className="sparkle-float" style={{ position: 'absolute', top: 40, right: 100, opacity: .6 }}>
        <Sparkles size={18} color={C.gold} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative', zIndex: 2 }}>
        <span className="pill" style={{
          background: 'rgba(255,250,240,.15)', color: C.cream,
          border: '1px solid rgba(255,250,240,.2)',
          backdropFilter: 'blur(20px)',
          fontWeight: 700, fontSize: 10, letterSpacing: '.08em',
        }}>
          <Icon size={11} /> {profile.label.toUpperCase()} · <span style={{ color: C.whatsappSoft }}>WHATSAPP</span>
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 className="display-font hero-title" style={{
            fontSize: 44, fontWeight: 800, color: C.cream, margin: 0,
            letterSpacing: '-.03em', lineHeight: 1,
          }}>
            {store.name.split(' ')[0]}{' '}
            <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>
              {store.name.split(' ').slice(1).join(' ') || profile.emoji}
            </em>
          </h1>
          {(store.tagline || store.shortDescription || store.logoUrl) ? (
            <StoreHeroBranding store={store as any} accent={C.whatsappSoft} dark />
          ) : (
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,.85)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {profile.tagline} · pilote depuis <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={onAddPatient} className="btn-gold"><Plus size={14} /> Ajouter {profile.clientLabelSingular === 'animal' ? 'un animal' : `un ${profile.clientLabelSingular}`}</button>
          <button onClick={onOpenSettings} className="btn-ghost-light"><Settings size={13} /> Paramètres</button>
        </div>
      </div>
    </div>
  );
}

function TabStrip({ activeTab, setActiveTab, counts, profile }: { activeTab: TabId; setActiveTab: (t: TabId) => void; counts: Record<TabId, number | null>; profile: CabinetProfile }) {
  const tabs: Array<{ id: TabId; label: string; icon: any; highlight?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients',  label: profile.clientLabel[0].toUpperCase() + profile.clientLabel.slice(1), icon: Users },
    { id: 'agenda',    label: 'Agenda',    icon: Calendar },
    { id: 'documents', label: profile.docLabel[0].toUpperCase() + profile.docLabel.slice(1), icon: FileText },
    { id: 'team',      label: 'Équipe',    icon: Briefcase },
    { id: 'whatsapp',  label: 'Inbox',     icon: MessageCircle, highlight: true },
  ];
  return (
    <div className="scroll-thin" style={{
      background: C.cream, borderRadius: 14, padding: 6,
      border: '1px solid rgba(31,41,55,.06)',
      display: 'flex', gap: 4, overflowX: 'auto',
    }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        const count = counts[t.id];
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: active ? `linear-gradient(135deg, ${profile.color}, ${profile.colorDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            boxShadow: active ? `0 6px 14px -4px ${profile.color}` : 'none',
            flexShrink: 0, transition: 'all .2s ease',
          }}>
            <Icon size={13} strokeWidth={2.5} />
            {t.label}
            {count !== null && count > 0 && (
              <span className="mono-font" style={{
                background: active ? 'rgba(255,250,240,.25)' : (t.highlight ? C.whatsapp : C.creamDeep),
                color: active ? C.cream : (t.highlight ? C.cream : C.inkSoft),
                padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800,
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DashboardTab(props: {
  profile: CabinetProfile;
  patients: Patient[]; appointments: Appointment[]; todayAppointments: Appointment[];
  practitioners: Practitioner[];
  threads: WaThread[];
  onAddPatient: () => void; onAddAppointment: () => void;
}) {
  const { profile, patients, appointments, todayAppointments, practitioners, threads, onAddAppointment } = props;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter(a => a.date >= today && a.status !== 'cancelled');
  const newPatientsToday = patients.filter(p => getTimestamp(p.createdAt) >= new Date(today).getTime()).length;

  const kpis: Array<{ id: string; label: string; value: string; sub: string; icon: any; color: string; bg: string }> = [
    { id: 'today', label: `${profile.visitLabel[0].toUpperCase() + profile.visitLabel.slice(1)} jour`, value: String(todayAppointments.length),
      sub: `${todayAppointments.filter(a => a.status === 'confirmed').length} confirmés`, icon: Calendar, color: profile.color, bg: profile.colorSoft },
    { id: 'patients', label: `${profile.clientLabel[0].toUpperCase() + profile.clientLabel.slice(1)}`, value: String(patients.length),
      sub: newPatientsToday > 0 ? `+${newPatientsToday} aujourd'hui` : 'au fichier', icon: Users, color: C.gold, bg: C.goldSoft },
    { id: 'team', label: 'Équipe active', value: String(practitioners.filter(p => p.active !== false).length),
      sub: `${practitioners.length} au total`, icon: Briefcase, color: C.violet, bg: C.violetSoft },
    { id: 'upcoming', label: 'À venir', value: String(upcoming.length),
      sub: 'cette semaine + plus', icon: Clock, color: C.emerald, bg: C.emeraldSoft },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.id} className="card-lift" style={{
              background: C.cream, borderRadius: 16, padding: 16,
              border: '1px solid rgba(31,41,55,.06)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-.02em' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: C.inkSoft }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="map-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
        <AgendaLivePanel profile={profile} todayAppointments={todayAppointments}
          practitioners={practitioners} onAdd={onAddAppointment} />
        <TeamLivePanel profile={profile} practitioners={practitioners} appointments={todayAppointments} />
      </div>

      <WhatsAppLeadsPanel threads={threads} profile={profile} />
    </div>
  );
}

function AgendaLivePanel({ profile, todayAppointments, practitioners, onAdd }: {
  profile: CabinetProfile;
  todayAppointments: Appointment[]; practitioners: Practitioner[]; onAdd: () => void;
}) {
  const sorted = [...todayAppointments].sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div style={{
      background: `linear-gradient(135deg, ${profile.colorDeep}, ${profile.color})`,
      borderRadius: 18, border: `1px solid ${C.gold}30`,
      overflow: 'hidden', position: 'relative',
      minHeight: 380, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 18px', background: 'rgba(0,0,0,.25)', borderBottom: `1px solid ${C.gold}20`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Calendar size={14} color={C.gold} />
        <span className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '.12em', flex: 1 }}>
          AGENDA AUJOURD'HUI · {sorted.length} {profile.visitLabel.toUpperCase()}
        </span>
        <span className="pill" style={{ background: `${C.emerald}25`, color: C.emerald, border: `1px solid ${C.emerald}50`, fontSize: 9, fontWeight: 800 }}>
          <span className="live-dot" style={{ width: 6, height: 6, color: C.emerald }}></span>
          LIVE
        </span>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,250,240,.7)' }}>
            <Calendar size={36} color={C.gold} style={{ marginBottom: 10, opacity: .7 }} />
            <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 4 }}>Aucun RDV aujourd'hui</div>
            <button onClick={onAdd} className="btn-ghost-light" style={{ padding: '7px 12px', marginTop: 8 }}>
              <Plus size={11} /> Nouveau RDV
            </button>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map(a => {
              const prac = practitioners.find(p => p.name === a.practitionerName);
              return (
                <div key={a.id} style={{
                  background: 'rgba(255,250,240,.08)',
                  borderLeft: `3px solid ${a.status === 'confirmed' ? C.emerald : a.status === 'seated' ? C.gold : C.coral}`,
                  borderRadius: 10, padding: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 48, textAlign: 'center' }}>
                    <div className="mono-font" style={{ fontSize: 15, fontWeight: 800, color: C.cream }}>{a.time}</div>
                    {a.durationMinutes && <div style={{ fontSize: 8, color: 'rgba(255,250,240,.55)', fontWeight: 700 }}>{formatDuration(a.durationMinutes)}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.cream }}>
                      {a.customerName}
                      {a.status === 'seated' && <span className="pill" style={{ background: `${C.gold}25`, color: C.gold, fontSize: 9, fontWeight: 800, marginLeft: 6 }}>En cours</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,250,240,.65)' }}>
                      {a.reason ?? '—'} {prac && <span style={{ color: prac.color ?? C.gold }}>· {prac.name}</span>}
                    </div>
                  </div>
                  <a href={`https://wa.me/${a.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    style={{ textDecoration: 'none' }}>
                    <button className="icon-btn" style={{ background: 'rgba(255,250,240,.15)', color: C.cream, width: 28, height: 28 }}>
                      <MessageCircle size={12} />
                    </button>
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamLivePanel({ profile, practitioners, appointments }: {
  profile: CabinetProfile; practitioners: Practitioner[]; appointments: Appointment[];
}) {
  return (
    <div style={{
      background: C.cream, borderRadius: 18, overflow: 'hidden',
      border: '1px solid rgba(31,41,55,.06)',
      minHeight: 380, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Briefcase size={16} />
        <div style={{ flex: 1 }}>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', opacity: .9 }}>
            ÉQUIPE · LIVE
          </div>
          <div className="display-font" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em' }}>
            {practitioners.length} {practitioners.length > 1 ? 'membres' : 'membre'}
          </div>
        </div>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {practitioners.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.inkSoft }}>
            <Briefcase size={36} color={C.inkLight} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Pas encore d'équipe</div>
            <div style={{ fontSize: 11 }}>Ajoute des praticiens dans l'onglet Équipe.</div>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {practitioners.map(p => {
              const todayBookings = appointments.filter(a => a.practitionerName === p.name && a.status !== 'cancelled');
              return (
                <div key={p.id} style={{
                  background: C.creamDeep, borderRadius: 11, padding: 10,
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: '1px solid rgba(31,41,55,.06)',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${p.color ?? profile.color}, ${p.color ?? profile.colorDeep})`,
                    color: C.cream, fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Fraunces, serif', flexShrink: 0,
                  }}>
                    {initials(p.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft }}>{p.role ?? 'Praticien'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.violetDeep }}>{todayBookings.length}</div>
                    <div style={{ fontSize: 9, color: C.inkLight }}>RDV jour</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WhatsAppLeadsPanel({ threads, profile }: { threads: WaThread[]; profile: CabinetProfile }) {
  const recent = threads.slice(0, 5);
  if (recent.length === 0) return null;
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: `1.5px solid ${C.whatsapp}30` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="pill" style={{ background: `${C.whatsapp}15`, color: C.whatsappDark, fontSize: 10, marginBottom: 4 }}>
            <MessageCircle size={11} /> LEADS WHATSAPP · {threads.length} CONVERSATIONS
          </div>
          <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
            Conversations <em style={{ fontStyle: 'italic', fontWeight: 500, color: profile.colorDeep }}>récentes</em>
          </h3>
        </div>
      </div>
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recent.map(t => (
          <div key={t.phone} style={{ background: C.creamDeep, borderRadius: 11, padding: 10, border: '1px solid rgba(31,41,55,.06)', display: 'flex', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
              {initials(t.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{t.name}</span>
                <span className="mono-font" style={{ fontSize: 9, color: C.inkLight }}>{timeAgo(t.lastAt)}</span>
              </div>
              <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessage || '—'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientsTab({ profile, patients, appointments, onSelect, onAdd }: {
  profile: CabinetProfile;
  patients: Patient[]; appointments: Appointment[];
  onSelect: (p: Patient) => void; onAdd: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = patients.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const hay = [p.firstName, p.lastName, p.phone, p.email, p.address].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(31,41,55,.06)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, background: C.creamDeep, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={14} color={C.inkSoft} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Nom, téléphone, email…`}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
        </div>
        <button onClick={onAdd} className="btn-primary">
          <Plus size={13} /> Ajouter {profile.clientLabelSingular === 'animal' ? 'un animal' : `un ${profile.clientLabelSingular}`}
        </button>
      </div>

      {patients.length === 0 ? (
        <EmptyState profile={profile} icon={Users} title={`Pas encore de ${profile.clientLabel}`}
          desc={`Ajoute ton premier ${profile.clientLabelSingular} pour commencer à gérer les ${profile.visitLabel}.`}
          cta={`Ajouter ${profile.clientLabelSingular === 'animal' ? 'un animal' : `un ${profile.clientLabelSingular}`}`} onAction={onAdd} />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {filtered.map(p => {
            const visits = appointments.filter(a => a.patientId === p.id && a.status === 'seated').length;
            const age = patientAge(p);
            return (
              <div key={p.id} onClick={() => onSelect(p)} className="card-lift" style={{
                background: C.cream, borderRadius: 14, padding: 14,
                border: '1px solid rgba(31,41,55,.06)',
                borderLeft: `3px solid ${profile.color}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${profile.color}, ${profile.colorDeep})`, color: C.cream, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif' }}>
                    {initials(patientFullName(p))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {patientFullName(p)}
                    </div>
                    <div style={{ fontSize: 10, color: C.inkSoft }}>
                      {age != null && <>{age} ans · </>}
                      <span className="mono-font">{p.phone}</span>
                    </div>
                  </div>
                  <WhatsAppQuickButton phone={p.phone} prefill={`Bonjour ${p.firstName ?? ''}, …`} />
                </div>
                {(p.allergies || p.chronicConditions) && profile.id !== 'avocat' && profile.id !== 'notaire' && profile.id !== 'comptable' && (
                  <div style={{ fontSize: 10, color: C.coralDeep, padding: '6px 8px', borderRadius: 6, background: C.coralSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={10} /> {[p.allergies, p.chronicConditions].filter(Boolean).join(' · ')}
                  </div>
                )}
                {visits > 0 && (
                  <div style={{ fontSize: 10, color: C.inkSoft, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{visits} {profile.visitLabel} effectuée{visits > 1 ? 's' : ''}</span>
                    <span className="pill" style={{ background: profile.colorSoft, color: profile.colorDeep, fontSize: 9, fontWeight: 700 }}>Actif</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgendaTab({ profile, appointments, patients, practitioners, storeId, onAdd, onChanged }: {
  profile: CabinetProfile;
  appointments: Appointment[]; patients: Patient[]; practitioners: Practitioner[];
  storeId: string;
  onAdd: () => void; onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'past' | 'all'>('upcoming');
  const filtered = appointments.filter(a => {
    if (filter === 'today') return a.date === today;
    if (filter === 'upcoming') return a.date >= today && a.status !== 'cancelled';
    if (filter === 'past') return a.date < today;
    return true;
  }).sort((a, b) => {
    const ka = a.date + ' ' + a.time;
    const kb = b.date + ' ' + b.time;
    return ka.localeCompare(kb);
  });

  const setStatus = async (id: string, status: Appointment['status']) => {
    try {
      await api.patch(`/commerce/stores/${storeId}/reservations/${id}`, { status });
      toast.success('RDV mis à jour');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };
  const remove = async (id: string) => {
    if (!confirm('Supprimer ce RDV ?')) return;
    try {
      await api.delete(`/commerce/stores/${storeId}/reservations/${id}`);
      toast.success('RDV supprimé');
      onChanged();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(31,41,55,.06)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {([
          { id: 'upcoming' as const, label: 'À venir' },
          { id: 'today' as const,    label: "Aujourd'hui" },
          { id: 'past' as const,     label: 'Passés' },
          { id: 'all' as const,      label: 'Tous' },
        ]).map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? `linear-gradient(135deg, ${profile.color}, ${profile.colorDeep})` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '7px 12px', borderRadius: 100,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(31,41,55,.1)',
              fontFamily: 'inherit',
            }}>{f.label}</button>
          );
        })}
        <button onClick={onAdd} className="btn-primary" style={{ marginLeft: 'auto' }}>
          <Plus size={13} /> Nouveau {profile.visitLabel.slice(0, -1)}
        </button>
      </div>

      {appointments.length === 0 ? (
        <EmptyState profile={profile} icon={Calendar} title="Aucun RDV"
          desc={`Les ${profile.visitLabel} apparaissent ici. Tu peux en créer manuellement ou laisser l'IA les prendre via WhatsApp.`}
          cta={`Planifier un ${profile.visitLabel.slice(0, -1)}`} onAction={onAdd} />
      ) : filtered.length === 0 ? (
        <EmptyState profile={profile} icon={Calendar} title="Aucun RDV pour ce filtre" desc="Change de filtre." />
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const patient = patients.find(p => p.id === a.patientId);
            const prac = practitioners.find(p => p.name === a.practitionerName);
            const confirmed = a.status === 'confirmed';
            const seated = a.status === 'seated';
            const accent = seated ? C.blueDeep : confirmed ? C.emerald : C.gold;
            return (
              <div key={a.id} className="card-lift" style={{
                background: C.cream, borderRadius: 12, padding: 14,
                border: '1px solid rgba(31,41,55,.06)',
                borderLeft: `4px solid ${accent}`,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ width: 64, padding: 8, borderRadius: 10, background: `${accent}10`, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: accent, fontWeight: 700, textTransform: 'uppercase' }}>
                    {new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </div>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                    {new Date(a.date).getDate()}
                  </div>
                  <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700 }}>{a.time}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                      {a.customerName}
                    </span>
                    <AppointmentStatusPill status={a.status} />
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>
                    {a.reason ?? `${profile.visitLabel.slice(0, -1).charAt(0).toUpperCase() + profile.visitLabel.slice(1, -1)}`}
                    {a.durationMinutes && ` · ${formatDuration(a.durationMinutes)}`}
                    {prac && <> · <span style={{ color: prac.color ?? profile.colorDeep, fontWeight: 600 }}>{prac.name}</span></>}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkLight, fontFamily: 'JetBrains Mono', marginTop: 3 }}>
                    <Phone size={9} style={{ display: 'inline' }} /> {a.customerPhone}
                    {patient && <> · 📋 Dossier #{patient.id.slice(-4)}</>}
                  </div>
                  {a.notes && (
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, fontStyle: 'italic' }}>📝 {a.notes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {a.status === 'pending' && (
                    <button onClick={() => setStatus(a.id, 'confirmed')} className="icon-btn emerald" title="Confirmer"><CheckCircle2 size={14} /></button>
                  )}
                  {a.status === 'confirmed' && (
                    <button onClick={() => setStatus(a.id, 'seated')} className="icon-btn" style={{ background: C.blueSoft, color: C.blueDeep }} title="En consultation"><BadgeCheck size={14} /></button>
                  )}
                  <a href={`https://wa.me/${a.customerPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="icon-btn" style={{ background: C.whatsappSoft, color: C.whatsappDark, textDecoration: 'none' }}>
                    <MessageCircle size={14} />
                  </a>
                  {a.status !== 'cancelled' && (
                    <button onClick={() => setStatus(a.id, 'cancelled')} className="icon-btn ghost"><X size={14} /></button>
                  )}
                  <button onClick={() => remove(a.id)} className="icon-btn ghost" style={{ color: C.red }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppointmentStatusPill({ status }: { status: Appointment['status'] }) {
  const c: Record<Appointment['status'], [string, string, string]> = {
    pending:   [C.yellowSoft, '#92400E',    '⏳ En attente'],
    confirmed: [C.emeraldSoft, C.emeraldDark, '✓ Confirmé'],
    seated:    [C.blueSoft,    C.blueDeep,    '🩺 En cours'],
    cancelled: [C.redSoft,     C.red,         '✗ Annulé'],
    no_show:   ['#FCE7F3',     '#9D174D',     '👻 No show'],
  };
  const [bg, fg, txt] = c[status] ?? c.pending;
  return <span className="pill" style={{ background: bg, color: fg, fontSize: 9, fontWeight: 800 }}>{txt}</span>;
}

function DocumentsTab({ profile, documents, onSelect, onAdd }: {
  profile: CabinetProfile; documents: Document[];
  onSelect: (d: Document) => void; onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(31,41,55,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="pill" style={{ background: profile.colorSoft, color: profile.colorDeep, fontSize: 10, marginBottom: 4 }}>
            <FileText size={11} /> {profile.docLabel.toUpperCase()} · {documents.length}
          </div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: profile.colorDeep }}>{profile.docLabel}</em>
          </h3>
        </div>
        <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Nouveau {profile.docLabel.slice(0, -1)}</button>
      </div>

      {documents.length === 0 ? (
        <EmptyState profile={profile} icon={FileText} title={`Pas encore de ${profile.docLabel}`}
          desc={`Ajoute tes modèles de ${profile.docLabel} (nom, description, tarif si applicable).`}
          cta={`Ajouter mon 1er ${profile.docLabel.slice(0, -1)}`} onAction={onAdd} />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {documents.map(d => (
            <div key={d.id} onClick={() => onSelect(d)} className="card-lift" style={{
              background: C.cream, borderRadius: 14, padding: 14,
              border: '1px solid rgba(31,41,55,.06)',
              borderLeft: `3px solid ${profile.color}`,
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: profile.colorSoft, color: profile.colorDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</h3>
                  {d.price ? (
                    <div className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: profile.colorDeep }}>
                      {formatShort(d.price)} {(d.currency || 'XOF').toUpperCase()}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: C.inkLight }}>Sans tarif</div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); onSelect(d); }} className="icon-btn ghost" style={{ width: 28, height: 28 }}>
                  <Edit3 size={12} />
                </button>
              </div>
              {d.description && (
                <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{d.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamTab({ profile, practitioners, appointments, onAdd, onEdit }: {
  profile: CabinetProfile;
  practitioners: Practitioner[]; appointments: Appointment[];
  onAdd: () => void; onEdit: (p: Practitioner) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(31,41,55,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 10, marginBottom: 4 }}>
            <Briefcase size={11} /> ÉQUIPE · {practitioners.length}
          </div>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>
            Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violetDeep }}>{profile.id === 'avocat' || profile.id === 'notaire' || profile.id === 'comptable' ? 'associés' : 'praticiens'}</em>
          </h3>
        </div>
        <button onClick={onAdd} className="btn-primary"><Plus size={13} /> Ajouter</button>
      </div>

      {practitioners.length === 0 ? (
        <EmptyState profile={profile} icon={Briefcase} title="Pas encore d'équipe"
          desc="Ajoute tes praticiens / associés (nom, rôle, couleur identifiante)."
          cta="Ajouter mon 1er praticien" onAction={onAdd} />
      ) : (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {practitioners.map(p => {
            const todayBookings = appointments.filter(a => a.practitionerName === p.name && a.date === today && a.status !== 'cancelled');
            return (
              <div key={p.id} onClick={() => onEdit(p)} className="card-lift" style={{
                background: C.cream, borderRadius: 16, padding: 16,
                border: '1px solid rgba(31,41,55,.06)',
                borderLeft: `4px solid ${p.color ?? profile.color}`,
                cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${p.color ?? profile.color}, ${p.color ?? profile.colorDeep})`,
                    color: C.cream, fontWeight: 700, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Fraunces, serif',
                  }}>
                    {initials(p.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, margin: 0 }}>{p.name}</h3>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{p.role ?? 'Praticien'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, paddingTop: 8, borderTop: `1px solid ${C.creamDeep}` }}>
                  <span><Calendar size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {todayBookings.length} RDV jour</span>
                  <span style={{ color: p.active === false ? C.coralDeep : C.emeraldDark }}>
                    {p.active === false ? '○ Inactif' : '● Actif'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WhatsAppTab({ profile, threads, connected, onRefresh }: { profile: CabinetProfile; threads: WaThread[]; connected: boolean; onRefresh: () => void }) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(threads[0]?.phone ?? null);
  const selected = threads.find(t => t.phone === selectedPhone) ?? threads[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(31,41,55,.06)' }}>
        <div className="pill" style={{
          background: connected ? `${C.whatsapp}15` : C.creamDeep,
          color: connected ? C.whatsappDark : C.inkSoft,
          fontSize: 10, fontWeight: 700, marginBottom: 4,
        }}>
          {connected ? <><span className="live-dot" style={{ width: 6, height: 6, color: C.whatsapp }}></span> WHATSAPP CONNECTÉ</> : <>● NON CONNECTÉ</>}
        </div>
        <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0 }}>
          Messages <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.whatsappDark }}>du cabinet</em>
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          {threads.length} conversation{threads.length > 1 ? 's' : ''}. Paramètres globaux dans <a href="/admin/whatsapp" style={{ color: profile.colorDeep, fontWeight: 600, textDecoration: 'none' }}>Admin · WhatsApp</a>.
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 14, border: '1px dashed rgba(31,41,55,.15)' }}>
          <MessageCircle size={48} color={C.whatsapp} style={{ marginBottom: 12, opacity: .7 }} />
          <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>
            {connected ? 'Pas encore de message' : 'WhatsApp non connecté'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px' }}>
            {connected ? `Dès qu'un ${profile.clientLabelSingular} t'écrit, sa conversation apparaît ici.` : "Connecte WhatsApp Business pour recevoir les messages."}
          </p>
          {connected ? (
            <button onClick={onRefresh} className="btn-secondary"><RefreshCw size={13} /> Rafraîchir</button>
          ) : (
            <a href="/admin/whatsapp" style={{ textDecoration: 'none' }}>
              <button className="btn-whatsapp"><MessageCircle size={14} /> Connecter WhatsApp</button>
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div className="hide-on-mobile scroll-thin" style={{
            width: 340, flexShrink: 0, background: C.cream, borderRadius: 16, overflow: 'auto',
            border: '1px solid rgba(31,41,55,.06)', height: 'calc(100vh - 280px)', minHeight: 460,
          }}>
            <div style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, position: 'sticky', top: 0, zIndex: 1 }}>
              <div className="mono-font" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', opacity: .9 }}>WHATSAPP BUSINESS</div>
              <h3 className="display-font" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{threads.length} conversations</h3>
            </div>
            {threads.map(t => {
              const sel = selected?.phone === t.phone;
              return (
                <div key={t.phone} onClick={() => setSelectedPhone(t.phone)} style={{
                  padding: '12px 16px', borderBottom: '1px solid rgba(31,41,55,.04)', cursor: 'pointer',
                  background: sel ? `${C.whatsapp}08` : (t.unread ? `${C.whatsapp}03` : 'transparent'),
                  borderLeft: sel ? `3px solid ${C.whatsapp}` : (t.unread ? `3px solid ${C.whatsapp}80` : '3px solid transparent'),
                  display: 'flex', gap: 10,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>
                    {initials(t.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <span className="mono-font" style={{ fontSize: 9, color: C.inkLight }}>{timeAgo(t.lastAt)}</span>
                    </div>
                    <p style={{ fontSize: 11, color: t.unread ? C.ink : C.inkSoft, margin: 0, fontWeight: t.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessage || '—'}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, minWidth: 0, background: C.cream, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(31,41,55,.06)', height: 'calc(100vh - 280px)', minHeight: 460, display: 'flex', flexDirection: 'column' }}>
            {selected && (
              <>
                <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${C.whatsapp}, ${C.whatsappDark})`, color: C.cream, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,250,240,.2)', color: C.cream, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', border: '2px solid rgba(255,250,240,.3)' }}>
                    {initials(selected.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.name}</h3>
                    <div style={{ fontSize: 11, opacity: .85, fontFamily: 'JetBrains Mono' }}>{selected.phone}</div>
                  </div>
                </div>
                <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 18, background: `linear-gradient(180deg, ${C.cream}, ${C.creamDeep}50)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...selected.messages].reverse().map(m => {
                    const inbound = m.direction === 'inbound';
                    const body = m.body ?? m.text ?? m.message ?? '';
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: inbound ? 'flex-start' : 'flex-end' }}>
                        <div style={{
                          background: inbound ? C.cream : C.whatsappSoft,
                          border: inbound ? '1px solid rgba(31,41,55,.06)' : `1px solid ${C.whatsapp}30`,
                          padding: '10px 14px',
                          borderRadius: inbound ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                          maxWidth: '75%', fontSize: 13, color: C.ink, lineHeight: 1.5,
                        }}>
                          {body || <em style={{ color: C.inkLight }}>(message vide)</em>}
                          <div className="mono-font" style={{ fontSize: 9, color: C.inkLight, marginTop: 4, textAlign: 'right' }}>{timeAgo(getTimestamp(m.createdAt))}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: 14, borderTop: '1px solid rgba(31,41,55,.06)' }}>
                  <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="btn-whatsapp" style={{ width: '100%', justifyContent: 'center' }}>
                      <Send size={14} /> Répondre sur WhatsApp
                    </button>
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ profile, icon: Icon, title, desc, cta, onAction }: {
  profile: CabinetProfile; icon: any; title: string; desc: string; cta?: string; onAction?: () => void;
}) {
  return (
    <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 14, border: '1px dashed rgba(31,41,55,.15)' }}>
      <Icon size={48} color={profile.color} style={{ marginBottom: 12, opacity: .7 }} />
      <h3 className="display-font" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px', fontWeight: 800 }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {cta && onAction && (<button onClick={onAction} className="btn-primary"><Plus size={14} /> {cta}</button>)}
    </div>
  );
}

function CabinetActivationScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [cabinetProfile, setCabinetProfile] = useState<CabinetProfileId>('medecin');
  const [paymentInstructions, setPaymentInstructions] = useState('Paiement Wave, espèces ou virement.');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim().length >= 2 && ownerPhone.length >= 6 && !submitting;
  const selectedProfile = PROFILES.find(p => p.id === cabinetProfile)!;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r: any = await api.post('/commerce/stores', {
        name: name.trim(), ownerPhone: ownerPhone.trim(),
        paymentInstructions: paymentInstructions.trim(),
        businessType: 'cabinet',
      });
      const storeId = r?.data?.storeId ?? r?.data?.store?.id;
      if (storeId) {
        await api.patch(`/commerce/stores/${storeId}`, { cabinetProfile }).catch(() => {});
      }
      toast.success('Cabinet activé', `${name.trim()} est en ligne.`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Activation impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.greenDeep, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{makeStyles(selectedProfile)}</style>
      <div style={{ background: C.cream, borderRadius: 22, maxWidth: 580, width: '100%', boxShadow: '0 24px 60px -16px rgba(31,41,55,.18)', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(135deg, ${selectedProfile.color}, ${selectedProfile.colorDeep})`, color: '#fff', padding: '36px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grain"></div>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <selectedProfile.icon size={28} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Active ton <em style={{ fontStyle: 'italic', fontWeight: 500 }}>cabinet</em>
          </h1>
          <p style={{ fontSize: 13, opacity: .92, marginTop: 8 }}>{selectedProfile.tagline}</p>
        </div>
        <div style={{ padding: '26px 32px 30px' }}>
          <div style={{ marginBottom: 14 }}>
            <Label>Type de cabinet</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PROFILES.map(p => {
                const sel = cabinetProfile === p.id;
                const Icon = p.icon;
                return (
                  <button key={p.id} type="button" onClick={() => setCabinetProfile(p.id)} style={{
                    padding: '10px 8px', borderRadius: 10,
                    background: sel ? `linear-gradient(135deg, ${p.color}, ${p.colorDeep})` : C.creamDeep,
                    color: sel ? C.cream : C.ink,
                    border: sel ? 'none' : '1.5px solid transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <Icon size={20} />
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{p.emoji} {p.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Nom du cabinet</Label>
            <Input value={name} onChange={setName} placeholder="Nom de ton cabinet" autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Numéro WhatsApp</Label>
            <Input value={ownerPhone} onChange={setOwnerPhone} placeholder="+XXX XX XX XX XX" />
          </div>
          <div style={{ marginBottom: 22 }}>
            <Label>Instructions paiement</Label>
            <textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={!canSubmit} className="btn-primary">
              {submitting ? <><Loader2 size={14} className="spin" /> Activation…</> : <><Sparkles size={14} /> Activer mon cabinet</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatientModal({ storeId, profile, patient, onClose, onSaved, onDeleted }: {
  storeId: string; profile: CabinetProfile; patient?: Patient;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!patient;
  const isHealth = profile.id === 'medecin' || profile.id === 'dentiste' || profile.id === 'veto';
  const [firstName, setFirstName] = useState(patient?.firstName ?? '');
  const [lastName, setLastName] = useState(patient?.lastName ?? '');
  const [phone, setPhone] = useState(patient?.phone ?? '');
  const [email, setEmail] = useState(patient?.email ?? '');
  const [birthDate, setBirthDate] = useState(patient?.birthDate ?? '');
  const [gender, setGender] = useState<'M' | 'F' | 'other' | ''>(patient?.gender ?? '');
  const [address, setAddress] = useState(patient?.address ?? '');
  const [allergies, setAllergies] = useState(patient?.allergies ?? '');
  const [chronicConditions, setChronicConditions] = useState(patient?.chronicConditions ?? '');
  const [emergencyContact, setEmergencyContact] = useState(patient?.emergencyContact ?? '');
  const [medicalNotes, setMedicalNotes] = useState(patient?.medicalNotes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSubmit = firstName.trim().length >= 1 && lastName.trim().length >= 1 && phone.length >= 6 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
      email: email.trim(), birthDate, gender: gender || undefined,
      address: address.trim(),
      ...(isHealth ? {
        allergies: allergies.trim(),
        chronicConditions: chronicConditions.trim(),
      } : {}),
      emergencyContact: emergencyContact.trim(),
      medicalNotes: medicalNotes.trim(),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/patients/${patient!.id}`, payload);
        toast.success('Dossier mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/patients`, payload);
        toast.success('Dossier créé');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/patients/${patient!.id}`);
      toast.success('Dossier supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? `Modifier ${profile.clientLabelSingular}` : `Nouveau ${profile.clientLabelSingular}`} color={profile.colorDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Prénom</Label><Input value={firstName} onChange={setFirstName} placeholder="Prénom" autoFocus /></div>
        <div><Label>Nom</Label><Input value={lastName} onChange={setLastName} placeholder="Nom" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Téléphone</Label><Input value={phone} onChange={setPhone} placeholder="+XXX XX XX XX XX" /></div>
        <div><Label>Email</Label><Input value={email} onChange={setEmail} placeholder="email@…" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Date naissance</Label><Input type="date" value={birthDate} onChange={setBirthDate} /></div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['M', 'F', 'other'] as const).map(g => {
              const sel = gender === g;
              return (
                <button key={g} type="button" onClick={() => setGender(sel ? '' : g)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 10,
                  background: sel ? profile.colorDeep : 'transparent',
                  color: sel ? C.cream : C.inkSoft,
                  border: `1.5px solid ${sel ? 'transparent' : C.inkLight + '50'}`,
                  cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                }}>{g === 'M' ? 'M' : g === 'F' ? 'F' : 'Autre'}</button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Adresse</Label>
        <Input value={address} onChange={setAddress} />
      </div>
      {isHealth && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Label>Allergies</Label>
            <Input value={allergies} onChange={setAllergies} placeholder="Pénicilline, latex…" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Antécédents chroniques</Label>
            <Input value={chronicConditions} onChange={setChronicConditions} placeholder="Hypertension, diabète…" />
          </div>
        </>
      )}
      <div style={{ marginBottom: 14 }}>
        <Label>Contact d'urgence</Label>
        <Input value={emergencyContact} onChange={setEmergencyContact} placeholder="Nom + téléphone" />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes confidentielles</Label>
        <textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} rows={3}
          placeholder="Visible uniquement par l'équipe. Confidentiel."
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>

      {isEdit && confirmDelete && (
        <div style={{ padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
            Supprimer le dossier de <em>{patientFullName(patient!)}</em> ?
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
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: confirmDelete ? .4 : 1 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Créer</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function AppointmentModal({ storeId, profile, patients, practitioners, onClose, onCreated }: {
  storeId: string; profile: CabinetProfile;
  patients: Patient[]; practitioners: Practitioner[];
  onClose: () => void; onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [patientId, setPatientId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState<number | ''>(30);
  const [practitionerName, setPractitionerName] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (patientId) {
      const p = patients.find(x => x.id === patientId);
      if (p) {
        setCustomerName(patientFullName(p));
        setCustomerPhone(p.phone);
      }
    }
  }, [patientId, patients]);

  const canSubmit = customerName.trim().length >= 2 && customerPhone.length >= 6
    && date && time && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/commerce/stores/${storeId}/reservations`, {
        customerName: customerName.trim(), customerPhone: customerPhone.trim(),
        date, time,
        ...(typeof duration === 'number' && duration > 0 ? { durationMinutes: duration } : {}),
        ...(patientId ? { patientId } : {}),
        ...(practitionerName ? { practitionerName } : {}),
        reason: reason.trim() || profile.visitLabel.slice(0, -1),
        notes: notes.trim(),
      });
      toast.success('RDV créé', `${customerName.trim()} · ${date} ${time}`);
      onCreated();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Création impossible.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={`Nouveau ${profile.visitLabel.slice(0, -1)}`} color={profile.colorDeep} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <Label>{profile.clientLabelSingular[0].toUpperCase() + profile.clientLabelSingular.slice(1)} existant (optionnel)</Label>
        <select value={patientId} onChange={e => setPatientId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">— Nouveau / non enregistré —</option>
          {patients.map(p => <option key={p.id} value={p.id}>{patientFullName(p)} · {p.phone}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Nom</Label><Input value={customerName} onChange={setCustomerName} placeholder="Nom complet" /></div>
        <div><Label>Téléphone</Label><Input value={customerPhone} onChange={setCustomerPhone} placeholder="+XXX XX..." /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
        <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
        <div><Label>Durée (min)</Label><Input type="number" value={String(duration ?? '')} onChange={v => setDuration(v === '' ? '' : parseInt(v))} mono /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Praticien (optionnel)</Label>
        <select value={practitionerName} onChange={e => setPractitionerName(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">— Aucun spécifique —</option>
          {practitioners.map(p => <option key={p.id} value={p.name}>{p.name} · {p.role}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Motif</Label>
        <Input value={reason} onChange={setReason} placeholder={`Motif du ${profile.visitLabel.slice(0, -1)}`} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn-ghost">Annuler</button>
        <button onClick={submit} disabled={!canSubmit} className="btn-primary">
          {submitting ? <><Loader2 size={14} className="spin" /> …</> : <><Plus size={14} /> Créer</>}
        </button>
      </div>
    </ModalShell>
  );
}

function DocumentModal({ storeId, profile, document, onClose, onSaved, onDeleted }: {
  storeId: string; profile: CabinetProfile; document?: Document;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!document;
  const [name, setName] = useState(document?.name ?? '');
  const [description, setDescription] = useState(document?.description ?? '');
  const [price, setPrice] = useState<number | ''>(document?.price ?? '');
  const [status, setStatus] = useState<Document['status']>(document?.status ?? 'active');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload: any = {
      name: name.trim(), description: description.trim(),
      stockQty: 999, status,
      category: 'document',
      ...(typeof price === 'number' && price > 0 ? { price } : { price: 0 }),
    };
    try {
      if (isEdit) {
        await api.patch(`/commerce/stores/${storeId}/products/${document!.id}`, payload);
        toast.success('Document mis à jour');
      } else {
        await api.post(`/commerce/stores/${storeId}/products`, payload);
        toast.success('Document ajouté');
      }
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    if (!confirm('Supprimer ce document ?')) return;
    setSubmitting(true);
    try {
      await api.delete(`/commerce/stores/${storeId}/products/${document!.id}`);
      toast.success('Supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <ModalShell title={isEdit ? `Modifier ${profile.docLabel.slice(0, -1)}` : `Nouveau ${profile.docLabel.slice(0, -1)}`} color={profile.colorDeep} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <Label>Nom</Label>
        <Input value={name} onChange={setName} placeholder={`Nom du ${profile.docLabel.slice(0, -1)}`} autoFocus />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Label>Tarif (optionnel)</Label>
        <Input type="number" value={String(price ?? '')} onChange={v => setPrice(v === '' ? '' : parseInt(v))} placeholder="0 (sans tarif)" mono />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Label>Description</Label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={remove} disabled={submitting}
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={submit} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Créer</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function PractitionerModal({ storeId, practitioners, profile, practitioner, onClose, onSaved, onDeleted }: {
  storeId: string; practitioners: Practitioner[]; profile: CabinetProfile; practitioner?: Practitioner;
  onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
  const isEdit = !!practitioner;
  const [name, setName] = useState(practitioner?.name ?? '');
  const [role, setRole] = useState(practitioner?.role ?? '');
  const [color, setColor] = useState(practitioner?.color ?? profile.color);
  const [active, setActive] = useState<boolean>(practitioner?.active !== false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2 && !submitting;

  const save = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      id: practitioner?.id ?? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(), role: role.trim(), color, active,
    };
    const next = isEdit
      ? practitioners.map(p => p.id === practitioner!.id ? { ...p, ...payload } : p)
      : [...practitioners, payload];
    try {
      await api.patch(`/commerce/stores/${storeId}`, { practitioners: next });
      toast.success(isEdit ? 'Mis à jour' : 'Ajouté');
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const remove = async () => {
    if (!confirm('Supprimer ce praticien ?')) return;
    setSubmitting(true);
    const next = practitioners.filter(p => p.id !== practitioner!.id);
    try {
      await api.patch(`/commerce/stores/${storeId}`, { practitioners: next });
      toast.success('Supprimé');
      onDeleted?.();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  const colors = [profile.color, C.violet, C.gold, C.cyan, C.emerald, C.coral, '#1E40AF', '#16A34A'];

  return (
    <ModalShell title={isEdit ? 'Modifier le membre' : 'Nouveau membre'} color={C.violetDeep} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><Label>Nom</Label><Input value={name} onChange={setName} placeholder="Nom complet" autoFocus /></div>
        <div><Label>Rôle</Label><Input value={role} onChange={setRole} placeholder="Médecin associé, Notaire…" /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Couleur</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {colors.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)} style={{
              width: 32, height: 32, borderRadius: 8,
              background: c, border: color === c ? `3px solid ${C.ink}` : '2px solid transparent',
              cursor: 'pointer',
            }} />
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <button type="button" onClick={() => setActive(!active)} style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: active ? `${C.emerald}10` : '#fff',
          border: `1.5px solid ${active ? C.emerald : C.creamDeep}`,
          color: active ? C.emeraldDark : C.inkSoft,
          fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Actif (visible dans l'agenda)</span>
          <span>{active ? '✓ Oui' : '○ Non'}</span>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {isEdit ? (
          <button onClick={remove} disabled={submitting}
            style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: '#DC2626', border: '1.5px solid #FCA5A5', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Trash2 size={12} /> Supprimer
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost">Annuler</button>
          <button onClick={save} disabled={!canSubmit} className="btn-primary">
            {submitting ? <><Loader2 size={14} className="spin" /> …</> : (isEdit ? <><Save size={14} /> Enregistrer</> : <><Plus size={14} /> Ajouter</>)}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function CabinetSettingsModal({ store, profile, onClose, onSaved }: {
  store: Store; profile: CabinetProfile; onClose: () => void; onSaved: () => void;
}) {
  const [cabinetProfile, setCabinetProfile] = useState<CabinetProfileId>(store.cabinetProfile ?? profile.id);
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/commerce/stores/${store.id}`, { cabinetProfile });
      toast.success('Profil cabinet mis à jour');
      onSaved();
    } catch (e: any) { toast.error('Erreur', e?.response?.data?.message ?? 'Erreur.'); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <StoreSettingsModal accentColor={profile.color} accentDeep={profile.colorDeep}
        store={store as any} onClose={onClose} onSaved={onSaved} />
      <div style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 200,
        background: C.cream, borderRadius: 14, padding: 14,
        border: '1px solid rgba(31,41,55,.06)',
        boxShadow: '0 12px 30px -8px rgba(31,41,55,.2)',
      }}>
        <Label>Profil cabinet</Label>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {PROFILES.map(p => {
            const sel = cabinetProfile === p.id;
            return (
              <button key={p.id} onClick={() => setCabinetProfile(p.id)} title={p.label} style={{
                padding: '6px 10px', borderRadius: 8,
                background: sel ? p.color : 'transparent', color: sel ? C.cream : C.inkSoft,
                border: sel ? 'none' : '1px solid rgba(31,41,55,.1)',
                cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
              }}>{p.emoji}</button>
            );
          })}
        </div>
        <button onClick={save} disabled={submitting} className="btn-primary" style={{ marginTop: 10, fontSize: 11, padding: '6px 12px' }}>
          {submitting ? <><Loader2 size={12} className="spin" /> …</> : <><Save size={12} /> Changer profil</>}
        </button>
      </div>
    </>
  );
}

function ModalShell({ title, color, onClose, children }: { title: string; color: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, padding: 16,
      background: 'rgba(31,41,55,.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 620, width: '100%',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(31,41,55,.5)',
      }}>
        <div style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)`, color: '#fff', padding: '20px 24px', borderRadius: '22px 22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>{title}</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '22px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{children}</label>;
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
