# Orlode AI

> WhatsApp business OS for SMBs. Create your boutique, restaurant, hotel, salon, cabinet (médecin/avocat/notaire/comptable/véto), real estate agency or residence — and let an AI handle WhatsApp & Telegram conversations 24/7.

**Pitch (1 sentence)** : *"En 2 minutes, tu crées ta boutique en ligne, ton IA répond sur WhatsApp 24/7, et tu envoies le lien à tes premiers clients depuis ton téléphone."*

🌐 **Live**: https://orlode.com
📄 **Sales script** (90s demo): [`SALES_SCRIPT.md`](./SALES_SCRIPT.md)

---

## What's in the box

### 17 packs ready to ship

**7 vertical packs** — full admin app per business type :

| Pack | Route | Style |
|---|---|---|
| 🛍 Boutique | `/agents/commerce` | Catalogue + commandes + POS + livreurs + promos + fidélité |
| 🍽 Restaurant | `/agents/restaurant` | Menu + tables + KDS cuisine + livraison + réservations |
| 🏨 Hôtel | `/agents/hotel` | Chambres + séjours + iCal Booking/Airbnb + restaurant/spa |
| 🏘 Résidence | `/agents/residence` | Studios/F2/F3 Airbnb-style + calendrier 14j + remises long séjour |
| 💇 Salon | `/agents/service` | Coiffure/beauté/spa + agenda × équipe + fidélité tiers + AR Try-On |
| 🩺 Cabinet | `/agents/cabinet` | Multi-profil : médecin · dentiste · avocat · notaire · comptable · véto |
| 🏠 Immobilier | `/agents/realestate` | Biens + agenda visites + qualif leads WhatsApp |

**2 horizontal hubs** — bundle d'agents transversaux :

- `/agents/pme` (Sales · Comms · Marketing · Support)
- `/agents/enterprise` (Sales · Compta · Support · Comms)

**8 marketplace bundles** — generic hub via `<BundleHubPage>` :

- `/agents/sante` Santé · `/agents/artisan` · `/agents/agriculture`
- `/agents/securite-totale` · `/agents/securite-site`
- `/agents/mode` Mode & Luxe · `/agents/education`
- `/agents/super` Super Pack 8 agents

### Built-in features

- 🟢 **WhatsApp Cloud API** : send + receive + status webhooks + template HSM + image attachments
- 🔵 **Telegram Bot** : same, unified into a single inbox
- 💬 **Unified Inbox** (`/admin/inbox` + per-pack tab) : channel filter, inline composer, read receipts ✓✓, template send, image upload
- 🎙 **Gemini Live voice** : voice assistant FAB on every pack with contextual system prompt
- 🌐 **Public pages** (`/shop/:slug` · `/menu/:slug` · …) : merchant's customer-facing storefront with tagline + socials + click-to-WA/TG/call/email
- 🎨 **Studio onboarding** (`/studio`) : 5-step wizard (template → theme → identity → domain → launch)
- 🌍 **Domain management** (`/admin/domain`) : real DNS verify via Google DNS-over-HTTPS, Firebase Hosting records, pro emails
- 📊 **Dashboard** : packs strip + onboarding checklist + inbox preview + KPIs + AI suggestions
- 🌐 **i18n** : 6 langues (FR/EN/ES/AR/DE/PT) + RTL auto pour AR + switcher sur pages publiques
- 📱 **PWA** : manifest + service worker, installable depuis Chrome Android

---

## Stack

- **Frontend** : React 18 + TypeScript + Vite + Zustand + lucide-react. Pure CSS-in-JS (pas de Tailwind sur les redesigns récents pour avoir une typo serif premium Fraunces).
- **Backend** : Firebase Cloud Functions (Node 20, 2nd gen) — Express monté en handler unique `api`.
- **DB** : Firestore + Storage + Auth (multi-tenant via `companies/{cid}/...`).
- **AI** : Gemini (live audio + texte) + Genkit pour les agents. BYOE (Bring Your Own Everything) — chaque company peut amener ses propres clés.
- **Hosting** : Firebase Hosting (rewrites `/api/**` → Cloud Run function `api` en `us-central1`).
- **Messaging** : WhatsApp Business Cloud API + Telegram Bot API. Webhooks → Firestore → orchestrateur IA.

---

## Quick start (local dev)

```bash
# 1. Install
cd corpmind-ai
npm install
cd client && npm install && cd ..
cd functions && npm install && cd ..

# 2. Configure env
cp .env.example .env
# Edit with your Firebase project, Gemini key, etc.

# 3. Run client (frontend on :5173)
cd client && npm run dev

# 4. (optional) Run functions emulator
firebase emulators:start --only functions
```

> Le backend tourne en prod sur Cloud Run via Firebase Functions. Pour développer le serveur en local, utilise l'émulateur Firebase ou pointe `VITE_API_URL` vers ton émulateur.

---

## Deploy

```bash
# Frontend
cd client && npm run build && cd ..
firebase deploy --only hosting

# Backend (functions)
cd functions && npm run build && cd ..
firebase deploy --only functions:api

# Both
firebase deploy --only hosting,functions:api
```

Active project: `mon-assistant-86bbd` (Firebase). Active CLI account: `konectnotify@gmail.com`.

---

## Repo structure

```
corpmind-ai/
├── client/                          # React frontend
│   └── src/
│       ├── pages/
│       │   ├── commerce/            # Boutique pack
│       │   ├── restaurant/          # Restaurant pack
│       │   ├── hotel/ residence/    # Hospitality
│       │   ├── service/ cabinet/    # Salon + multi-profil Cabinet
│       │   ├── realestate/          # Immobilier
│       │   ├── pme/ enterprise/     # Horizontal hubs
│       │   ├── bundles/             # Generic 4-agent bundle factory
│       │   ├── public/              # Customer-facing /shop, /menu, …
│       │   ├── studio/              # 5-step onboarding wizard
│       │   └── admin/               # Settings, domain, inbox, billing…
│       ├── components/
│       │   ├── inbox/               # InboxTab + TemplateSendModal
│       │   ├── store/               # Settings modal + HeroBranding
│       │   ├── public/              # PublicBranding + LangSwitcher
│       │   └── dashboard/           # MyPacksStrip + QuickWins + InboxPreview
│       ├── hooks/                   # useInboxChannels, useGeminiLive…
│       └── store/                   # langStore, authStore (Zustand)
├── server/src/                      # Express routes / services / agents
│   ├── routes/                      # 40+ route files (commerce, whatsapp, …)
│   ├── services/                    # whatsapp / telegram / email / clone
│   └── agents/                      # AI agent implementations
├── functions/                       # Firebase Functions wrapper around server/
├── scripts/                         # Setup + cron scripts
├── SALES_SCRIPT.md                  # 90s demo script for screencast
├── firebase.json / firestore.rules
└── README.md (this file)
```

---

## Architecture highlights

### Multi-tenant safety
Every Firestore path is scoped `companies/{companyId}/stores/{storeId}/...`. The `router.param('storeId', requireStoreOwnership)` middleware in `commerce.routes.ts` rejects cross-tenant access with a 404 + warning log.

### Outbound persistence
`whatsappService.sendMessage(config, to, text, companyId, sentFrom)` writes the outbound message to `whatsappMessages` so the in-app Inbox shows it alongside inbound webhooks. Tagged by `sentFrom` (`admin-inbox` / `agent-auto-reply` / `admin-template`) for analytics.

### Rate limiting
Per-uid key (not per-IP, so users behind same NAT don't share). GETs skipped — only POST/PATCH/DELETE counts against the 2000/15min bucket.

### BundleHubPage factory
8 marketplace packs (Santé / Artisan / Agriculture / Sécurité×2 / Mode / Éducation / Super) share a single 600-line generic component vs duplicating 8×1500 lines. Each pack = ~30 lines of config in `BUNDLE_CONFIGS`.

---

## Commit conventions

```
feat(scope): short imperative title

Body explaining WHY (the reader can see WHAT in the diff). Bullet points
for non-trivial changes. Reference issue numbers if relevant.
```

Scopes used : `backend`, `client`, `packs`, `inbox`, `studio`, `domain`, `docs`, `chore`.

---

## License

Private. Closed source. Contact for licensing.
