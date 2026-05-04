/**
 * PDF Report generation utilities
 * Uses jsPDF + autoTable for clean professional reports
 * Branding: uses tenant company info (logo, name, address, phone, email, taxId).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuthStore } from '@/store/authStore';

const BRAND_COLOR: [number, number, number] = [124, 58, 237]; // violet-600
const GRAY: [number, number, number] = [107, 114, 128];
const DARK: [number, number, number] = [17, 24, 39];

export interface PdfBranding {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  legalForm?: string;
}

/** Reads tenant company branding from authStore. Call from outside component context. */
function getBranding(companyNameFallback: string): PdfBranding {
  const c = useAuthStore.getState().company as unknown as PdfBranding | null;
  return {
    name: c?.name ?? companyNameFallback,
    logoUrl: c?.logoUrl,
    address: c?.address,
    phone: c?.phone,
    email: c?.email,
    taxId: c?.taxId,
    legalForm: c?.legalForm,
  };
}

async function addHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  companyNameFallback: string,
  landscape = false,
) {
  const b = getBranding(companyNameFallback);
  const W = landscape ? 297 : 210;

  // Brand band — 40mm tall
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, W, 40, 'F');

  // Logo or initials (left)
  let logoLoaded = false;
  if (b.logoUrl) {
    try {
      const blob = await fetch(b.logoUrl).then(r => r.blob());
      const b64 = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); });
      doc.addImage(b64, 'PNG', 12, 8, 24, 24);
      logoLoaded = true;
    } catch { /* fall through to initials */ }
  }
  if (!logoLoaded) {
    doc.setFillColor(255, 255, 255);
    doc.circle(24, 20, 12, 'F');
    doc.setTextColor(124, 58, 237);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(b.name.slice(0, 2).toUpperCase(), 24, 22, { align: 'center' });
  }

  // Company name + contact
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(b.name, 42, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (b.legalForm) doc.text(b.legalForm, 42, 19);
  if (b.address) doc.text(b.address, 42, 24);
  const contact = [b.phone, b.email].filter(Boolean).join('  ·  ');
  if (contact) doc.text(contact, 42, 29);

  // Right side — title + subtitle
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), W - 12, 12, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(subtitle, W - 12, 20, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('fr-FR'), W - 12, 26, { align: 'right' });

  // Reset
  doc.setTextColor(...DARK);
}

function addFooter(doc: jsPDF, companyNameFallback: string, landscape = false) {
  const b = getBranding(companyNameFallback);
  const pages = doc.getNumberOfPages();
  const W = landscape ? 297 : 210;
  const H = landscape ? 210 : 297;
  const legal = [b.name, b.address, b.taxId ? `N° ${b.taxId}` : null].filter(Boolean).join(' · ');

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(12, H - 16, W - 12, H - 16);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(legal, 12, H - 10);
    doc.text(`Page ${i}/${pages}  ·  Powered by Orlode`, W - 12, H - 10, { align: 'right' });
  }
}

// ── Presence Report ──────────────────────────────────────────────────────────

interface PresenceRecord {
  employeeName: string;
  employeeEmail: string;
  department: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  hoursWorked?: number;
  status: string;
}

export async function generatePresenceReport(
  records: PresenceRecord[],
  companyName: string,
  dateRange: string,
) {
  const doc = new jsPDF();
  await addHeader(doc, 'Rapport de Présence', dateRange, companyName);

  // Stats summary
  const totalDays = records.length;
  const totalHours = records.reduce((sum, r) => sum + (r.hoursWorked ?? 0), 0);
  const uniqueEmployees = new Set(records.map(r => r.employeeName)).size;
  const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(1) : '0';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Résumé', 14, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const stats = [
    `Employés: ${uniqueEmployees}`,
    `Pointages: ${totalDays}`,
    `Heures totales: ${totalHours.toFixed(1)}h`,
    `Moyenne/jour: ${avgHours}h`,
  ];
  doc.text(stats.join('  |  '), 14, 56);

  autoTable(doc, {
    startY: 64,
    head: [['Employé', 'Département', 'Date', 'Arrivée', 'Départ', 'Heures', 'Statut']],
    body: records.map(r => [
      r.employeeName,
      r.department || '—',
      new Date(r.date).toLocaleDateString('fr-FR'),
      r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.hoursWorked ? `${r.hoursWorked}h` : '—',
      r.status === 'present' ? 'Présent' : 'Parti',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
  });

  addFooter(doc, companyName);
  doc.save(`presence-${dateRange.replace(/\s/g, '_')}.pdf`);
}

// ── Leave Report ─────────────────────────────────────────────────────────────

interface LeaveRecord {
  employeeName: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: string;
  reason: string;
}

const TYPE_LABELS: Record<string, string> = {
  annual: 'Conge annuel', sick: 'Maladie', rtt: 'RTT', special: 'Special',
};

export async function generateLeaveReport(
  records: LeaveRecord[],
  companyName: string,
  dateRange: string,
) {
  const doc = new jsPDF();
  await addHeader(doc, 'Rapport des Congés', dateRange, companyName);

  const totalDays = records.reduce((sum, r) => sum + r.days, 0);
  const approved = records.filter(r => r.status === 'approved').length;
  const pending = records.filter(r => r.status === 'pending').length;
  const rejected = records.filter(r => r.status === 'rejected').length;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Résumé', 14, 50);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Total: ${records.length} demandes (${totalDays} jours)  |  Approuvés: ${approved}  |  En attente: ${pending}  |  Refusés: ${rejected}`, 14, 56);

  autoTable(doc, {
    startY: 64,
    head: [['Employé', 'Type', 'Du', 'Au', 'Jours', 'Statut', 'Motif']],
    body: records.map(r => [
      r.employeeName ?? '—',
      TYPE_LABELS[r.type] ?? r.type,
      new Date(r.from).toLocaleDateString('fr-FR'),
      new Date(r.to).toLocaleDateString('fr-FR'),
      String(r.days),
      r.status === 'approved' ? 'Approuvé' : r.status === 'rejected' ? 'Refusé' : 'En attente',
      r.reason || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
    columnStyles: { 6: { cellWidth: 40 } },
  });

  addFooter(doc, companyName);
  doc.save(`conges-${dateRange.replace(/\s/g, '_')}.pdf`);
}

// ── Visitor Report ───────────────────────────────────────────────────────────

interface VisitorRecord {
  name: string;
  company: string;
  host: string;
  purpose: string;
  type: string;
  checkInAt: string;
  checkOutAt?: string;
  status: string;
  badgeNumber: string;
}

export async function generateVisitorReport(
  records: VisitorRecord[],
  companyName: string,
  dateRange: string,
) {
  const doc = new jsPDF('landscape');
  await addHeader(doc, 'Rapport des Visiteurs', dateRange, companyName, true);

  const present = records.filter(r => r.status === 'checked_in').length;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Total: ${records.length} visiteurs  |  Présents: ${present}  |  Partis: ${records.length - present}`, 14, 50);

  autoTable(doc, {
    startY: 57,
    head: [['Visiteur', 'Entreprise', 'Hôte', 'Type', 'Motif', 'Arrivée', 'Départ', 'Badge']],
    body: records.map(r => [
      r.name,
      r.company || '—',
      r.host,
      r.type === 'vip' ? 'VIP' : r.type === 'delivery' ? 'Livraison' : r.type === 'appointment' ? 'RDV' : 'Sans RDV',
      r.purpose || '—',
      r.checkInAt ? new Date(r.checkInAt).toLocaleString('fr-FR') : '—',
      r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.badgeNumber,
    ]),
    styles: { fontSize: 7, cellPadding: 2.5 },
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
  });

  addFooter(doc, companyName, true);
  doc.save(`visiteurs-${dateRange.replace(/\s/g, '_')}.pdf`);
}

// ── Employee Directory Report ────────────────────────────────────────────────

interface EmployeeRecord {
  name: string;
  email: string;
  department: string;
  title: string;
  role: string;
  phone: string;
}

export async function generateEmployeeReport(
  records: EmployeeRecord[],
  companyName: string,
) {
  const doc = new jsPDF();
  await addHeader(doc, 'Annuaire des Employés', new Date().toLocaleDateString('fr-FR'), companyName);

  const depts = new Set(records.map(r => r.department).filter(Boolean));
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`${records.length} employés  |  ${depts.size} départements`, 14, 50);

  autoTable(doc, {
    startY: 57,
    head: [['Nom', 'Email', 'Département', 'Poste', 'Rôle', 'Téléphone']],
    body: records.map(r => [
      r.name, r.email, r.department || '—', r.title || '—', r.role, r.phone || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
  });

  addFooter(doc, companyName);
  doc.save(`employes-${new Date().toISOString().split('T')[0]}.pdf`);
}
