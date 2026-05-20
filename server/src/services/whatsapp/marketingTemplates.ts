/**
 * Marketing templates registry — Boutique WhatsApp.
 *
 * Each entry below maps to a Meta-approved WhatsApp message template name
 * and includes a French free-text body used as fallback whenever the
 * customer is still inside the 24h conversation window (no template
 * required) or whenever no Meta config is reachable.
 *
 * To activate templates outside 24h, the merchant must submit them in
 * Meta Business Manager → WhatsApp Manager → Templates and wait for
 * approval (1–3 days). Until approved, outbound messages outside 24h
 * will silently fail at Meta — but inside-24h flows keep working.
 */

export type TemplateVars = Record<string, string | number>;

export interface MarketingTemplate {
  /** Meta template name (must match an approved template in WhatsApp Manager). */
  metaName: string;
  /** Language code submitted to Meta (e.g. 'fr', 'fr_FR'). */
  language: string;
  /** Free-text body shown to the customer. {{var}} placeholders. */
  body: (vars: TemplateVars) => string;
  /** Ordered list of variables Meta expects when calling the template. */
  variables: string[];
  /** Human label for the admin UI. */
  label: string;
  /** Marketing | Utility — affects Meta approval category. */
  category: 'MARKETING' | 'UTILITY';
}

function tpl(parts: TemplateStringsArray, ...keys: string[]): (vars: TemplateVars) => string {
  return (vars) => parts.reduce((out, part, i) => {
    const key = keys[i];
    return out + part + (key !== undefined ? String(vars[key] ?? '') : '');
  }, '');
}

export const MARKETING_TEMPLATES: Record<string, MarketingTemplate> = {
  welcome_first_order: {
    metaName: 'orlode_welcome_first_order',
    language: 'fr',
    label: 'Bienvenue 1ère commande',
    category: 'UTILITY',
    variables: ['firstName', 'orderNumber', 'promoCode'],
    body: tpl`Bienvenue ${'firstName'} 🎉

Ta commande #${'orderNumber'} est bien reçue. Merci pour ta confiance !

🎁 *Cadeau de bienvenue* — pour ta prochaine commande, utilise le code *${'promoCode'}* et tu auras 10% de réduction.

À bientôt 👋`,
  },

  review_request: {
    metaName: 'orlode_review_request',
    language: 'fr',
    label: 'Demande d\'avis J+3',
    category: 'MARKETING',
    variables: ['firstName', 'productName', 'shopLink'],
    body: tpl`Salut ${'firstName'} 👋

Comment ça s'est passé avec ton *${'productName'}* ? On adore lire les retours (1 mot ou 1 photo suffit) 📸

Tu peux aussi voir nos nouveautés ici : ${'shopLink'}

Merci ! 🙏`,
  },

  cart_abandoned: {
    metaName: 'orlode_cart_abandoned',
    language: 'fr',
    label: 'Panier abandonné',
    category: 'MARKETING',
    variables: ['firstName', 'productName', 'shopLink'],
    body: tpl`Hello ${'firstName'} 👋

Tu as regardé *${'productName'}* il y a un moment — tu veux que je te le garde ?

Réponds-moi ici, ou finalise ta commande : ${'shopLink'}`,
  },

  back_in_stock: {
    metaName: 'orlode_back_in_stock',
    language: 'fr',
    label: 'Stock revenu',
    category: 'MARKETING',
    variables: ['firstName', 'productName', 'shopLink'],
    body: tpl`Bonne nouvelle ${'firstName'} 🎉

Le produit *${'productName'}* que tu attendais est *de nouveau disponible* !

👉 Commande maintenant : ${'shopLink'}

(Le stock part vite, on ne pourra pas le bloquer longtemps 🙏)`,
  },

  winback_30d: {
    metaName: 'orlode_winback_30d',
    language: 'fr',
    label: 'Win-back J+30',
    category: 'MARKETING',
    variables: ['firstName', 'shopLink', 'promoCode'],
    body: tpl`Hey ${'firstName'} 👋

Ça fait un moment ! On a ajouté de nouveaux produits depuis ta dernière visite.

🎁 Pour ton retour : code *${'promoCode'}* = -15% sur toute la boutique.

👉 ${'shopLink'}

À bientôt 🙏`,
  },
};

/**
 * Render a template body with vars (for inside-24h direct send).
 */
export function renderTemplate(name: keyof typeof MARKETING_TEMPLATES, vars: TemplateVars): string {
  const t = MARKETING_TEMPLATES[name];
  if (!t) throw new Error(`Unknown marketing template: ${name}`);
  return t.body(vars);
}

/**
 * Generate a 6-character readable promo code (no ambiguous chars).
 */
export function generatePromoCode(prefix = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return prefix ? `${prefix}-${code}` : code;
}
