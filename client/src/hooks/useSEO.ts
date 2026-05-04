/**
 * useSEO — update <title>, meta description, canonical, og:title, og:description
 * dynamically per page. Works for Google (executes JS) but NOT for Facebook/LinkedIn
 * share previews (they only read initial HTML — would need SSR for that).
 */
import { useEffect } from 'react';

const DEFAULT_TITLE = 'Orlode AI — 48 Agents IA pour votre Entreprise';
const DEFAULT_DESC  = 'Plateforme multi-agents IA pour entreprises africaines. 48 agents specialises, marketplace, site web auto, WhatsApp, connecteurs.';
const SITE_ORIGIN   = 'https://orlode.com';

function setMeta(selector: string, attr: 'content', value: string) {
  const el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (el) el.setAttribute(attr, value);
  else {
    const created = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    // Parse simple attribute selectors like 'meta[name="description"]' or 'meta[property="og:title"]'
    const match = selector.match(/\[([^=]+)="([^"]+)"\]/);
    if (match) created.setAttribute(match[1], match[2]);
    created.setAttribute(attr, value);
    document.head.appendChild(created);
  }
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export interface SEOOptions {
  title?: string;
  description?: string;
  /** Path starting with / — joined with SITE_ORIGIN for canonical URL */
  path?: string;
  /** Full absolute URL for og:image. Defaults to /logo.png */
  image?: string;
  /** noindex: block crawlers (e.g., for app pages behind auth) */
  noindex?: boolean;
}

export function useSEO(opts: SEOOptions) {
  useEffect(() => {
    const title = opts.title ?? DEFAULT_TITLE;
    const description = opts.description ?? DEFAULT_DESC;
    const canonical = opts.path ? `${SITE_ORIGIN}${opts.path}` : SITE_ORIGIN;
    const image = opts.image ?? `${SITE_ORIGIN}/logo.png`;

    document.title = title;
    setMeta('meta[name="description"]', 'content', description);
    setLink('canonical', canonical);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', image);

    // noindex handling — only set when explicitly requested
    const robotsEl = document.querySelector('meta[name="robots"]');
    if (opts.noindex) {
      if (robotsEl) robotsEl.setAttribute('content', 'noindex, nofollow');
      else {
        const m = document.createElement('meta');
        m.name = 'robots'; m.content = 'noindex, nofollow';
        document.head.appendChild(m);
      }
    } else if (robotsEl) {
      robotsEl.setAttribute('content', 'index, follow');
    }

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [opts.title, opts.description, opts.path, opts.image, opts.noindex]);
}
