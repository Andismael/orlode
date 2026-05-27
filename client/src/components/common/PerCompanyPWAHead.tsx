/**
 * PerCompanyPWAHead — swaps the page's manifest + apple-touch meta tags
 * to a per-company manifest so installing the PWA registers the business
 * (its name + logo) as the app on the user's home screen, instead of the
 * generic "Orlode" PWA.
 *
 * Drop into any public per-company page (CloneChatPage, PublicShopPage,
 * PublicMenuPage, etc.). On unmount, restores the original Orlode manifest.
 *
 * Also renders an install banner (<InstallPWAPrompt/>) at the bottom of
 * the page so users see a clear path to install. The banner detects:
 *   - beforeinstallprompt → Chrome/Edge/Android native install
 *   - iOS Safari → falls back to "Partage → Sur l'écran d'accueil" instructions
 */
import React, { useEffect, useState } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';

interface Props {
  companyId: string;
  companyName: string;
  /** Square PWA logo (≥512×512 PNG). Falls back to logoUrl in the manifest endpoint. */
  logoUrl?: string;
  /** Hex color for browser chrome + install banner accent. Default Orlode green. */
  primaryColor?: string;
  /** Whether to render the install banner (default: true). */
  showInstallBanner?: boolean;
}

/** Set or replace a tag with `[selector]` in document.head. */
function setOrReplace(selector: string, tag: HTMLElement) {
  const existing = document.head.querySelector(selector);
  if (existing) existing.replaceWith(tag);
  else document.head.appendChild(tag);
}

export default function PerCompanyPWAHead({
  companyId, companyName, logoUrl, primaryColor = '#0F5C3F', showInstallBanner = true,
}: Props) {
  useEffect(() => {
    if (!companyId) return;

    // Capture the current path so the manifest's start_url reflects where
    // the user installed from (clone chat, shop, menu, etc.).
    const from = window.location.pathname;
    const params = new URLSearchParams({ from });
    // Pass overrides for slug-based pages where the manifest endpoint
    // can't find a companies/{id} doc (e.g. PublicShopPage / PublicMenuPage
    // are keyed by their own resource ID).
    if (companyName) params.set('name', companyName);
    if (logoUrl)     params.set('logo', logoUrl);
    if (primaryColor) params.set('color', primaryColor);
    const manifestUrl = `/api/manifest/${encodeURIComponent(companyId)}.json?${params.toString()}`;

    // 1. Swap the <link rel="manifest"> — Android/Chrome/Edge install signal
    const prevManifest = document.head.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null;
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestUrl;
    setOrReplace('link[rel="manifest"]', manifestLink);

    // 2. apple-touch-icon — iOS uses this for "Add to Home Screen"
    let prevAppleIcon: string | null = null;
    if (logoUrl) {
      prevAppleIcon = document.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? null;
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = logoUrl;
      setOrReplace('link[rel="apple-touch-icon"]', appleIcon);
    }

    // 3. apple-mobile-web-app-title — name on the iOS home screen
    const prevAppleTitle = document.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') ?? null;
    const appleTitle = document.createElement('meta');
    appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
    appleTitle.setAttribute('content', companyName);
    setOrReplace('meta[name="apple-mobile-web-app-title"]', appleTitle);

    // 4. theme-color — browser chrome tint (Android Chrome address bar, etc.)
    const prevThemeColor = document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
    const themeColor = document.createElement('meta');
    themeColor.setAttribute('name', 'theme-color');
    themeColor.setAttribute('content', primaryColor);
    setOrReplace('meta[name="theme-color"]', themeColor);

    // 5. document title — falls into the install banner text on some browsers
    const prevTitle = document.title;
    document.title = companyName;

    // 6. apple-mobile-web-app-capable — makes iOS render in standalone mode
    if (!document.head.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const cap = document.createElement('meta');
      cap.setAttribute('name', 'apple-mobile-web-app-capable');
      cap.setAttribute('content', 'yes');
      document.head.appendChild(cap);
    }

    // 7. apple-mobile-web-app-status-bar-style — premium translucent status
    //    bar so the company's theme_color tint extends to the very top.
    if (!document.head.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const s = document.createElement('meta');
      s.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      s.setAttribute('content', 'black-translucent');
      document.head.appendChild(s);
    }

    return () => {
      // Restore Orlode defaults on unmount so navigating away from a
      // company page doesn't leave its meta tags polluting the SPA.
      if (prevManifest) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = prevManifest;
        setOrReplace('link[rel="manifest"]', link);
      }
      if (prevAppleIcon !== null) {
        const link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.href = prevAppleIcon;
        setOrReplace('link[rel="apple-touch-icon"]', link);
      }
      if (prevAppleTitle !== null) {
        const m = document.createElement('meta');
        m.setAttribute('name', 'apple-mobile-web-app-title');
        m.setAttribute('content', prevAppleTitle);
        setOrReplace('meta[name="apple-mobile-web-app-title"]', m);
      }
      if (prevThemeColor !== null) {
        const m = document.createElement('meta');
        m.setAttribute('name', 'theme-color');
        m.setAttribute('content', prevThemeColor);
        setOrReplace('meta[name="theme-color"]', m);
      }
      document.title = prevTitle;
    };
  }, [companyId, companyName, logoUrl, primaryColor]);

  if (!showInstallBanner) return null;

  return <InstallPWAPrompt companyName={companyName} logoUrl={logoUrl} primaryColor={primaryColor} />;
}

// ─── Install Banner ────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPad on iOS 13+ identifies as Macintosh — check touchpoints to disambiguate.
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari uses navigator.standalone; everyone else uses the media query.
  type WinWithStandalone = Window & { navigator: Navigator & { standalone?: boolean } };
  return window.matchMedia('(display-mode: standalone)').matches
    || (window as WinWithStandalone).navigator.standalone === true;
}

function InstallPWAPrompt({
  companyName, logoUrl, primaryColor,
}: {
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    const dismissKey = `pwa-dismissed-${companyName}`;
    if (sessionStorage.getItem(dismissKey) === '1') { setDismissed(true); return; }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [companyName]);

  if (installed) return null;
  if (dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(`pwa-dismissed-${companyName}`, '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === 'accepted') setInstalled(true);
      } catch {
        /* user dismissed */
      }
    } else if (isIOS()) {
      setIosOpen(true);
    }
  };

  // Only show on supported platforms (event fired OR iOS).
  const canInstall = !!deferredPrompt || isIOS();
  if (!canInstall) return null;

  return (
    <>
      <div role="dialog" aria-label={`Installer ${companyName}`} style={{
        position: 'fixed',
        bottom: 16, left: 16, right: 16,
        maxWidth: 460, margin: '0 auto',
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        padding: 14,
        display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 9999,
        animation: 'pwaBannerIn 0.4s cubic-bezier(0.16,1,0.3,1) 1.2s backwards',
      }}>
        <style>{`
          @keyframes pwaBannerIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: logoUrl
            ? `url(${logoUrl}) center/cover`
            : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
          color: '#fff', fontWeight: 700, fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid rgba(0,0,0,0.06)',
          fontFamily: 'Fraunces, serif',
        }}>
          {!logoUrl && companyName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#0A1410',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            Installer {companyName}
          </div>
          <div style={{ fontSize: 11, color: '#5C6B62', marginTop: 2 }}>
            Accès rapide depuis ton écran d'accueil
          </div>
        </div>
        <button
          onClick={handleInstall}
          type="button"
          style={{
            background: primaryColor, color: '#fff', border: 'none',
            padding: '9px 16px', borderRadius: 100,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            flexShrink: 0,
          }}>
          <Download size={13} /> Installer
        </button>
        <button
          onClick={dismiss}
          aria-label="Fermer"
          type="button"
          style={{
            background: 'transparent', border: 'none',
            color: '#94A39A', cursor: 'pointer', padding: 4,
            flexShrink: 0,
          }}>
          <X size={16} />
        </button>
      </div>

      {iosOpen && (
        <IOSInstructions companyName={companyName} primaryColor={primaryColor} onClose={() => setIosOpen(false)} />
      )}
    </>
  );
}

function IOSInstructions({
  companyName, primaryColor, onClose,
}: {
  companyName: string; primaryColor: string; onClose: () => void;
}) {
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF',
        borderRadius: 22,
        width: '100%', maxWidth: 460,
        padding: 24,
        position: 'relative',
      }}>
        <button onClick={onClose} aria-label="Fermer" type="button" style={{
          position: 'absolute', top: 14, right: 14,
          background: '#F0EBE3', border: 'none',
          width: 32, height: 32, borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={15} />
        </button>
        <div style={{
          fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700,
          color: '#0A1410', marginBottom: 6, letterSpacing: '-0.02em',
        }}>
          Installer {companyName}
        </div>
        <p style={{ fontSize: 13, color: '#5C6B62', margin: '0 0 20px' }}>
          Sur iPhone, suis ces 2 étapes pour ajouter l'app à ton écran d'accueil :
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Step n="1" color={primaryColor}>
            Tape sur <Share size={14} style={{ verticalAlign: -3, color: primaryColor }} /> en bas de Safari
          </Step>
          <Step n="2" color={primaryColor}>
            Choisis <Plus size={14} style={{ verticalAlign: -3, color: primaryColor }} /> <strong>« Sur l'écran d'accueil »</strong>
          </Step>
        </div>
        <div style={{
          background: '#F0EBE3', borderRadius: 12, padding: 12, marginTop: 16,
          fontSize: 12, color: '#384C42', lineHeight: 1.5,
        }}>
          💡 L'app apparaîtra avec son logo et son nom — comme une vraie app native.
        </div>
      </div>
    </div>
  );
}

function Step({ n, color, children }: { n: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: color, color: '#FFFFFF',
        fontWeight: 700, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'Fraunces, serif',
      }}>{n}</div>
      <div style={{ fontSize: 14, color: '#1A2A22', lineHeight: 1.5, paddingTop: 4 }}>
        {children}
      </div>
    </div>
  );
}
