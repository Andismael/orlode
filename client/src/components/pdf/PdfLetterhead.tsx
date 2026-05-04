/**
 * PdfLetterhead — Shared header/footer for all printable documents.
 * Pulls tenant company branding from authStore (logo, name, address, phone, email, tax info).
 * Use inside any print-friendly page to get a consistent branded PDF.
 *
 * Design rules:
 *   - Company logo + name + address left, document meta (title + number + date + status) right.
 *   - Footer: legal info (tax ID, address one-line) + tiny "Powered by Orlode".
 *   - `@media print` friendly: clean, high-contrast, A4-safe spacing.
 */
import React from 'react';
import { useAuthStore } from '@/store/authStore';

interface CompanyBranding {
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  legalForm?: string;
}

export function useCompanyBranding(): CompanyBranding {
  const { company } = useAuthStore();
  const c = company as unknown as CompanyBranding & { name: string };
  return {
    name: c?.name ?? 'Mon Entreprise',
    logoUrl: c?.logoUrl,
    address: c?.address,
    phone: c?.phone,
    email: c?.email,
    website: c?.website,
    taxId: c?.taxId,
    legalForm: c?.legalForm,
  };
}

interface HeaderProps {
  documentType: string;    // "Devis", "Facture", "Contrat", "Rapport"
  documentNumber?: string; // "#3542e0c6", "INV-2024-001"
  documentDate?: string;   // "21 avril 2026"
  status?: { label: string; color: string }; // optional colored pill
  /** Override company branding (used when rendering on behalf of a different tenant). */
  override?: Partial<CompanyBranding>;
}

export function PdfHeader({ documentType, documentNumber, documentDate, status, override }: HeaderProps) {
  const branding = useCompanyBranding();
  const b = { ...branding, ...override };
  const initials = b.name.slice(0, 2).toUpperCase();
  const date = documentDate ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="flex items-start justify-between pb-6 border-b-2 border-violet-600">
      <div className="flex items-start gap-4">
        {b.logoUrl ? (
          <img src={b.logoUrl} alt={b.name} className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
        ) : (
          <div className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)' }}>
            {initials}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{b.name}</h1>
          {b.legalForm && <p className="text-[11px] text-gray-500 mt-0.5">{b.legalForm}</p>}
          {b.address && <p className="text-xs text-gray-600 mt-1">{b.address}</p>}
          {b.phone && <p className="text-xs text-gray-600">📞 {b.phone}</p>}
          {b.email && <p className="text-xs text-gray-600">✉ {b.email}</p>}
          {b.website && <p className="text-xs text-violet-600">{b.website}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{documentType}</p>
        {documentNumber && <p className="text-2xl font-bold text-violet-600 mt-1">{documentNumber}</p>}
        <p className="text-xs text-gray-500 mt-1">{date}</p>
        {status && (
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white"
            style={{ background: status.color }}>
            {status.label}
          </span>
        )}
      </div>
    </div>
  );
}

interface FooterProps {
  override?: Partial<CompanyBranding>;
  /** Page number / total for multi-page docs. */
  page?: { current: number; total: number };
  /** Hide the "Powered by Orlode" mention. */
  hideOrlode?: boolean;
  /** Custom legal note to display before the branding line. */
  legalNote?: string;
}

export function PdfFooter({ override, page, hideOrlode, legalNote }: FooterProps) {
  const branding = useCompanyBranding();
  const b = { ...branding, ...override };
  const legalLine = [b.name, b.address, b.taxId ? `N° ${b.taxId}` : null].filter(Boolean).join(' · ');

  return (
    <div className="pt-6 border-t border-gray-200">
      {legalNote && <p className="text-[10px] text-gray-500 italic mb-2">{legalNote}</p>}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <p className="truncate">{legalLine}</p>
        <div className="flex items-center gap-3 flex-shrink-0">
          {page && <span>Page {page.current} / {page.total}</span>}
          {!hideOrlode && (
            <span className="flex items-center gap-1 opacity-60">
              <img src="/logo.png" alt="" className="w-3 h-3 rounded-sm" />
              Powered by <span className="font-semibold">Orlode</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Print-only CSS — drop this once per page that uses PdfHeader/PdfFooter.
 *  Hides everything except `.pdf-print-area` so the printout is ONLY the document.
 */
export function PdfPrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 15mm; }
        html, body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
          overflow: visible !important;
        }

        /* Hide every element that is NOT inside the print area, plus chrome */
        body > *:not(.pdf-print-area):not(:has(.pdf-print-area)) {
          display: none !important;
        }
        .pdf-noprint { display: none !important; }
        nav, aside, header.app-header, .sidebar, .top-bar { display: none !important; }

        /* Pull the modal/overlay backgrounds */
        .fixed,
        [class*="bg-black/"],
        [class*="backdrop-blur"] {
          position: static !important;
          background: white !important;
          backdrop-filter: none !important;
          inset: auto !important;
          padding: 0 !important;
        }

        /* The actual document fills the page */
        .pdf-print-area {
          position: relative !important;
          inset: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: none !important;
          max-height: none !important;
          overflow: visible !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          background: white !important;
        }

        .pdf-page-break { page-break-after: always; }
      }
    `}</style>
  );
}
