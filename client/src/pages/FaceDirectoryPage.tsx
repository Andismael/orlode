/**
 * Face Directory — Premium redesign.
 *
 * Vision = reconnaissance faciale (purple/violet palette).
 * Reuses existing API:
 *   - GET    /faces/employees
 *   - POST   /faces/employees
 *   - DELETE /faces/employees/:id
 *
 * Enrollment + recognition modals are unchanged (EnrollPhotoModal / RecognizeModal).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, ScanFace, RefreshCw, Loader2, Sparkles,
  Settings, X, Camera, User as UserIcon, Briefcase, Building2, Phone, Mail,
  Upload, Download, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertTriangle,
  Package, ArrowUpDown, Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useLangStore } from '@/store/langStore';
import EnrollPhotoModal from '@/components/faces/EnrollPhotoModal';
import RecognizeModal from '@/components/faces/RecognizeModal';
import { loadFaceApiModels, detectFaceDescriptor } from '@/lib/faceDetection';

const C = {
  purple:      '#7C3AED',
  purpleDeep:  '#5B21B6',
  purpleSoft:  '#EDE9FE',
  purpleLight: '#C4B5FD',
  pink:        '#EC4899',
  pinkDeep:    '#BE185D',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldSoft: '#D1FAE5',
  red:         '#EF4444',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  .btn-purple { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px; background:linear-gradient(135deg, ${C.purple}, ${C.purpleDeep}); color:#fff; border:none; cursor:pointer; font-weight:700; font-size:13px; font-family:'Inter',sans-serif; box-shadow:0 6px 16px -6px ${C.purple}80; transition:transform .15s ease, box-shadow .15s ease; }
  .btn-purple:hover { transform: translateY(-1px); box-shadow:0 10px 22px -8px ${C.purple}; }
  .btn-purple:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .btn-purple-deep { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px; background:${C.purpleDeep}; color:#fff; border:none; cursor:pointer; font-weight:700; font-size:13px; font-family:'Inter',sans-serif; box-shadow:0 6px 16px -6px ${C.purple}80; transition:transform .15s ease; }
  .btn-purple-deep:hover { transform: translateY(-1px); }
  .btn-purple-deep:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .btn-ghost { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px; background:${C.cream}; color:${C.ink}; border:1.5px solid rgba(10,42,32,0.12); cursor:pointer; font-weight:600; font-size:13px; font-family:'Inter',sans-serif; transition:background .15s ease, border-color .15s ease; }
  .btn-ghost:hover { background:${C.creamDeep}; border-color:${C.purple}; color:${C.purpleDeep}; }
  .pill { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px; font-weight:700; font-size:11px; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1)  { animation-delay: 0.02s; }
  .stagger > *:nth-child(2)  { animation-delay: 0.04s; }
  .stagger > *:nth-child(3)  { animation-delay: 0.06s; }
  .stagger > *:nth-child(4)  { animation-delay: 0.08s; }
  .stagger > *:nth-child(5)  { animation-delay: 0.10s; }
  .stagger > *:nth-child(6)  { animation-delay: 0.12s; }
  .stagger > *:nth-child(7)  { animation-delay: 0.14s; }
  .stagger > *:nth-child(8)  { animation-delay: 0.16s; }
  .stagger > *:nth-child(9)  { animation-delay: 0.18s; }
  .stagger > *:nth-child(10) { animation-delay: 0.20s; }
  .stagger > *:nth-child(n+11) { animation-delay: 0.22s; }
  .face-card { background: ${C.cream}; border: 1px solid rgba(10,42,32,0.06); border-radius: 18px; padding: 14px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; cursor: pointer; position: relative; }
  .face-card:hover { transform: translateY(-3px); box-shadow: 0 18px 32px -16px rgba(124,58,237,0.35); border-color: ${C.purpleLight}; }
  .face-icon-btn { width: 32px; height: 32px; border-radius: 9px; background: ${C.creamDeep}; color: ${C.inkSoft}; display: inline-flex; align-items: center; justify-content: center; border: none; cursor: pointer; transition: background .15s ease, color .15s ease; }
  .face-icon-btn:hover { background: ${C.red}15; color: ${C.red}; }
  .search-input { width: 100%; background: transparent; border: none; outline: none; font-size: 14px; color: ${C.ink}; font-family: inherit; }
  .search-input::placeholder { color: ${C.inkLight}; }
  .form-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid rgba(10,42,32,0.1); background: ${C.cream}; font-size: 13px; color: ${C.ink}; font-family: inherit; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
  .form-input:focus { border-color: ${C.purple}; box-shadow: 0 0 0 3px ${C.purple}25; }
  .form-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
  .csv-dropzone { width: 100%; padding: 36px 18px; border-radius: 14px; background: ${C.creamDeep}; color: ${C.purpleDeep}; border: 2px dashed ${C.purple}; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
  .csv-dropzone:hover { background: ${C.purpleSoft}; border-color: ${C.purpleDeep}; transform: translateY(-1px); }
  .csv-dropzone.dragging { background: ${C.purpleSoft}; border-color: ${C.purpleDeep}; box-shadow: 0 0 0 4px ${C.purple}25; }
  .csv-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
  .csv-table th { position: sticky; top: 0; background: ${C.creamDeep}; color: ${C.inkSoft}; font-weight: 700; text-align: left; padding: 8px 10px; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; border-bottom: 1px solid rgba(10,42,32,0.08); }
  .csv-table td { padding: 8px 10px; border-bottom: 1px solid rgba(10,42,32,0.06); color: ${C.ink}; vertical-align: middle; }
  .csv-table tr.csv-row-invalid td { background: ${C.red}08; color: ${C.inkSoft}; }
  .csv-table tr:hover td { background: ${C.cream}; }
  .dept-pill:hover { background: ${C.creamDeep}; border-color: ${C.purpleLight}; color: ${C.purpleDeep}; }
  .sort-trigger:hover { color: ${C.purpleDeep}; background: ${C.purpleSoft}; }
  .sort-menu-item:hover { background: ${C.purpleSoft}; color: ${C.purpleDeep}; }
`;

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  phone?: string;
  email?: string;
  photoURL?: string;
  faceDescriptor?: number[];
  enrolledAt?: string;
  color: string;
}

const PALETTE = ['#7C3AED', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

function getColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

const COMMON_DEPARTMENTS = [
  'Direction', 'Administration', 'Comptabilité', 'Ressources humaines',
  'Commercial', 'Marketing', 'Production', 'Logistique', 'Sécurité',
  'Accueil', 'Technique', 'Informatique',
];

export default function FaceDirectoryPage() {
  useLangStore(); // keep store subscribed for global lang refresh
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollTarget, setEnrollTarget] = useState<Employee | null>(null);
  const [showRecognize, setShowRecognize] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'name' | 'recent' | 'unenrolled' | 'dept'>('name');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const SORT_LABELS: Record<'name' | 'recent' | 'unenrolled' | 'dept', string> = {
    name: 'A → Z',
    recent: 'Récemment enrôlés',
    unenrolled: 'Non enrôlés d\'abord',
    dept: 'Par département',
  };

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    if (sortMenuOpen) document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [sortMenuOpen]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get<Employee[]>('/faces/employees');
      const data = (Array.isArray(res.data) ? res.data : []).map((e, i) => ({ ...e, color: getColor(i) }));
      setEmployees(data);
    } catch {
      // keep empty
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer ${name} de l'annuaire ?`)) return;
    try {
      await api.delete(`/faces/employees/${id}`);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      toast.success('Employé supprimé');
    } catch {
      toast.error('Suppression impossible', 'Réessaie dans un instant.');
    }
  };

  const filtered = employees.filter((e) => {
    if (activeDept && e.department !== activeDept) return false;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      (e.role ?? '').toLowerCase().includes(q) ||
      (e.department ?? '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case 'recent':
        return (b.enrolledAt ?? '').localeCompare(a.enrolledAt ?? '');
      case 'unenrolled': {
        const aE = !!(a.faceDescriptor && a.faceDescriptor.length > 0);
        const bE = !!(b.faceDescriptor && b.faceDescriptor.length > 0);
        if (aE !== bE) return aE ? 1 : -1;
        return a.name.localeCompare(b.name);
      }
      case 'dept':
        return (a.department ?? '').localeCompare(b.department ?? '') || a.name.localeCompare(b.name);
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];
  const enrolledCount = employees.filter((e) => e.faceDescriptor && e.faceDescriptor.length > 0).length;
  const enrollmentRate = employees.length > 0
    ? Math.round((enrolledCount / employees.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 size={32} className="spin" color={C.purple} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDeep} 100%)`,
        padding: '32px 32px 28px', color: C.cream, position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 100,
              background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <ScanFace size={11} /> VISION · RECONNAISSANCE FACIALE
            </div>
            <button title="Paramètres"
              onClick={() => navigate('/vision/settings')}
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

          <h1 className="display-font" style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>
            <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Reconnaissance</em>{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 500 }}>faciale.</em>
          </h1>
          <p style={{ marginTop: 10, fontSize: 13, opacity: 0.92, maxWidth: 640 }}>
            Enregistre la photo de chaque employé pour activer la détection automatique
            à l'accueil — l'agent Réception reconnaît visages et badges en temps réel.
          </p>

          {/* KPIs */}
          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Kpi label="Total employés"        value={`${employees.length}`}   icon={UserIcon} />
            <Kpi label="Enregistrés"           value={`${enrolledCount}`}      icon={ScanFace} />
            <Kpi label="Départements"          value={`${departments.length}`} icon={Building2} />
            <Kpi label="Taux d'enregistrement" value={`${enrollmentRate}%`}    icon={Sparkles} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 64px' }}>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <button
            onClick={fetchEmployees}
            title="Rafraîchir"
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: C.cream, color: C.inkSoft,
              border: '1px solid rgba(10,42,32,0.1)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit',
            }}>
            <RefreshCw size={15} />
          </button>
          {employees.length > 0 && (
            <button className="btn-ghost" onClick={() => setBulkEnrollOpen(true)}>
              <Package size={14} /> Enrôler en masse
            </button>
          )}
          <button onClick={() => setImportOpen(true)} className="btn-ghost">
            <Upload size={14} /> Importer CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-ghost">
            <Plus size={14} /> Ajouter un employé
          </button>
          <button onClick={() => setShowRecognize(true)} className="btn-purple">
            <ScanFace size={14} /> Reconnaître un visage
          </button>
        </div>

        {/* Premium banner */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
          color: '#fff', borderRadius: 18, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            position: 'relative',
          }}>
            <Sparkles size={20} />
          </div>
          <div style={{ position: 'relative', minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Reconnaissance faciale active
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.92 }}>
              Enregistre la photo de chaque employé pour activer la détection automatique dans Réception.
            </p>
          </div>
        </div>

        {/* Search bar + Sort */}
        <div style={{
          background: C.cream, border: '1px solid rgba(10,42,32,0.06)',
          borderRadius: 12, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        }}>
          <Search size={16} color={C.inkLight} />
          <input
            type="text"
            placeholder="Chercher par nom, poste, département…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ flex: 1 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{
              width: 22, height: 22, borderRadius: 6,
              background: C.creamDeep, color: C.inkSoft,
              border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={12} />
            </button>
          )}
          <div ref={sortMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="sort-trigger"
              onClick={() => setSortMenuOpen((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8,
                background: 'transparent', color: C.inkSoft,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              <ArrowUpDown size={14} /> Trier · {SORT_LABELS[sortMode]}
            </button>
            {sortMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: C.cream, border: '1px solid rgba(10,42,32,0.1)',
                borderRadius: 12, padding: 6, minWidth: 200,
                boxShadow: '0 12px 28px -8px rgba(10,42,32,0.18)', zIndex: 10,
              }}>
                {(['name', 'recent', 'unenrolled', 'dept'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="sort-menu-item"
                    onClick={() => { setSortMode(opt); setSortMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: 'transparent', border: 'none', width: '100%',
                      textAlign: 'left' as const, color: C.ink, fontFamily: 'inherit',
                    }}
                  >
                    <span>{SORT_LABELS[opt]}</span>
                    {sortMode === opt && <Check size={14} color={C.purple} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Department filter pills */}
        {departments.length > 1 && (
          <div style={{
            display: 'flex', gap: 8, overflowX: 'auto',
            scrollbarWidth: 'none' as any,
            padding: '2px 0', marginBottom: 14,
            WebkitOverflowScrolling: 'touch' as const,
          }}>
            <button
              type="button"
              onClick={() => setActiveDept(null)}
              style={
                activeDept === null
                  ? {
                      background: C.purple, color: '#fff', fontWeight: 700,
                      padding: '7px 14px', borderRadius: 100,
                      fontSize: 12, border: 'none', cursor: 'pointer',
                      whiteSpace: 'nowrap', fontFamily: 'inherit',
                    }
                  : {
                      background: C.cream, color: C.inkSoft,
                      border: '1px solid rgba(10,42,32,0.1)',
                      padding: '7px 14px', borderRadius: 100,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      whiteSpace: 'nowrap', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }
              }
              className={activeDept === null ? '' : 'dept-pill'}
            >
              Tous ({employees.length})
            </button>
            {departments.map((dept) => {
              const isActive = activeDept === dept;
              const count = employees.filter((e) => e.department === dept).length;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setActiveDept(isActive ? null : dept)}
                  className={isActive ? '' : 'dept-pill'}
                  style={
                    isActive
                      ? {
                          background: C.purple, color: '#fff', fontWeight: 700,
                          padding: '7px 14px', borderRadius: 100,
                          fontSize: 12, border: 'none', cursor: 'pointer',
                          whiteSpace: 'nowrap', fontFamily: 'inherit',
                        }
                      : {
                          background: C.cream, color: C.inkSoft,
                          border: '1px solid rgba(10,42,32,0.1)',
                          padding: '7px 14px', borderRadius: 100,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          whiteSpace: 'nowrap', fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }
                  }
                >
                  {dept} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter count indicator */}
        {(() => {
          const isFiltered = !!searchQuery.trim() || activeDept !== null;
          const filteredCount = sorted.length;
          const totalCount = employees.length;
          if (filteredCount === 0 && isFiltered) return null;
          if (!isFiltered && filteredCount > 0) {
            return (
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
                {filteredCount} employé{filteredCount > 1 ? 's' : ''}
              </div>
            );
          }
          if (isFiltered) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 12, color: C.inkSoft }}>
                <span>{filteredCount} sur {totalCount} employés</span>
                <button onClick={() => { setSearchQuery(''); setActiveDept(null); }}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 8, background: 'transparent', border: '1px solid rgba(10,42,32,0.15)', color: C.purpleDeep, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                  Tout afficher
                </button>
              </div>
            );
          }
          return null;
        })()}

        {/* Employee grid OR empty state */}
        {employees.length === 0 ? (
          <EmptyState onAdd={() => setShowAddModal(true)} />
        ) : sorted.length === 0 ? (
          <NoResults query={searchQuery} onClear={() => { setSearchQuery(''); setActiveDept(null); }} />
        ) : (
          <div className="stagger" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14,
          }}>
            {sorted.map((person) => {
              const isEnrolled = !!(person.faceDescriptor && person.faceDescriptor.length > 0);
              return (
                <div
                  key={person.id}
                  className="face-card"
                  onClick={() => setEnrollTarget(person)}
                >
                  {/* Photo / Avatar — 3:4 aspect */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '3 / 4',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: `linear-gradient(135deg, ${person.color}, ${person.color}cc)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                  }}>
                    {person.photoURL ? (
                      <img
                        src={person.photoURL}
                        alt={person.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span className="display-font" style={{
                        fontSize: 44, fontWeight: 800, color: '#fff',
                        letterSpacing: '-0.04em', textShadow: '0 2px 8px rgba(0,0,0,0.18)',
                      }}>
                        {person.name[0]?.toUpperCase() ?? '?'}
                      </span>
                    )}

                    {/* Status badge */}
                    <span className="pill" style={{
                      position: 'absolute', top: 8, right: 8,
                      background: isEnrolled ? C.emeraldSoft : 'rgba(255,255,255,0.85)',
                      color: isEnrolled ? C.emeraldDeep : C.inkSoft,
                      backdropFilter: 'blur(6px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    }}>
                      {isEnrolled ? '✓ Enregistré' : 'Non enregistré'}
                    </span>
                  </div>

                  {/* Name + role */}
                  <div style={{ marginBottom: 8 }}>
                    <div className="display-font" style={{
                      fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {person.name}
                    </div>
                    {person.role && (
                      <div style={{
                        fontSize: 12, color: C.inkSoft, marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {person.role}
                      </div>
                    )}
                  </div>

                  {/* Department pill */}
                  {person.department && (
                    <span className="pill" style={{
                      background: `${C.purple}15`, color: C.purpleDeep,
                      marginBottom: 10, maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'inline-block', padding: '4px 10px',
                    }}>
                      {person.department}
                    </span>
                  )}

                  {/* Bottom actions */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEnrollTarget(person)}
                      className="btn-purple-deep"
                      style={{
                        flex: 1, padding: '8px 10px', fontSize: 12,
                        background: isEnrolled ? C.purpleSoft : `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
                        color: isEnrolled ? C.purpleDeep : '#fff',
                        boxShadow: isEnrolled ? 'none' : `0 6px 16px -6px ${C.purple}80`,
                      }}
                    >
                      <Camera size={12} />
                      {isEnrolled ? 'Re-enrôler' : 'Enrôler'}
                    </button>
                    <button
                      onClick={() => handleDelete(person.id, person.name)}
                      className="face-icon-btn"
                      title="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {enrollTarget && (
        <EnrollPhotoModal
          employee={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onEnrolled={(photoURL) => {
            setEmployees((prev) =>
              prev.map((e) => e.id === enrollTarget.id ? { ...e, photoURL, faceDescriptor: [1] } : e),
            );
            setEnrollTarget(null);
          }}
        />
      )}
      {showRecognize && (
        <RecognizeModal
          employees={employees}
          onClose={() => setShowRecognize(false)}
        />
      )}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); fetchEmployees(); }}
        />
      )}
      {importOpen && (
        <ImportCsvModal
          onClose={() => setImportOpen(false)}
          onImported={() => fetchEmployees()}
        />
      )}
      {bulkEnrollOpen && (
        <BulkEnrollModal
          employees={employees}
          onClose={() => setBulkEnrollOpen(false)}
          onEnrolled={fetchEmployees}
        />
      )}
    </div>
  );
}

// ── Hero KPI card ──────────────────────────────────────────────────────────
function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div style={{
      background: 'rgba(255,250,240,0.14)', backdropFilter: 'blur(10px)',
      borderRadius: 14, padding: '14px 16px',
      border: '1px solid rgba(255,250,240,0.20)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} style={{ opacity: 0.85 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div className="display-font" style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

// ── Empty states ───────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      background: C.cream, borderRadius: 22,
      padding: '48px 32px', textAlign: 'center',
      border: '1px solid rgba(10,42,32,0.06)',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', marginBottom: 18,
        boxShadow: `0 16px 32px -12px ${C.purple}80`,
      }}>
        <ScanFace size={32} />
      </div>
      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
        Aucun <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleDeep }}>employé</em> encore
      </h3>
      <p style={{ margin: '10px auto 22px', fontSize: 13, color: C.inkSoft, maxWidth: 380 }}>
        Ajoute ton premier employé pour activer la reconnaissance — l'agent Réception
        le saluera par son prénom dès la première visite.
      </p>
      <button onClick={onAdd} className="btn-purple">
        <Plus size={14} /> Ajouter mon premier employé
      </button>
    </div>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div style={{
      background: C.cream, borderRadius: 18,
      padding: '36px 24px', textAlign: 'center',
      border: '1px solid rgba(10,42,32,0.06)',
    }}>
      <Search size={28} color={C.inkLight} style={{ marginBottom: 10 }} />
      <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
        Aucun résultat pour <strong style={{ color: C.ink }}>"{query}"</strong>.
      </p>
      <button onClick={onClear} className="btn-ghost" style={{ marginTop: 14 }}>
        Effacer les filtres
      </button>
    </div>
  );
}

// ── Add employee modal ────────────────────────────────────────────────────
function AddEmployeeModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image trop lourde', 'Max 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
      setPhotoBase64(base64);
      setPhotoMimeType(file.type || 'image/jpeg');
      setPhotoPreview(dataUrl);
    };
    reader.onerror = () => toast.error('Lecture impossible', 'Le fichier ne peut pas être lu.');
    reader.readAsDataURL(file);
  };

  const canSubmit = name.trim().length >= 2 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/faces/employees', {
        name: name.trim(),
        role: role.trim(),
        department: department.trim(),
        phone: phone.trim(),
        email: email.trim(),
        ...(photoBase64 ? { photoBase64, photoMimeType } : {}),
      });
      toast.success('Employé ajouté', `${name.trim()} est dans l'annuaire.`);
      onCreated();
    } catch (e: any) {
      toast.error('Création impossible', e?.response?.data?.message ?? 'Réessaie.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22,
        maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
          color: '#fff', padding: '22px 24px',
          borderRadius: '22px 22px 0 0', position: 'relative',
        }}>
          <button onClick={onClose} aria-label="Fermer" style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserIcon size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
                Annuaire
              </div>
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                Nouvel <em style={{ fontStyle: 'italic', fontWeight: 500 }}>employé</em>
              </h3>
            </div>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.9 }}>
            Tu pourras enrôler son visage juste après.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          {/* Photo upload */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">
              <Camera size={13} /> Photo (optionnel)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              style={{ display: 'none' }}
            />
            {photoPreview ? (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', maxHeight: 200 }}>
                <img src={photoPreview} alt="aperçu" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoBase64(null); setPhotoMimeType(null); setPhotoPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(10,42,32,0.8)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Trash2 size={11} /> Retirer
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '24px 14px', borderRadius: 12,
                  background: C.creamDeep, color: C.purpleDeep,
                  border: `1.5px dashed ${C.purple}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <Camera size={24} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Choisir une photo</span>
                <span style={{ fontSize: 10, color: C.inkSoft }}>JPG/PNG · max 8 MB</span>
              </button>
            )}
          </div>

          {/* Name */}
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">
              <UserIcon size={13} /> Nom complet *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Awa Diallo"
              className="form-input"
              autoFocus
            />
          </div>

          {/* Role */}
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">
              <Briefcase size={13} /> Poste
            </label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ex: Responsable accueil"
              className="form-input"
            />
          </div>

          {/* Department */}
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">
              <Building2 size={13} /> Département
            </label>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex: Administration"
              className="form-input"
              list="dept-suggestions"
            />
            <datalist id="dept-suggestions">
              {COMMON_DEPARTMENTS.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>

          {/* Phone + Email side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
            <div>
              <label className="form-label">
                <Phone size={13} /> Téléphone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+225…"
                className="form-input"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            <div>
              <label className="form-label">
                <Mail size={13} /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="awa@…"
                className="form-input"
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} disabled={submitting} style={{
              padding: '10px 18px', borderRadius: 10,
              background: 'transparent', color: C.inkSoft,
              border: `1.5px solid ${C.inkLight}`,
              cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            }}>
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={!canSubmit} className="btn-purple">
              {submitting
                ? <><Loader2 size={14} className="spin" /> Création…</>
                : <><Plus size={14} /> Ajouter</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bulk CSV / XLSX import modal ──────────────────────────────────────────
interface ParsedRow {
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  valid: boolean;
  reason: string;
  include: boolean;
}

interface BulkResult {
  created: number;
  failed: Array<{ row: number; name: string; reason: string }>;
  total: number;
}

// Strip accents + lowercase to match headers like "Département" or "TÉLÉPHONE".
function normalizeHeader(h: string): string {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const HEADER_ALIASES: Record<keyof Pick<ParsedRow, 'name' | 'role' | 'department' | 'phone' | 'email'>, string[]> = {
  name:       ['nom', 'name', 'prenom nom', 'prenomnom', 'fullname', 'full name'],
  role:       ['poste', 'role', 'fonction', 'job', 'title'],
  department: ['departement', 'department', 'service', 'equipe'],
  phone:      ['telephone', 'phone', 'tel', 'mobile'],
  email:      ['email', 'e-mail', 'mail', 'courriel'],
};

function mapRowToCanonical(rawRow: Record<string, unknown>): Omit<ParsedRow, 'valid' | 'reason' | 'include'> {
  const out = { name: '', role: '', department: '', phone: '', email: '' };
  for (const [rawKey, rawVal] of Object.entries(rawRow)) {
    const norm = normalizeHeader(rawKey);
    for (const canonical of Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>) {
      if (HEADER_ALIASES[canonical].includes(norm)) {
        const val = rawVal == null ? '' : String(rawVal).trim();
        if (val) out[canonical] = val;
        break;
      }
    }
  }
  return out;
}

// Minimal CSV parser that handles quoted fields, escaped quotes, and a chosen separator.
function parseCsv(text: string, separator: string): Array<Record<string, string>> {
  // Strip BOM and normalize line endings.
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cur += '"'; i += 1; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      row.push(cur); cur = '';
    } else if (ch === '\n') {
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) lines.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    if (row.some((c) => c.trim() !== '')) lines.push(row);
  }
  if (lines.length === 0) return [];
  const headers = lines[0].map((h) => h.trim());
  return lines.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (cells[idx] ?? '').trim(); });
    return obj;
  });
}

function ImportCsvModal({ onClose, onImported }: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateLinkRef = useRef<HTMLAnchorElement>(null);

  const valids   = useMemo(() => parsedRows.filter((r) => r.valid).length, [parsedRows]);
  const invalids = parsedRows.length - valids;
  const toImport = useMemo(() => parsedRows.filter((r) => r.include && r.valid).length, [parsedRows]);

  // Build & download the CSV template.
  const downloadTemplate = () => {
    const csv = [
      'nom,poste,departement,telephone,email',
      'Awa Diallo,Responsable accueil,Administration,+225 07 00 00 00 00,awa@example.com',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele-employes.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const ingestRows = (raw: Array<Record<string, unknown>>) => {
    const mapped: ParsedRow[] = raw.map((r) => {
      const canonical = mapRowToCanonical(r);
      const validName = canonical.name.trim().length >= 2;
      return {
        ...canonical,
        valid: validName,
        reason: validName ? '' : 'Nom manquant',
        include: validName,
      };
    });
    if (mapped.length === 0) {
      toast.error('Fichier vide', 'Aucune ligne détectée dans le fichier.');
      return;
    }
    setParsedRows(mapped);
    setStep('preview');
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? '';
        const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
        const rows = parseCsv(text, separator);
        ingestRows(rows);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) {
          toast.error('Fichier illisible', 'Aucune feuille trouvée.');
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        ingestRows(rows);
      } else {
        toast.error('Format non supporté', 'Utilise un fichier .csv ou .xlsx.');
      }
    } catch (err) {
      console.error('[ImportCsvModal] parse error', err);
      toast.error('Lecture impossible', 'Le fichier n’a pas pu être analysé.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const toggleInclude = (idx: number) => {
    setParsedRows((prev) => prev.map((r, i) =>
      i === idx && r.valid ? { ...r, include: !r.include } : r,
    ));
  };

  const handleImport = async () => {
    if (toImport === 0 || submitting) return;
    setSubmitting(true);
    try {
      const employees = parsedRows
        .filter((r) => r.include && r.valid)
        .map((r) => ({
          name: r.name,
          role: r.role,
          department: r.department,
          phone: r.phone,
          email: r.email,
        }));
      const res = await api.post<BulkResult>('/faces/employees/bulk', { employees });
      const data = (res.data ?? { created: 0, failed: [], total: 0 }) as BulkResult;
      setResult(data);
      setStep('done');
      if (data.created > 0) {
        toast.success(
          `${data.created} employé${data.created > 1 ? 's' : ''} importé${data.created > 1 ? 's' : ''}`,
          data.failed.length > 0 ? `${data.failed.length} échec(s).` : 'Tout est en ordre.',
        );
      } else {
        toast.error('Import échoué', 'Aucun employé n’a pu être créé.');
      }
    } catch (e: any) {
      toast.error('Import impossible', e?.response?.data?.message ?? 'Réessaie dans un instant.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'done') onImported();
    onClose();
  };

  return (
    <div onClick={handleClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22,
        maxWidth: 720, width: '100%', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
          color: '#fff', padding: '22px 24px',
          borderRadius: '22px 22px 0 0', position: 'relative',
        }}>
          <button onClick={handleClose} aria-label="Fermer" style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.18)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={15} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
                Import en masse
              </div>
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                Importer <em style={{ fontStyle: 'italic', fontWeight: 500 }}>des employés</em>
              </h3>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.9 }}>
            Glisse un fichier CSV ou Excel pour créer jusqu'à 200 employés d'un coup.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          {step === 'upload' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
                style={{ display: 'none' }}
              />
              <a ref={templateLinkRef} style={{ display: 'none' }} />
              <button
                type="button"
                className={`csv-dropzone ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <Upload size={32} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Glisse ton fichier ici ou clique pour choisir
                </span>
                <span style={{ fontSize: 11, color: C.inkSoft }}>
                  Formats acceptés : .csv, .xlsx · max 200 lignes
                </span>
              </button>

              <div style={{
                marginTop: 18, padding: '14px 16px', borderRadius: 12,
                background: C.purpleSoft, color: C.purpleDeep,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ fontSize: 12 }}>
                  <strong style={{ display: 'block', fontWeight: 700, marginBottom: 2 }}>
                    Tu n'as pas de fichier ?
                  </strong>
                  Télécharge un modèle avec les bonnes colonnes.
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10,
                    background: '#fff', color: C.purpleDeep,
                    border: `1.5px solid ${C.purple}`,
                    cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Download size={13} /> Modèle CSV
                </button>
              </div>

              <div style={{
                marginTop: 14, fontSize: 11, color: C.inkSoft, lineHeight: 1.5,
              }}>
                <strong style={{ color: C.ink }}>Colonnes attendues</strong> :{' '}
                <code className="mono-font" style={{ background: C.creamDeep, padding: '1px 6px', borderRadius: 4 }}>nom</code> (obligatoire),{' '}
                <code className="mono-font" style={{ background: C.creamDeep, padding: '1px 6px', borderRadius: 4 }}>poste</code>,{' '}
                <code className="mono-font" style={{ background: C.creamDeep, padding: '1px 6px', borderRadius: 4 }}>departement</code>,{' '}
                <code className="mono-font" style={{ background: C.creamDeep, padding: '1px 6px', borderRadius: 4 }}>telephone</code>,{' '}
                <code className="mono-font" style={{ background: C.creamDeep, padding: '1px 6px', borderRadius: 4 }}>email</code>.
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div style={{
                padding: '12px 16px', borderRadius: 12,
                background: C.purpleSoft, color: C.purpleDeep,
                marginBottom: 14, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <FileSpreadsheet size={16} />
                <span>
                  <strong>{parsedRows.length}</strong> employé{parsedRows.length > 1 ? 's' : ''} détecté{parsedRows.length > 1 ? 's' : ''}
                  {' · '}
                  <span style={{ color: C.emeraldDeep }}>{valids} valide{valids > 1 ? 's' : ''}</span>
                  {' · '}
                  <span style={{ color: C.red }}>{invalids} invalide{invalids > 1 ? 's' : ''}</span>
                </span>
                {fileName && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }} className="mono-font">
                    {fileName}
                  </span>
                )}
              </div>

              <div style={{
                maxHeight: 320, overflowY: 'auto',
                border: '1px solid rgba(10,42,32,0.08)',
                borderRadius: 12, background: '#fff',
              }}>
                <table className="csv-table">
                  <thead>
                    <tr>
                      <th style={{ width: 38 }}>
                        <input
                          type="checkbox"
                          checked={toImport > 0 && toImport === valids}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setParsedRows((prev) => prev.map((r) => r.valid ? { ...r, include: next } : r));
                          }}
                          aria-label="Tout sélectionner"
                        />
                      </th>
                      <th>Nom</th>
                      <th>Poste</th>
                      <th>Département</th>
                      <th>Téléphone</th>
                      <th>Email</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className={r.valid ? '' : 'csv-row-invalid'}>
                        <td>
                          <input
                            type="checkbox"
                            checked={r.include && r.valid}
                            disabled={!r.valid}
                            onChange={() => toggleInclude(idx)}
                          />
                        </td>
                        <td style={{ fontWeight: 600 }}>{r.name || <span style={{ color: C.red }}>—</span>}</td>
                        <td>{r.role || <span style={{ color: C.inkLight }}>—</span>}</td>
                        <td>{r.department || <span style={{ color: C.inkLight }}>—</span>}</td>
                        <td className="mono-font" style={{ fontSize: 11 }}>{r.phone || <span style={{ color: C.inkLight }}>—</span>}</td>
                        <td style={{ fontSize: 11 }}>{r.email || <span style={{ color: C.inkLight }}>—</span>}</td>
                        <td>
                          {r.valid ? (
                            <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep }}>
                              ✓ Valide
                            </span>
                          ) : (
                            <span className="pill" style={{ background: `${C.red}15`, color: C.red }}>
                              <AlertTriangle size={11} /> {r.reason || 'Invalide'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setParsedRows([]); setFileName(''); setStep('upload'); }}
                  disabled={submitting}
                >
                  <ArrowLeft size={14} /> Retour
                </button>
                <button
                  type="button"
                  className="btn-purple"
                  onClick={handleImport}
                  disabled={toImport === 0 || submitting}
                >
                  {submitting
                    ? <><Loader2 size={14} className="spin" /> Import en cours…</>
                    : <><Upload size={14} /> Importer {toImport} employé{toImport > 1 ? 's' : ''}</>
                  }
                </button>
              </div>
            </>
          )}

          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', marginBottom: 16,
                boxShadow: `0 16px 32px -12px ${C.emerald}80`,
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {result.created} employé{result.created > 1 ? 's' : ''} ajouté{result.created > 1 ? 's' : ''} !
              </h3>
              <p style={{ margin: '8px 0 18px', fontSize: 13, color: C.inkSoft }}>
                {result.created === result.total
                  ? 'Tout est passé sans accroc.'
                  : `${result.created} sur ${result.total} lignes traitées avec succès.`}
              </p>

              {result.failed.length > 0 && (
                <div style={{
                  textAlign: 'left',
                  background: `${C.red}10`, border: `1px solid ${C.red}30`,
                  borderRadius: 12, padding: '12px 14px',
                  marginBottom: 16,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <AlertTriangle size={13} /> {result.failed.length} échec{result.failed.length > 1 ? 's' : ''}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 160, overflowY: 'auto' }}>
                    {result.failed.map((f, i) => (
                      <li key={i} style={{ fontSize: 12, color: C.ink, padding: '4px 0', borderBottom: i === result.failed.length - 1 ? 'none' : '1px solid rgba(10,42,32,0.06)' }}>
                        <strong>Ligne {f.row}</strong>{f.name ? ` : ${f.name}` : ''} <span style={{ color: C.inkSoft }}>— {f.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="btn-purple"
                onClick={() => { onImported(); onClose(); }}
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bulk ZIP enrollment modal ─────────────────────────────────────────────
//
// Workflow:
//   upload   → drop .zip (≤100 MB, ≤100 photos)
//   preview  → fuzzy-match each filename against employees[].name (exact/approx/none)
//              user can reassign matches via per-row dropdown
//   progress → sequential face-api descriptor extraction + POST /faces/employees/:id/enroll
//   done     → success count + failure list
const MAX_ZIP_BYTES   = 100 * 1024 * 1024;
const MAX_ZIP_PHOTOS  = 100;
const IGNORE_VALUE    = '__ignore__';

interface BulkPhoto {
  filename: string;
  baseName: string;          // filename without extension
  blob: Blob;
  mimeType: string;
  previewURL: string;
  matchedEmployeeId: string; // '' = no match yet, IGNORE_VALUE = explicitly ignored
  matchLevel: 'exact' | 'approx' | 'none';
  include: boolean;
}

interface BulkFailure {
  filename: string;
  employeeName: string;
  reason: string;
}

// Strip accents, lowercase, remove all whitespace — for fuzzy filename matching.
function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Levenshtein distance — small, no deps. Used only on short strings.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const v0: number[] = new Array(b.length + 1);
  const v1: number[] = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

function fuzzyMatch(
  baseName: string,
  employees: Employee[],
): { id: string; level: 'exact' | 'approx' | 'none' } {
  const target = normalizeForMatch(baseName);
  if (!target) return { id: '', level: 'none' };

  // Pass 1 — exact normalized match.
  for (const e of employees) {
    if (normalizeForMatch(e.name) === target) return { id: e.id, level: 'exact' };
  }
  // Pass 2 — substring (either way) OR levenshtein ≤ 3.
  let bestId = '';
  let bestDist = Infinity;
  for (const e of employees) {
    const n = normalizeForMatch(e.name);
    if (!n) continue;
    if (n.includes(target) || target.includes(n)) {
      return { id: e.id, level: 'approx' };
    }
    const d = levenshtein(n, target);
    if (d < bestDist) { bestDist = d; bestId = e.id; }
  }
  if (bestDist <= 3) return { id: bestId, level: 'approx' };
  return { id: '', level: 'none' };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      // Strip the "data:image/...;base64," prefix; server also tolerates it.
      resolve(dataUrl.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image failed to decode'));
    };
    img.src = url;
  });
}

function BulkEnrollModal({ employees, onClose, onEnrolled }: {
  employees: Employee[];
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'progress' | 'done'>('upload');
  const [photos, setPhotos] = useState<BulkPhoto[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [failed, setFailed] = useState<BulkFailure[]>([]);
  const [zipName, setZipName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    // Revoke any object URLs to prevent leaks.
    photos.forEach((p) => URL.revokeObjectURL(p.previewURL));
    onClose();
  };

  const handleZip = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Format invalide', 'Sélectionne un fichier .zip.');
      return;
    }
    if (file.size > MAX_ZIP_BYTES) {
      toast.error('Fichier trop volumineux', 'Limite: 100 MB par batch.');
      return;
    }
    setZipName(file.name);
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      toast.error('Lecture impossible', 'Le .zip n\'a pas pu être ouvert.');
      return;
    }

    const entries = Object.values(zip.files).filter((f) => {
      if (f.dir) return false;
      const lower = f.name.toLowerCase();
      // Skip macOS resource forks & hidden files.
      if (lower.startsWith('__macosx/') || lower.split('/').pop()?.startsWith('.')) return false;
      return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
    });

    if (entries.length === 0) {
      toast.error('Aucune photo trouvée', 'Le .zip doit contenir des .jpg/.jpeg/.png.');
      return;
    }
    if (entries.length > MAX_ZIP_PHOTOS) {
      toast.error('Trop de photos', `Limite: ${MAX_ZIP_PHOTOS} par batch.`);
      return;
    }

    const skipped: string[] = [];
    const built: BulkPhoto[] = [];
    for (const entry of entries) {
      try {
        const blob = await entry.async('blob');
        const filename = entry.name.split('/').pop() ?? entry.name;
        const baseName = filename.replace(/\.[^.]+$/, '');
        const mimeType = detectMimeFromName(filename);
        const previewURL = URL.createObjectURL(blob);
        const { id, level } = fuzzyMatch(baseName, employees);
        built.push({
          filename,
          baseName,
          blob,
          mimeType,
          previewURL,
          matchedEmployeeId: id,
          matchLevel: level,
          include: level !== 'none',
        });
      } catch {
        skipped.push(entry.name);
      }
    }

    if (skipped.length > 0) {
      toast.error(`${skipped.length} photo(s) ignorée(s)`, 'Fichiers illisibles dans le .zip.');
    }
    if (built.length === 0) {
      toast.error('Aucune photo exploitable', 'Toutes les photos étaient illisibles.');
      return;
    }
    setPhotos(built);
    setStep('preview');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleZip(f);
  };

  const totalDetected = photos.length;
  const totalMatched = photos.filter((p) => p.matchedEmployeeId && p.matchedEmployeeId !== IGNORE_VALUE).length;
  const totalIgnored = totalDetected - totalMatched;
  const toProcess = photos.filter((p) => p.include && p.matchedEmployeeId && p.matchedEmployeeId !== IGNORE_VALUE);

  const setRowEmployee = (idx: number, value: string) => {
    setPhotos((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      const newId = value;
      const ignored = newId === IGNORE_VALUE || newId === '';
      return {
        ...p,
        matchedEmployeeId: newId,
        // Re-derive level when user picks manually.
        matchLevel: ignored ? 'none' : 'approx',
        include: ignored ? false : p.include,
      };
    }));
  };

  const setRowInclude = (idx: number, include: boolean) => {
    setPhotos((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      if (!p.matchedEmployeeId || p.matchedEmployeeId === IGNORE_VALUE) return { ...p, include: false };
      return { ...p, include };
    }));
  };

  const handleEnrollAll = async () => {
    if (toProcess.length === 0) return;
    setProcessing(true);
    setStep('progress');
    setProgressCurrent(0);
    setProgressTotal(toProcess.length);
    setEnrolledCount(0);
    setFailed([]);

    try {
      await loadFaceApiModels();
    } catch {
      toast.error('Modèles indisponibles', 'Impossible de charger face-api. Vérifie ta connexion.');
      setProcessing(false);
      setStep('preview');
      return;
    }

    let okCount = 0;
    const failures: BulkFailure[] = [];

    // Sequential — face-api is heavy, parallel runs OOM the browser.
    for (let i = 0; i < toProcess.length; i++) {
      const row = toProcess[i];
      const emp = employees.find((e) => e.id === row.matchedEmployeeId);
      const employeeName = emp?.name ?? row.baseName;

      try {
        const img = await loadImageFromBlob(row.blob);
        const descriptor = await detectFaceDescriptor(img);
        if (!descriptor) {
          failures.push({ filename: row.filename, employeeName, reason: 'Aucun visage détecté' });
        } else {
          const photoBase64 = await blobToBase64(row.blob);
          await api.post(`/faces/employees/${row.matchedEmployeeId}/enroll`, {
            photoBase64,
            faceDescriptor: Array.from(descriptor),
            photoMimeType: row.mimeType,
          });
          okCount += 1;
        }
      } catch (err: any) {
        failures.push({
          filename: row.filename,
          employeeName,
          reason: err?.response?.data?.message ?? err?.message ?? 'Erreur inconnue',
        });
      }
      setProgressCurrent(i + 1);
      setEnrolledCount(okCount);
      setFailed([...failures]);
    }

    setProcessing(false);
    setStep('done');
  };

  return (
    <div onClick={processing ? undefined : handleClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,42,32,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <style>{`
        .zip-dropzone { width:100%; padding:36px 18px; border-radius:14px; background:${C.creamDeep}; color:${C.purpleDeep}; border:2px dashed ${C.purple}; cursor:pointer; font-family:inherit; display:flex; flex-direction:column; align-items:center; gap:10px; transition:background .15s ease, border-color .15s ease, transform .15s ease; }
        .zip-dropzone:hover { background:${C.purpleSoft}; border-color:${C.purpleDeep}; transform:translateY(-1px); }
        .zip-dropzone.dragging { background:${C.purpleSoft}; border-color:${C.purpleDeep}; box-shadow:0 0 0 4px ${C.purple}25; }
        .bulk-progress-ring { width:120px; height:120px; border-radius:50%; background:conic-gradient(${C.purple} var(--p), ${C.purpleSoft} 0); display:flex; align-items:center; justify-content:center; transition:background .25s ease; }
        .bulk-progress-ring-inner { width:96px; height:96px; border-radius:50%; background:${C.cream}; display:flex; align-items:center; justify-content:center; flex-direction:column; }
      `}</style>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22,
        maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleDeep})`,
          color: '#fff', padding: '22px 24px',
          borderRadius: '22px 22px 0 0', position: 'relative',
        }}>
          {!processing && (
            <button onClick={handleClose} aria-label="Fermer" style={{
              position: 'absolute', top: 14, right: 14,
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={15} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
                Enrôlement en masse
              </div>
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                Enrôlement <em style={{ fontStyle: 'italic', fontWeight: 500 }}>en masse</em>
              </h3>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.9 }}>
            Uploade un .zip avec des photos nommées par employé (ex: "Awa Diallo.jpg").
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          {step === 'upload' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleZip(f);
                }}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={`zip-dropzone ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <Package size={32} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Glisse un .zip ici ou clique pour choisir
                </span>
                <span style={{ fontSize: 11, color: C.inkSoft }}>
                  Photos nommées par employé · max 100 photos · max 100 MB
                </span>
              </button>

              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 12,
                background: C.purpleSoft, color: C.purpleDeep,
                fontSize: 12, lineHeight: 1.55,
              }}>
                <strong style={{ display: 'block', fontWeight: 700, marginBottom: 4 }}>
                  Convention de nommage
                </strong>
                Nomme chaque photo avec le nom de l'employé tel qu'il apparaît dans l'annuaire.
                Les accents, majuscules et espaces sont tolérés (ex: "Awa Diallo.jpg", "awa-diallo.png").
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div style={{
                padding: '12px 16px', borderRadius: 12,
                background: C.purpleSoft, color: C.purpleDeep,
                marginBottom: 14, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                <Package size={16} />
                <span>
                  <strong>{totalDetected}</strong> photo{totalDetected > 1 ? 's' : ''} détectée{totalDetected > 1 ? 's' : ''}
                  {' · '}
                  <span style={{ color: C.emeraldDeep }}>{totalMatched} matchée{totalMatched > 1 ? 's' : ''}</span>
                  {' · '}
                  <span style={{ color: C.red }}>{totalIgnored} à ignorer</span>
                </span>
                {zipName && (
                  <span className="mono-font" style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>
                    {zipName}
                  </span>
                )}
              </div>

              <div style={{
                maxHeight: 320, overflowY: 'auto',
                border: '1px solid rgba(10,42,32,0.08)',
                borderRadius: 12, background: '#fff',
              }}>
                <table className="csv-table">
                  <thead>
                    <tr>
                      <th style={{ width: 38 }}>OK</th>
                      <th style={{ width: 76 }}>Photo</th>
                      <th>Fichier</th>
                      <th>Employé matché</th>
                      <th style={{ width: 110 }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {photos.map((p, idx) => {
                      const ignored = !p.matchedEmployeeId || p.matchedEmployeeId === IGNORE_VALUE;
                      const includeDisabled = ignored;
                      const statusPill =
                        p.matchLevel === 'exact'
                          ? { bg: C.emeraldSoft, fg: C.emeraldDeep, label: '✓ Exact' }
                          : p.matchLevel === 'approx' && !ignored
                          ? { bg: '#FEF3C7', fg: '#92400E', label: '⚠ Approx.' }
                          : { bg: `${C.red}15`, fg: C.red, label: '✗ Aucun' };
                      return (
                        <tr key={idx}>
                          <td>
                            <input
                              type="checkbox"
                              checked={p.include && !ignored}
                              disabled={includeDisabled}
                              onChange={(e) => setRowInclude(idx, e.target.checked)}
                            />
                          </td>
                          <td>
                            <img
                              src={p.previewURL}
                              alt={p.filename}
                              style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', display: 'block' }}
                            />
                          </td>
                          <td style={{ fontSize: 12, wordBreak: 'break-all' }}>{p.filename}</td>
                          <td>
                            <select
                              value={p.matchedEmployeeId || ''}
                              onChange={(e) => setRowEmployee(idx, e.target.value)}
                              style={{
                                padding: '6px 10px', borderRadius: 8,
                                border: '1px solid rgba(10,42,32,0.12)', background: '#fff',
                                fontSize: 12, fontFamily: 'inherit', maxWidth: 220, width: '100%',
                              }}
                            >
                              <option value="">— Choisir —</option>
                              {employees.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                              <option value={IGNORE_VALUE}>Ignorer</option>
                            </select>
                          </td>
                          <td>
                            <span className="pill" style={{ background: statusPill.bg, color: statusPill.fg }}>
                              {statusPill.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    photos.forEach((p) => URL.revokeObjectURL(p.previewURL));
                    setPhotos([]); setZipName(''); setStep('upload');
                  }}
                >
                  <ArrowLeft size={14} /> Retour
                </button>
                <button
                  type="button"
                  className="btn-purple"
                  onClick={handleEnrollAll}
                  disabled={toProcess.length === 0}
                >
                  <ScanFace size={14} /> Enrôler {toProcess.length} photo{toProcess.length > 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}

          {step === 'progress' && (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <div
                className="bulk-progress-ring"
                style={{
                  margin: '0 auto 18px',
                  // @ts-ignore — CSS custom prop
                  ['--p' as any]: `${progressTotal > 0 ? (progressCurrent / progressTotal) * 360 : 0}deg`,
                }}
              >
                <div className="bulk-progress-ring-inner">
                  <div className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.purpleDeep, lineHeight: 1 }}>
                    {progressCurrent}<span style={{ color: C.inkLight, fontSize: 16, fontWeight: 500 }}>/{progressTotal}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Enrôlement
                  </div>
                </div>
              </div>

              <div style={{
                height: 8, borderRadius: 100, background: C.purpleSoft,
                overflow: 'hidden', marginBottom: 14,
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0}%`,
                  background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
                  transition: 'width .25s ease',
                }} />
              </div>

              <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
                <Loader2 size={13} className="spin" style={{ verticalAlign: 'middle', marginRight: 6, color: C.purple }} />
                Détection des visages et enrôlement en cours… Ne ferme pas cette fenêtre.
              </p>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', marginBottom: 16,
                boxShadow: `0 16px 32px -12px ${C.emerald}80`,
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {enrolledCount} visage{enrolledCount > 1 ? 's' : ''} enrôlé{enrolledCount > 1 ? 's' : ''} !
              </h3>
              <p style={{ margin: '8px 0 18px', fontSize: 13, color: C.inkSoft }}>
                {failed.length === 0
                  ? 'Tout est passé sans accroc.'
                  : `${enrolledCount} sur ${progressTotal} photo${progressTotal > 1 ? 's' : ''} traitée${progressTotal > 1 ? 's' : ''} avec succès.`}
              </p>

              {failed.length > 0 && (
                <div style={{
                  textAlign: 'left',
                  background: `${C.red}10`, border: `1px solid ${C.red}30`,
                  borderRadius: 12, padding: '12px 14px',
                  marginBottom: 16,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <AlertTriangle size={13} /> {failed.length} échec{failed.length > 1 ? 's' : ''}
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 160, overflowY: 'auto' }}>
                    {failed.map((f, i) => (
                      <li key={i} style={{
                        fontSize: 12, color: C.ink, padding: '4px 0',
                        borderBottom: i === failed.length - 1 ? 'none' : '1px solid rgba(10,42,32,0.06)',
                      }}>
                        <strong>{f.filename}</strong>
                        {f.employeeName ? ` → ${f.employeeName}` : ''}
                        <span style={{ color: C.inkSoft }}> — {f.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="btn-purple"
                onClick={() => { onEnrolled(); handleClose(); }}
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
