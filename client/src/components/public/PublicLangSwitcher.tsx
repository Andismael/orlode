/**
 * PublicLangSwitcher — small floating language picker for public pages
 * (shop, menu, hotel, residence, salon, cabinet, real estate).
 *
 * Why this exists: admin pages already have a switcher in the Header. The
 * public-facing storefront pages don't — a customer from Spain hitting a
 * Boutique link in French has no way to switch. This component fills that
 * gap, top-right corner, accessible and discreet.
 *
 * Auto-detection: useLangStore() already initializes from navigator.language
 * on first load (see store/langStore.ts). So a Spanish-speaking customer
 * hitting orlode.com/shop/x lands directly in ES if their browser is in ES.
 *
 * RTL: Arabic (ar) also sets <html dir="rtl"> globally — handled in the
 * store. The switcher itself stays in the same corner regardless.
 *
 * Shared inline `publicT()` helper exports the small set of public-page
 * strings that must be translated quickly without polluting the global dict.
 */
import { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLangStore, LANGUAGES, type LangCode } from '@/store/langStore';

/** Floating top-right language picker for public storefront pages. */
export function PublicLangSwitcher({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLangStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  // Colors adapt to whether the surrounding page hero is dark (most of them
  // are) or light. Sits over hero gradients without clashing.
  const bg = dark ? 'rgba(0,0,0,0.45)' : '#ffffff';
  const fg = dark ? '#ffffff' : '#0A2A20';
  const border = dark ? 'rgba(255,255,255,0.25)' : 'rgba(31,41,55,0.15)';

  return (
    <div ref={ref} style={{
      position: 'fixed', top: 'calc(14px + env(safe-area-inset-top))',
      right: 'calc(14px + env(safe-area-inset-right))', zIndex: 50,
      fontFamily: 'Inter, sans-serif',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Change language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', borderRadius: 999,
          background: bg, color: fg, border: `1px solid ${border}`,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          boxShadow: dark ? '0 4px 16px -6px rgba(0,0,0,0.4)' : '0 4px 14px -6px rgba(0,0,0,0.1)',
          fontFamily: 'inherit',
        }}>
        <Globe size={13} />
        <span style={{ fontSize: 14 }}>{current.flag}</span>
        <span>{lang.toUpperCase()}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 170, padding: 4,
          background: '#fff', border: `1px solid ${border}`,
          borderRadius: 12, boxShadow: '0 12px 32px -10px rgba(0,0,0,0.25)',
          color: '#0A2A20',
        }}>
          {LANGUAGES.map(l => {
            const active = l.code === lang;
            return (
              <button key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  background: active ? 'rgba(37,211,102,.12)' : 'transparent',
                  color: active ? '#128C7E' : '#0A2A20',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(31,41,55,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 16 }}>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared public-page translation dictionary ────────────────────────────
// Small, focused set of strings used across all public storefront pages.
// Page-specific strings stay inline in each page's component; this dict
// covers the universal labels (CTAs, status pills, footer, common nouns).
type PT = Record<string, Record<LangCode, string>>;

const PUBLIC_STRINGS: PT = {
  // ── CTAs / actions ────────────────────────────────────────────────
  'cta.order':       { fr: 'Commander',          en: 'Order',            es: 'Pedir',             ar: 'اطلب',          de: 'Bestellen',       pt: 'Pedir' },
  'cta.book':        { fr: 'Réserver',           en: 'Book',             es: 'Reservar',          ar: 'احجز',          de: 'Buchen',          pt: 'Reservar' },
  'cta.book_now':    { fr: 'Réserver maintenant',en: 'Book now',         es: 'Reservar ahora',    ar: 'احجز الآن',     de: 'Jetzt buchen',    pt: 'Reservar agora' },
  'cta.appointment': { fr: 'Prendre RDV',        en: 'Book appointment', es: 'Pedir cita',        ar: 'حجز موعد',      de: 'Termin buchen',   pt: 'Marcar' },
  'cta.contact':     { fr: 'Contacter',          en: 'Contact',          es: 'Contactar',         ar: 'اتصل',          de: 'Kontakt',         pt: 'Contactar' },
  'cta.visit':       { fr: 'Demander visite',    en: 'Request visit',    es: 'Pedir visita',      ar: 'طلب زيارة',     de: 'Besuch anfragen', pt: 'Pedir visita' },
  'cta.discover':    { fr: 'Découvrir',          en: 'Discover',         es: 'Descubrir',         ar: 'اكتشف',         de: 'Entdecken',       pt: 'Descobrir' },
  'cta.send_whatsapp': { fr: 'Envoyer WhatsApp', en: 'Send WhatsApp',    es: 'Enviar WhatsApp',   ar: 'إرسال واتساب',   de: 'WhatsApp senden', pt: 'Enviar WhatsApp' },
  'cta.call':        { fr: 'Appeler',            en: 'Call',             es: 'Llamar',            ar: 'اتصل',          de: 'Anrufen',         pt: 'Ligar' },

  // ── Generic status / fields ───────────────────────────────────────
  'available':       { fr: 'Disponible',         en: 'Available',        es: 'Disponible',        ar: 'متاح',          de: 'Verfügbar',       pt: 'Disponível' },
  'unavailable':     { fr: 'Indisponible',       en: 'Unavailable',      es: 'No disponible',     ar: 'غير متاح',      de: 'Nicht verfügbar', pt: 'Indisponível' },
  'loading':         { fr: 'Chargement…',        en: 'Loading…',         es: 'Cargando…',         ar: 'جارٍ التحميل…', de: 'Lädt…',           pt: 'Carregando…' },
  'no_results':      { fr: 'Aucun résultat',     en: 'No results',       es: 'Sin resultados',    ar: 'لا توجد نتائج', de: 'Keine Ergebnisse', pt: 'Sem resultados' },
  'not_found':       { fr: 'Page introuvable',   en: 'Page not found',   es: 'Página no encontrada', ar: 'الصفحة غير موجودة', de: 'Seite nicht gefunden', pt: 'Página não encontrada' },
  'open_now':        { fr: 'Ouvert maintenant',  en: 'Open now',         es: 'Abierto ahora',     ar: 'مفتوح الآن',    de: 'Jetzt geöffnet',  pt: 'Aberto agora' },
  'closed_now':      { fr: 'Fermé',              en: 'Closed',           es: 'Cerrado',           ar: 'مغلق',          de: 'Geschlossen',     pt: 'Fechado' },

  // ── Hero subtitles per pack ───────────────────────────────────────
  'hero.shop':       { fr: 'Boutique',           en: 'Store',            es: 'Tienda',            ar: 'متجر',          de: 'Shop',            pt: 'Loja' },
  'hero.menu':       { fr: 'Restaurant',         en: 'Restaurant',       es: 'Restaurante',       ar: 'مطعم',          de: 'Restaurant',      pt: 'Restaurante' },
  'hero.hotel':      { fr: 'Hôtel',              en: 'Hotel',            es: 'Hotel',             ar: 'فندق',          de: 'Hotel',           pt: 'Hotel' },
  'hero.residence':  { fr: 'Résidence',          en: 'Residence',        es: 'Residencia',        ar: 'إقامة',         de: 'Residenz',        pt: 'Residência' },
  'hero.salon':      { fr: 'Salon',              en: 'Salon',            es: 'Salón',             ar: 'صالون',         de: 'Salon',           pt: 'Salão' },
  'hero.cabinet':    { fr: 'Cabinet',            en: 'Office',           es: 'Consultorio',       ar: 'عيادة',         de: 'Kanzlei',         pt: 'Consultório' },
  'hero.real_estate':{ fr: 'Immobilier',         en: 'Real estate',      es: 'Inmobiliaria',      ar: 'العقارات',      de: 'Immobilien',      pt: 'Imobiliária' },

  // ── Catalog labels ────────────────────────────────────────────────
  'products':        { fr: 'produit(s)',         en: 'product(s)',       es: 'producto(s)',       ar: 'منتج(ات)',      de: 'Produkt(e)',      pt: 'produto(s)' },
  'dishes':          { fr: 'plat(s)',            en: 'dish(es)',         es: 'plato(s)',          ar: 'طبق/أطباق',     de: 'Gericht(e)',      pt: 'prato(s)' },
  'rooms':           { fr: 'chambre(s)',         en: 'room(s)',          es: 'habitación(es)',    ar: 'غرف(ة)',        de: 'Zimmer',          pt: 'quarto(s)' },
  'services':        { fr: 'service(s)',         en: 'service(s)',       es: 'servicio(s)',       ar: 'خدمة/خدمات',    de: 'Service(s)',      pt: 'serviço(s)' },
  'properties':      { fr: 'bien(s)',            en: 'propert(y/ies)',   es: 'propiedad(es)',     ar: 'عقار(ات)',      de: 'Objekt(e)',       pt: 'imóvel(eis)' },
  'practitioners':   { fr: 'praticien(s)',       en: 'practitioner(s)',  es: 'profesional(es)',   ar: 'مختص(ون)',      de: 'Fachperson(en)',  pt: 'profissional(is)' },

  // ── Footer / branding ─────────────────────────────────────────────
  'powered_by':      { fr: 'Propulsé par Orlode AI', en: 'Powered by Orlode AI', es: 'Hecho con Orlode AI', ar: 'مدعوم بواسطة Orlode AI', de: 'Mit Orlode AI', pt: 'Com Orlode AI' },
  'whatsapp_book':   { fr: 'Réservation WhatsApp',  en: 'WhatsApp booking',     es: 'Reserva por WhatsApp', ar: 'حجز عبر واتساب', de: 'WhatsApp-Buchung', pt: 'Reserva via WhatsApp' },
  'fast_confirm':    { fr: 'Confirmation rapide',   en: 'Fast confirmation',    es: 'Confirmación rápida',  ar: 'تأكيد سريع',     de: 'Schnelle Bestätigung', pt: 'Confirmação rápida' },

  // ── Reservation form bits ─────────────────────────────────────────
  'your_name':       { fr: 'Votre nom',          en: 'Your name',        es: 'Tu nombre',         ar: 'اسمك',          de: 'Ihr Name',        pt: 'Seu nome' },
  'your_phone':      { fr: 'Téléphone',          en: 'Phone',            es: 'Teléfono',          ar: 'هاتف',          de: 'Telefon',         pt: 'Telefone' },
  'date':            { fr: 'Date',               en: 'Date',             es: 'Fecha',             ar: 'التاريخ',       de: 'Datum',           pt: 'Data' },
  'time':            { fr: 'Heure',              en: 'Time',             es: 'Hora',              ar: 'الوقت',         de: 'Uhrzeit',         pt: 'Hora' },
  'guests':          { fr: 'Personnes',          en: 'Guests',           es: 'Personas',          ar: 'الأشخاص',       de: 'Personen',        pt: 'Pessoas' },
  'notes':           { fr: 'Note (optionnel)',   en: 'Note (optional)',  es: 'Nota (opcional)',   ar: 'ملاحظة (اختياري)', de: 'Notiz (optional)', pt: 'Nota (opcional)' },

  // ── Empty states ──────────────────────────────────────────────────
  'empty.products':  { fr: 'Pas encore de produit.', en: 'No products yet.', es: 'Aún no hay productos.', ar: 'لا توجد منتجات بعد.', de: 'Noch keine Produkte.', pt: 'Ainda sem produtos.' },
  'empty.dishes':    { fr: 'Pas encore de plat.',    en: 'No dishes yet.',   es: 'Aún no hay platos.',    ar: 'لا توجد أطباق بعد.',  de: 'Noch keine Gerichte.', pt: 'Ainda sem pratos.' },
  'empty.rooms':     { fr: 'Pas de chambre disponible.', en: 'No available rooms.', es: 'Sin habitaciones.', ar: 'لا توجد غرف.',   de: 'Keine verfügbaren Zimmer.', pt: 'Sem quartos disponíveis.' },
  'empty.services':  { fr: 'Pas encore de service.', en: 'No services yet.', es: 'Aún no hay servicios.', ar: 'لا توجد خدمات بعد.', de: 'Noch keine Services.', pt: 'Ainda sem serviços.' },
};

/** Lookup helper — use in public pages as `publicT('cta.order', lang)`. */
export function publicT(key: string, lang: LangCode): string {
  const entry = PUBLIC_STRINGS[key];
  if (!entry) return key;
  return entry[lang] ?? entry['en'] ?? entry['fr'] ?? key;
}

/** Convenience hook bundling lang + helper. */
export function usePublicT() {
  const lang = useLangStore(s => s.lang);
  return { lang, t: (key: string) => publicT(key, lang) };
}
