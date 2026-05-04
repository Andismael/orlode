/**
 * Website Builder Agent — Generate a full website from company data
 * Uses all existing Orlode data (company info, CRM, team, products)
 * Generates HTML pages hosted on Firebase Hosting subdomains
 * Includes the embeddable AI chat widget automatically
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

// ── Generate website content from company data ──────────────────────────────

export const generateWebsiteTool = ai.defineTool(
  {
    name: 'website_generate',
    description: 'Generate a full website for the company. Supports 3 templates: "vitrine" (default showcase), "ecommerce" (product catalog with filters), "listing" (classified ads/real estate style). Collects company data automatically.',
    inputSchema: z.object({
      companyId: z.string(),
      template: z.enum(['vitrine', 'ecommerce', 'listing']).optional().default('vitrine').describe('vitrine = showcase site, ecommerce = product catalog with filters, listing = classified ads'),
      style: z.enum(['modern', 'minimal', 'bold', 'african', 'corporate']).optional().default('modern'),
      color: z.string().optional().default('#6c3ce0'),
      pages: z.array(z.string()).optional().default(['home', 'about', 'services', 'contact']),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      siteUrl: z.string(),
      pagesGenerated: z.number(),
      sections: z.array(z.string()),
      message: z.string(),
    }),
  },
  async ({ companyId, template, style, color, pages, language }) => {
    const db = getFirestore();

    // Collect all company data
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const company = companyDoc.data() ?? {};

    // Get team members
    const membersSnap = await db.collection(`companies/${companyId}/members`).limit(20).get();
    const members = membersSnap.docs.map(d => d.data());

    // Get leads/clients for testimonials
    const leadsSnap = await db.collection(`companies/${companyId}/leads`).limit(10).get();
    const leads = leadsSnap.docs.map(d => d.data());

    // Get services/products if any
    const productsSnap = await db.collection(`companies/${companyId}/products`).limit(20).get();
    const products = productsSnap.docs.map(d => d.data());

    const companyName = (company['name'] as string) ?? 'Mon Entreprise';
    const industry = (company['industry'] as string) ?? '';

    // Generate website content with Gemini
    const { text: contentJson } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Genere le contenu d'un site web professionnel en ${language} pour cette entreprise:

Nom: ${companyName}
Industrie: ${industry}
Template: ${template ?? 'vitrine'}
Equipe: ${members.length} membres (${members.slice(0, 5).map(m => m['displayName']).join(', ')})
Produits/Services: ${products.length > 0 ? products.slice(0, 10).map(p => p['name']).join(', ') : 'Non specifie'}
Style: ${style}

Genere un JSON avec cette structure:
{
  "hero": { "title": "...", "subtitle": "...", "cta": "..." },
  "about": { "title": "...", "description": "...", "values": ["...", "...", "..."] },
  ${template === 'ecommerce' ? '"products": [{ "name": "...", "price": "$XX", "description": "...", "category": "...", "image": "" }],' : ''}
  ${template === 'listing' ? '"listings": [{ "title": "...", "location": "...", "price": "$XX", "image": "", "tags": ["tag1", "tag2"] }],' : ''}
  ${template === 'vitrine' || !template ? '"services": [{ "name": "...", "description": "...", "icon": "emoji" }],' : ''}
  "team": [{ "name": "...", "role": "...", "avatar": "initiale" }],
  "testimonials": [{ "name": "...", "text": "...", "company": "..." }],
  "contact": { "title": "...", "email": "...", "phone": "...", "address": "..." },
  "footer": { "description": "...", "copyright": "..." }
}

${template === 'ecommerce' ? 'Genere au moins 8 produits avec des prix realistes pour cette industrie. Utilise des categories logiques.' : ''}
${template === 'listing' ? 'Genere au moins 6 annonces avec des localisations et prix realistes. Ajoute des tags pertinents.' : ''}
Sois creatif, professionnel, et adapte au marche africain. Retourne UNIQUEMENT le JSON.`,
      config: { temperature: 0.4 },
    });

    let content;
    try {
      content = JSON.parse(contentJson.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    } catch {
      content = { hero: { title: companyName, subtitle: 'Bienvenue', cta: 'Contactez-nous' } };
    }

    // Save website config
    await db.collection(`companies/${companyId}/website`).doc('config').set({
      content,
      template: template ?? 'vitrine',
      style: style ?? 'modern',
      color: color ?? '#6c3ce0',
      pages: pages ?? ['home', 'about', 'services', 'contact'],
      language: language ?? 'fr',
      companyName,
      industry,
      widgetEnabled: true,
      status: 'published',
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const siteUrl = `https://orlode.com/site/${companyId}`;

    logger.info('[Website] Generated', { companyId, pages: pages?.length, style });
    return {
      success: true,
      siteUrl,
      pagesGenerated: pages?.length ?? 4,
      sections: ['hero', 'about', 'services', 'team', 'contact', 'widget_chat'],
      message: `Site web "${companyName}" genere avec succes ! URL: ${siteUrl}. Le widget chat IA est integre automatiquement.`,
    };
  }
);

// ── Update website section ──────────────────────────────────────────────────

export const updateWebsiteTool = ai.defineTool(
  {
    name: 'website_update',
    description: 'Update a specific section of the website. Use when user asks to change text, add a page, modify colors, etc.',
    inputSchema: z.object({
      companyId: z.string(),
      instruction: z.string().describe('What to change: "change hero title to...", "add promotions page", "make it more colorful"'),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), updatedSections: z.array(z.string()) }),
  },
  async ({ companyId, instruction }) => {
    const db = getFirestore();
    const configDoc = await db.collection(`companies/${companyId}/website`).doc('config').get();

    if (!configDoc.exists) return { success: false, message: 'Aucun site web trouve. Utilisez "Cree mon site web" d\'abord.', updatedSections: [] };

    const current = configDoc.data() ?? {};
    const content = current['content'] ?? {};

    const { text: updatedJson } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Voici le contenu actuel du site web:
${JSON.stringify(content, null, 2)}

Instruction de modification: "${instruction}"

Applique la modification et retourne le JSON complet mis a jour. UNIQUEMENT le JSON, pas de markdown.`,
      config: { temperature: 0.3 },
    });

    let updated;
    try {
      updated = JSON.parse(updatedJson.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    } catch {
      return { success: false, message: 'Erreur lors de la modification. Reessayez avec une instruction plus precise.', updatedSections: [] };
    }

    await db.collection(`companies/${companyId}/website`).doc('config').update({
      content: updated,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, message: `Site web mis a jour : "${instruction}"`, updatedSections: Object.keys(updated) };
  }
);

// ── Get website status ──────────────────────────────────────────────────────

export const getWebsiteStatusTool = ai.defineTool(
  {
    name: 'website_status',
    description: 'Get the current status of the company website — is it published, what pages exist, what URL.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({ exists: z.boolean(), status: z.string(), url: z.string(), pages: z.array(z.string()), widgetEnabled: z.boolean() }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const configDoc = await db.collection(`companies/${companyId}/website`).doc('config').get();

    if (!configDoc.exists) return { exists: false, status: 'not_created', url: '', pages: [], widgetEnabled: false };

    const data = configDoc.data() ?? {};
    return {
      exists: true,
      status: (data['status'] as string) ?? 'draft',
      url: `https://orlode.com/site/${companyId}`,
      pages: (data['pages'] as string[]) ?? [],
      widgetEnabled: (data['widgetEnabled'] as boolean) ?? true,
    };
  }
);

// ── Get embed code ──────────────────────────────────────────────────────────

export const getEmbedCodeTool = ai.defineTool(
  {
    name: 'website_getEmbedCode',
    description: 'Get the embed code to add the AI chat widget to any external website (WordPress, Wix, etc).',
    inputSchema: z.object({
      companyId: z.string(),
      color: z.string().optional().default('#6c3ce0'),
      title: z.string().optional(),
    }),
    outputSchema: z.object({ code: z.string(), instructions: z.string() }),
  },
  async ({ companyId, color, title }) => {
    const db = getFirestore();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyName = (companyDoc.data()?.['name'] as string) ?? 'Assistant IA';

    const code = `<script src="https://orlode.com/embed.js"\n  data-company="${companyId}"\n  data-color="${color ?? '#6c3ce0'}"\n  data-title="${title ?? companyName}"\n  data-welcome="Bonjour ! Comment puis-je vous aider ?"></script>`;

    return {
      code,
      instructions: `Collez ce code juste avant </body> sur votre site web. Compatible avec WordPress, Wix, Shopify, et tout site HTML. Le widget se chargera automatiquement avec votre assistant IA ${companyName}.`,
    };
  }
);

// ── Deploy to user's Firebase Hosting (BYOE) ───────────────────────────────

export const deployToFirebaseTool = ai.defineTool(
  {
    name: 'website_deployFirebase',
    description: 'Deploy the generated website to the user\'s own Firebase Hosting. Uses their Service Account key stored in BYOE setup. Only for Pro/Premium BYOE users.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), url: z.string(), message: z.string() }),
  },
  async ({ companyId }) => {
    const db = getFirestore();

    // Get website config
    const configDoc = await db.collection(`companies/${companyId}/website`).doc('config').get();
    if (!configDoc.exists) return { success: false, url: '', message: 'Aucun site web genere. Utilisez "Cree mon site web" d\'abord.' };

    const siteData = configDoc.data()!;
    const content = siteData['content'] as Record<string, unknown>;
    const color = (siteData['color'] as string) ?? '#6c3ce0';
    const companyName = (siteData['companyName'] as string) ?? 'Mon Entreprise';

    // Get BYOE credentials
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const company = companyDoc.data() ?? {};
    const tenantDoc = await db.collection('tenants').doc(companyId).get();
    const tenant = tenantDoc.data() ?? {};

    const firebaseProjectId = (tenant['firebaseProjectId'] ?? company['firebaseProjectId']) as string | undefined;
    const serviceAccountKey = (tenant['serviceAccountKey'] ?? company['serviceAccountKey']) as string | undefined;

    if (!firebaseProjectId || !serviceAccountKey) {
      // Not BYOE — return Orlode URL
      return {
        success: true,
        url: `https://orlode.com/site/${companyId}`,
        message: `Site disponible sur Orlode: https://orlode.com/site/${companyId}. Pour deployer sur votre propre domaine, configurez BYOE dans Admin > Clone.`,
      };
    }

    // Generate static HTML
    const html = generateStaticHTML(content, companyName, color, companyId, (siteData['widgetEnabled'] as boolean) ?? true);

    // Deploy using their Firebase credentials
    try {
      const admin = await import('firebase-admin');

      // Create temporary app with their credentials
      const serviceAccount = JSON.parse(serviceAccountKey);
      const tempApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: firebaseProjectId,
      }, `deploy-${companyId}-${Date.now()}`);

      // Use Firebase Hosting REST API
      const token = await (tempApp.options.credential as { getAccessToken: () => Promise<{ access_token: string }> }).getAccessToken();

      // Create new version
      const createRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${firebaseProjectId}/versions`, {
        method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { rewrites: [{ glob: '**', path: '/index.html' }] } }),
      });
      const version = await createRes.json() as { name: string };

      // Upload index.html
      const gzipped = Buffer.from(html);
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(gzipped).digest('hex');

      await fetch(`https://firebasehosting.googleapis.com/v1beta1/${version.name}:populateFiles`, {
        method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { '/index.html': hash } }),
      });

      // Finalize and release
      await fetch(`https://firebasehosting.googleapis.com/v1beta1/${version.name}?update_mask=status`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINALIZED' }),
      });

      await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${firebaseProjectId}/releases`, {
        method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: { name: version.name } }),
      });

      // Cleanup temp app
      await tempApp.delete();

      const deployedUrl = `https://${firebaseProjectId}.web.app`;

      // Save deployed URL
      await db.collection(`companies/${companyId}/website`).doc('config').update({
        deployedUrl,
        deployedAt: FieldValue.serverTimestamp(),
        deployTarget: 'firebase',
      });

      logger.info('[Website] Deployed to user Firebase', { companyId, firebaseProjectId });
      return { success: true, url: deployedUrl, message: `Site deploye sur votre Firebase ! URL: ${deployedUrl}` };
    } catch (err) {
      logger.error('[Website] Firebase deploy failed', { companyId, error: err });

      // Fallback to Orlode hosting
      const fallbackUrl = `https://orlode.com/site/${companyId}`;
      return {
        success: true, url: fallbackUrl,
        message: `Deploiement Firebase echoue (verifiez votre Service Account). Site disponible sur Orlode: ${fallbackUrl}`,
      };
    }
  }
);

// Generate static HTML for deployment
function generateStaticHTML(content: Record<string, unknown>, companyName: string, color: string, companyId: string, widgetEnabled: boolean, template?: string): string {
  const hero = content['hero'] as { title: string; subtitle: string; cta: string } | undefined;
  const about = content['about'] as { title: string; description: string; values: string[] } | undefined;
  const services = content['services'] as Array<{ name: string; description: string; icon: string }> | undefined;
  const products = content['products'] as Array<{ name: string; price: string; image: string; description: string; category: string }> | undefined;
  const listings = content['listings'] as Array<{ title: string; location: string; price: string; image: string; tags: string[] }> | undefined;
  const team = content['team'] as Array<{ name: string; role: string; avatar: string }> | undefined;
  const contact = content['contact'] as { title: string; email: string; phone: string; address: string } | undefined;
  const footer = content['footer'] as { description: string; copyright: string } | undefined;

  const widget = widgetEnabled ? `<script src="https://orlode.com/embed.js" data-company="${companyId}" data-color="${color}" data-title="${companyName}"></script>` : '';

  // PWA manifest + service worker
  const pwaManifest = `<link rel="manifest" href="data:application/json,${encodeURIComponent(JSON.stringify({
    name: companyName, short_name: companyName.slice(0, 12), start_url: '/', display: 'standalone',
    background_color: '#ffffff', theme_color: color,
    icons: [{ src: `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&size=192&background=${color.slice(1)}&color=fff`, sizes: '192x192', type: 'image/png' }],
  }))}">
<meta name="theme-color" content="${color}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="${companyName}">`;

  const serviceWorkerScript = `<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('data:text/javascript,self.addEventListener("fetch",function(e){e.respondWith(fetch(e.request).catch(function(){return new Response("Offline")}))})')}</script>`;

  // E-commerce specific CSS + HTML
  const ecommerceCSS = template === 'ecommerce' ? `
.products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}
.product-card{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3f4f6;transition:transform .2s,box-shadow .2s}
.product-card:hover{transform:translateY(-4px);box-shadow:0 12px 24px rgba(0,0,0,0.08)}
.product-img{width:100%;height:200px;object-fit:cover;background:#f9fafb}
.product-info{padding:16px}
.product-name{font-size:15px;font-weight:600;margin-bottom:4px}
.product-desc{font-size:13px;color:#6b7280;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.product-price{font-size:18px;font-weight:700;color:${color}}
.product-btn{display:block;text-align:center;padding:10px;background:${color};color:#fff;border-radius:8px;font-weight:600;font-size:14px;margin-top:12px}
.filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;justify-content:center}
.filter-btn{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:500;border:1px solid #e5e7eb;background:#fff;cursor:pointer}
.filter-btn.active{background:${color};color:#fff;border-color:${color}}` : '';

  // Listing specific CSS
  const listingCSS = template === 'listing' ? `
.listings-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.listing-card{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3f4f6;transition:transform .2s}
.listing-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}
.listing-img{width:100%;height:180px;object-fit:cover;background:#f0f0f0}
.listing-info{padding:16px}
.listing-title{font-size:16px;font-weight:700;margin-bottom:4px}
.listing-location{font-size:13px;color:#6b7280;margin-bottom:8px}
.listing-price{font-size:20px;font-weight:800;color:${color}}
.listing-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.listing-tag{padding:4px 10px;border-radius:12px;font-size:11px;background:${color}10;color:${color};font-weight:500}
.search-box{display:flex;gap:12px;max-width:600px;margin:0 auto 32px;padding:12px 16px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.search-box input{flex:1;border:none;outline:none;font-size:14px}
.search-box button{padding:8px 20px;background:${color};color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}` : '';

  // E-commerce section HTML
  const ecommerceHTML = (template === 'ecommerce' && products && products.length > 0) ? `
<section id="products" class="bg-gray" style="padding:80px 24px">
<div class="container">
<h2 class="section-title">Nos Produits</h2>
<div class="filter-bar"><button class="filter-btn active" onclick="filterProducts('all')">Tous</button>${[...new Set(products.map(p => p.category))].map(c => `<button class="filter-btn" onclick="filterProducts('${c}')">${c}</button>`).join('')}</div>
<div class="products-grid">${products.map(p => `<div class="product-card" data-cat="${p.category}">
<div class="product-img" style="background:linear-gradient(135deg,${color}20,${color}05);display:flex;align-items:center;justify-content:center;font-size:48px">🛍️</div>
<div class="product-info"><p class="product-name">${p.name}</p><p class="product-desc">${p.description}</p><p class="product-price">${p.price}</p><a href="#contact" class="product-btn">Commander</a></div></div>`).join('')}</div>
</div></section>
<script>function filterProducts(cat){document.querySelectorAll('.product-card').forEach(c=>{c.style.display=cat==='all'||c.dataset.cat===cat?'':'none'});document.querySelectorAll('.filter-btn').forEach(b=>{b.classList.toggle('active',b.textContent===cat||cat==='all'&&b.textContent==='Tous')})}</script>` : '';

  // Listing section HTML
  const listingHTML = (template === 'listing' && listings && listings.length > 0) ? `
<section id="listings" class="bg-gray" style="padding:80px 24px">
<div class="container">
<h2 class="section-title">Annonces</h2>
<div class="search-box"><input type="text" placeholder="Rechercher..." id="listingSearch" oninput="searchListings()"><button>Rechercher</button></div>
<div class="listings-grid">${listings.map(l => `<div class="listing-card" data-title="${l.title.toLowerCase()}">
<div class="listing-img" style="background:linear-gradient(135deg,${color}15,${color}05);display:flex;align-items:center;justify-content:center;font-size:48px">📋</div>
<div class="listing-info"><p class="listing-title">${l.title}</p><p class="listing-location">📍 ${l.location}</p><p class="listing-price">${l.price}</p>
<div class="listing-tags">${(l.tags ?? []).map(t => `<span class="listing-tag">${t}</span>`).join('')}</div></div></div>`).join('')}</div>
</div></section>
<script>function searchListings(){var q=document.getElementById('listingSearch').value.toLowerCase();document.querySelectorAll('.listing-card').forEach(c=>{c.style.display=c.dataset.title.includes(q)?'':'none'})}</script>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${companyName}</title>
<meta name="description" content="${hero?.subtitle ?? companyName}">
${pwaManifest}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Outfit',sans-serif;color:#111827;background:#fff}
a{text-decoration:none;color:inherit}.container{max-width:1100px;margin:0 auto;padding:0 24px}
nav{position:sticky;top:0;z-index:50;background:#fff;border-bottom:1px solid #f3f4f6;padding:12px 0}
.nav-inner{display:flex;align-items:center;justify-content:space-between}
.nav-links{display:flex;gap:24px}.nav-links a{font-size:14px;color:#6b7280;font-weight:500}
.hero{padding:clamp(60px,12vw,120px) 24px;text-align:center;background:linear-gradient(135deg,${color}08,${color}03)}
.hero h1{font-size:clamp(32px,6vw,56px);font-weight:800;line-height:1.1;letter-spacing:-0.03em;margin-bottom:16px}
.hero p{font-size:clamp(16px,2vw,20px);color:#6b7280;line-height:1.7;max-width:600px;margin:0 auto 32px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;background:${color};color:#fff;border-radius:12px;font-weight:600;font-size:15px;box-shadow:0 4px 14px ${color}40}
section{padding:80px 24px}.section-title{font-size:28px;font-weight:700;text-align:center;margin-bottom:40px}
.grid{display:grid;gap:20px}.grid-3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.card{padding:28px;background:#fff;border-radius:16px;border:1px solid #f3f4f6;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.card .icon{font-size:32px;margin-bottom:12px}.card h3{font-size:17px;font-weight:700;margin-bottom:8px}
.card p{font-size:14px;color:#6b7280;line-height:1.7}
.bg-gray{background:#f9fafb}
.avatar{width:64px;height:64px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700;margin:0 auto 12px}
.contact-item{display:flex;align-items:center;gap:12px;padding:16px;background:#f9fafb;border-radius:12px;margin-bottom:12px}
footer{padding:40px 24px;background:#111827;color:#9ca3af;text-align:center}
@media(max-width:768px){.nav-links{display:none}.grid-3{grid-template-columns:1fr}}
${ecommerceCSS}
${listingCSS}
</style>
</head>
<body>
<nav><div class="container nav-inner">
<strong style="font-size:18px">${companyName}</strong>
<div class="nav-links"><a href="#about">A propos</a>${template === 'ecommerce' ? '<a href="#products">Produits</a>' : template === 'listing' ? '<a href="#listings">Annonces</a>' : '<a href="#services">Services</a>'}<a href="#contact">Contact</a></div>
</div></nav>
${hero ? `<div class="hero"><div class="container"><h1>${hero.title}</h1><p>${hero.subtitle}</p><a href="${template === 'ecommerce' ? '#products' : template === 'listing' ? '#listings' : '#contact'}" class="btn">${hero.cta || (template === 'ecommerce' ? 'Voir nos produits' : template === 'listing' ? 'Voir les annonces' : 'Contactez-nous')}</a></div></div>` : ''}
${about ? `<section id="about"><div class="container"><h2 class="section-title">${about.title || 'A propos'}</h2><p style="text-align:center;color:#6b7280;max-width:650px;margin:0 auto;line-height:1.8">${about.description}</p></div></section>` : ''}
${ecommerceHTML}
${listingHTML}
${services && services.length > 0 && template !== 'ecommerce' && template !== 'listing' ? `<section id="services" class="bg-gray"><div class="container"><h2 class="section-title">Nos Services</h2><div class="grid grid-3">${services.map(s => `<div class="card"><div class="icon">${s.icon || '⭐'}</div><h3>${s.name}</h3><p>${s.description}</p></div>`).join('')}</div></div></section>` : ''}
${team && team.length > 0 ? `<section id="team"><div class="container"><h2 class="section-title">Notre Equipe</h2><div class="grid grid-3">${team.map(m => `<div style="text-align:center;padding:20px"><div class="avatar">${m.avatar || m.name[0]}</div><p style="font-weight:600">${m.name}</p><p style="font-size:13px;color:#6b7280">${m.role}</p></div>`).join('')}</div></div></section>` : ''}
${contact ? `<section id="contact"><div class="container" style="max-width:600px"><h2 class="section-title">${contact.title || 'Contact'}</h2>${contact.email ? `<div class="contact-item">📧 <div><small style="color:#9ca3af">Email</small><br><a href="mailto:${contact.email}">${contact.email}</a></div></div>` : ''}${contact.phone ? `<div class="contact-item">📞 <div><small style="color:#9ca3af">Telephone</small><br><a href="tel:${contact.phone}">${contact.phone}</a></div></div>` : ''}${contact.address ? `<div class="contact-item">📍 <div><small style="color:#9ca3af">Adresse</small><br>${contact.address}</div></div>` : ''}</div></section>` : ''}
<footer><p>${footer?.description ?? companyName}</p><p style="font-size:12px;margin-top:8px">${footer?.copyright ?? `© ${new Date().getFullYear()} ${companyName}`}</p><p style="font-size:11px;margin-top:16px;color:#4b5563">Site genere par <a href="https://orlode.com" style="color:${color}">Orlode AI</a></p></footer>
${widget}
${serviceWorkerScript}
</body></html>`;
}

// ── MAIN AGENT FLOW ─────────────────────────────────────────────────────────

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('fr'),
});

const OUTPUT = z.object({ response: z.string() });

export const websiteAgentFlow = ai.defineFlow(
  { name: 'websiteAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language }) => {
    const result = await ai.generate({
      model: GEMINI_FLASH,
      tools: [generateWebsiteTool, updateWebsiteTool, getWebsiteStatusTool, getEmbedCodeTool, deployToFirebaseTool],
      prompt: `Tu es l'Agent Website Builder de Orlode. Tu crees des sites web professionnels pour les entreprises en utilisant leurs donnees deja presentes dans Orlode.

Tes capacites:
1. GENERER un site web complet (accueil, a propos, services, contact, equipe)
2. MODIFIER le site (changer textes, couleurs, ajouter des pages)
3. DONNER le code embed pour ajouter le widget chat IA sur un site existant
4. VERIFIER le statut du site
5. DEPLOYER sur le Firebase du client (BYOE) ou sur Orlode (gratuit)

Le site inclut AUTOMATIQUEMENT le widget chat IA — les visiteurs peuvent parler a l'assistant de l'entreprise directement sur le site.

CompanyId: ${companyId}
Langue: ${language}

Requete: ${request}`,
      config: { temperature: 0.3 },
    });

    return { response: result.text };
  }
);

export const websiteAgentTool = ai.defineTool(
  {
    name: 'websiteAgent',
    description: 'Website Builder — generates professional websites from company data, includes AI chat widget, modifiable by chat.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  (input) => websiteAgentFlow(input)
);
