/**
 * LandingV2Page — Premium marketing page (Notion / AT&T inspired).
 *
 * Mounted at /v2 in parallel with the existing /landing — does not replace
 * the current landing; the user evaluates this version side-by-side.
 *
 * Structure:
 *   - Sticky nav
 *   - Hero (split: copy left, image right)
 *   - Trust bar (logos)
 *   - Feature blocks (alternating image left/right)
 *   - Stats counter strip
 *   - Pricing (3 packs: PME, Entreprise, Super)
 *   - Testimonials
 *   - Big CTA
 *   - Footer
 *
 * Design notes:
 *   - Cream/ink palette + violet accent (matches the rest of Orlode)
 *   - Fraunces serif for headlines, Inter for body
 *   - Real images = Unsplash placeholders (replace with real product shots later)
 *   - No 3D / no animations heavier than fade-in (fast load = high conversion)
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Sparkles, Bot, MessageSquare, BarChart3,
  Headphones, Shield, Users, Zap, Globe, Star, ChevronRight, PlayCircle,
  Twitter, Linkedin, Youtube, Facebook, Instagram, Github, Menu, X as XIcon,
} from 'lucide-react';
import { useLangStore, LANGUAGES, type LangCode } from '@/store/langStore';

// ─────────────────────────────────────────────────────────────────────────────
// LANDING V2 — INLINE TRANSLATIONS (page-scoped, doesn't pollute the app i18n)
// Only English + French strings are localized below; other languages fall
// back to English so the page never shows raw keys.
// ─────────────────────────────────────────────────────────────────────────────
type LV2Lang = 'fr' | 'en' | 'es' | 'pt' | 'de' | 'ar';
const LV2_T: Record<string, Record<LV2Lang, string>> = {
  // Nav
  'nav.products':    { fr: 'Produits',        en: 'Products',     es: 'Productos',     pt: 'Produtos',     de: 'Produkte',    ar: 'المنتجات' },
  'nav.pricing':     { fr: 'Tarifs',          en: 'Pricing',      es: 'Precios',       pt: 'Preços',       de: 'Preise',      ar: 'الأسعار' },
  'nav.testimonials':{ fr: 'Témoignages',     en: 'Testimonials', es: 'Testimonios',   pt: 'Depoimentos',  de: 'Stimmen',     ar: 'الشهادات' },
  'nav.marketplace': { fr: 'Marketplace',     en: 'Marketplace',  es: 'Marketplace',   pt: 'Marketplace',  de: 'Marketplace', ar: 'متجر' },
  'nav.login':       { fr: 'Connexion',       en: 'Sign in',      es: 'Acceder',       pt: 'Entrar',       de: 'Anmelden',    ar: 'تسجيل الدخول' },
  'nav.cta':         { fr: 'Commencer',       en: 'Get started',  es: 'Empezar',       pt: 'Começar',      de: 'Starten',     ar: 'ابدأ' },
  // Hero
  'hero.badge':      { fr: 'Phase de lancement · Tarifs fondateurs', en: 'Launch phase · Founder pricing', es: 'Fase de lanzamiento · Precio fundador', pt: 'Fase de lançamento · Preço fundador', de: 'Launch-Phase · Gründer-Preis', ar: 'مرحلة الإطلاق · سعر المؤسس' },
  'hero.title.l1':   { fr: 'Le système',                en: 'The AI',                       es: 'El sistema',              pt: 'O sistema',               de: 'Das KI-',          ar: 'نظام' },
  'hero.title.l2':   { fr: "d'exploitation",            en: 'operating',                    es: 'operativo',               pt: 'operacional',             de: 'Betriebs-',         ar: 'التشغيل' },
  'hero.title.em':   { fr: 'IA',                        en: 'system',                       es: 'IA',                      pt: 'IA',                      de: 'system',           ar: 'بالذكاء' },
  'hero.title.l3':   { fr: "de l'entreprise",           en: 'for the modern',               es: 'para la empresa',         pt: 'para a empresa',          de: 'für moderne',      ar: 'للشركة' },
  'hero.title.l4':   { fr: 'moderne.',                  en: 'enterprise.',                  es: 'moderna.',                pt: 'moderna.',                de: 'Unternehmen.',     ar: 'الحديثة.' },
  'hero.lead':       { fr: '30 agents IA spécialisés — vente, comms, RH, compta, sécurité — qui travaillent ensemble dans un workspace unifié. Connectés à tes canaux, ton équipe et tes données. Disponibles 24/7.', en: '30 specialized AI agents — sales, comms, HR, accounting, security — working together in a unified workspace. Connected to your channels, your team and your data. Available 24/7.', es: '30 agentes IA especializados que trabajan juntos en un workspace unificado. Conectados a tus canales, equipo y datos. Disponibles 24/7.', pt: '30 agentes IA especializados que trabalham juntos num workspace unificado. Conectados aos teus canais, equipa e dados. Disponíveis 24/7.', de: '30 spezialisierte KI-Agenten, die zusammen in einem einheitlichen Workspace arbeiten. Verbunden mit Ihren Kanälen, Ihrem Team und Ihren Daten. 24/7 verfügbar.', ar: '30 وكيل ذكاء اصطناعي متخصص يعملون معًا في مساحة عمل موحدة. متصلون بقنواتك وفريقك وبياناتك. متاحون 24/7.' },
  'hero.cta.primary':{ fr: 'Essayer gratuitement',  en: 'Try for free',         es: 'Probar gratis',           pt: 'Experimentar grátis',     de: 'Kostenlos testen',     ar: 'جرّب مجانًا' },
  'hero.cta.demo':   { fr: 'Voir la démo',          en: 'Watch the demo',       es: 'Ver demo',                pt: 'Ver demo',                de: 'Demo ansehen',         ar: 'مشاهدة العرض' },
  'hero.stat1.lbl':  { fr: 'Agents spécialisés',    en: 'Specialized agents',   es: 'Agentes especializados', pt: 'Agentes especializados',  de: 'Spezialisierte Agenten', ar: 'وكلاء متخصصون' },
  'hero.stat2.lbl':  { fr: 'Par pack / mois',       en: 'Per pack / month',     es: 'Por pack / mes',          pt: 'Por pack / mês',          de: 'Pro Paket / Monat',    ar: 'لكل حزمة / شهر' },
  'hero.stat3.lbl':  { fr: 'Multi-canal',           en: 'Multi-channel',        es: 'Multi-canal',             pt: 'Multicanal',              de: 'Multi-Kanal',          ar: 'متعدد القنوات' },
  // Trust
  'trust.txt':       { fr: 'Intégré nativement avec les outils que tu utilises déjà', en: 'Native integration with the tools you already use', es: 'Integración nativa con las herramientas que ya usas', pt: 'Integração nativa com as ferramentas que já usas', de: 'Native Integration mit den Tools, die Sie bereits verwenden', ar: 'تكامل أصلي مع الأدوات التي تستخدمها بالفعل' },
  // Video 1
  'video1.badge':    { fr: 'Demo · 90 secondes',    en: 'Demo · 90 seconds',    es: 'Demo · 90 segundos',     pt: 'Demo · 90 segundos',      de: 'Demo · 90 Sekunden',  ar: 'عرض · 90 ثانية' },
  'video1.title':    { fr: 'Vois Orlode en action.', en: 'See Orlode in action.', es: 'Ve Orlode en acción.',  pt: 'Vê o Orlode em ação.',    de: 'Sieh Orlode in Aktion.', ar: 'شاهد Orlode أثناء العمل.' },
  'video1.lead':     { fr: 'Une démo express : tu installes ton premier pack, l\'agent prend ses premiers messages, le devis part. Tout en moins de deux minutes.', en: 'Express demo: install your first pack, the agent picks up its first messages, the quote goes out. All in under two minutes.', es: 'Demo express: instalas tu primer pack, el agente recibe sus primeros mensajes, sale la cotización. Todo en menos de dos minutos.', pt: 'Demo express: instalas o teu primeiro pack, o agente recebe as primeiras mensagens, a cotação é enviada. Tudo em menos de dois minutos.', de: 'Express-Demo: Installieren Sie Ihr erstes Paket, der Agent nimmt seine ersten Nachrichten auf, das Angebot geht raus. Alles in weniger als zwei Minuten.', ar: 'عرض سريع: تثبت أول حزمة، يتلقى الوكيل أول رسائله، يُرسل عرض الأسعار. كل ذلك في أقل من دقيقتين.' },
  // Feature 1
  'f1.badge':        { fr: 'Conversational commerce', en: 'Conversational commerce', es: 'Comercio conversacional', pt: 'Comércio conversacional', de: 'Conversational Commerce', ar: 'التجارة الحوارية' },
  'f1.title.l1':     { fr: "Tes clients t'écrivent.", en: 'Your customers reach out.', es: 'Tus clientes te escriben.', pt: 'Os teus clientes contactam.', de: 'Ihre Kunden schreiben Ihnen.', ar: 'عملاؤك يكتبون لك.' },
  'f1.title.em':     { fr: 'répond',                 en: 'answers',              es: 'responde',                pt: 'responde',                de: 'antwortet',            ar: 'يرد' },
  'f1.title.l2':     { fr: '. Tu vends.',            en: '. You sell.',          es: '. Tú vendes.',            pt: '. Tu vendes.',            de: '. Sie verkaufen.',     ar: '. أنت تبيع.' },
  'f1.title.bot':    { fr: 'Ton bot',                en: 'Your bot',             es: 'Tu bot',                  pt: 'O teu bot',               de: 'Ihr Bot',              ar: 'البوت الخاص بك' },
  'f1.lead':         { fr: 'Tes agents commerciaux répondent sur WhatsApp, Telegram, email et chat 24/7, qualifient les leads, génèrent devis et factures, envoient les rappels. Pendant que toi, tu dors.', en: 'Your sales agents reply on WhatsApp, Telegram, email and chat 24/7, qualify leads, generate quotes and invoices, send reminders. While you sleep.', es: 'Tus agentes comerciales responden en WhatsApp, Telegram, email y chat 24/7, califican leads, generan cotizaciones y facturas, envían recordatorios. Mientras tú duermes.', pt: 'Os teus agentes comerciais respondem no WhatsApp, Telegram, email e chat 24/7, qualificam leads, geram cotações e faturas, enviam lembretes. Enquanto dormes.', de: 'Ihre Vertriebsagenten antworten auf WhatsApp, Telegram, E-Mail und Chat 24/7, qualifizieren Leads, erstellen Angebote und Rechnungen, senden Erinnerungen. Während Sie schlafen.', ar: 'وكلاء المبيعات لديك يردون على واتساب وتيليجرام والبريد الإلكتروني والدردشة 24/7، يؤهلون العملاء المحتملين، يولدون عروض الأسعار والفواتير، ويرسلون التذكيرات. بينما تنام أنت.' },
  'f1.li1':          { fr: 'Réponses contextuelles avec ton catalogue produits', en: 'Context-aware answers using your product catalog', es: 'Respuestas contextuales con tu catálogo de productos', pt: 'Respostas contextuais com o teu catálogo de produtos', de: 'Kontextbezogene Antworten mit Ihrem Produktkatalog', ar: 'إجابات سياقية باستخدام كتالوج منتجاتك' },
  'f1.li2':          { fr: 'Génération automatique de devis et factures PDF', en: 'Automatic PDF quote and invoice generation', es: 'Generación automática de cotizaciones y facturas PDF', pt: 'Geração automática de cotações e faturas PDF', de: 'Automatische PDF-Angebots- und Rechnungserstellung', ar: 'إنشاء تلقائي لعروض الأسعار والفواتير بصيغة PDF' },
  'f1.li3':          { fr: 'Coexistence avec tes apps de messagerie actuelles', en: 'Coexists with your current messaging apps', es: 'Coexiste con tus apps de mensajería actuales', pt: 'Coexiste com as tuas apps de mensagens atuais', de: 'Koexistiert mit Ihren aktuellen Messaging-Apps', ar: 'يتعايش مع تطبيقات المراسلة الحالية' },
  'f1.li4':          { fr: 'Multilingue · 50+ langues supportées', en: 'Multilingual · 50+ languages supported', es: 'Multilingüe · 50+ idiomas', pt: 'Multilingue · 50+ idiomas', de: 'Mehrsprachig · 50+ Sprachen', ar: 'متعدد اللغات · أكثر من 50 لغة' },
  // Feature 2
  'f2.badge':        { fr: 'Marketplace · 30 agents', en: 'Marketplace · 30 agents', es: 'Marketplace · 30 agentes', pt: 'Marketplace · 30 agentes', de: 'Marketplace · 30 Agenten', ar: 'المتجر · 30 وكيل' },
  'f2.title.l1':     { fr: 'Pas un bot.',            en: 'Not a bot.',           es: 'No un bot.',              pt: 'Não é um bot.',           de: 'Kein Bot.',            ar: 'ليس بوتًا.' },
  'f2.title.em':     { fr: 'équipe',                 en: 'team',                 es: 'equipo',                  pt: 'equipa',                  de: 'Team',                 ar: 'فريق' },
  'f2.title.l2':     { fr: 'Une',                    en: 'A',                    es: 'Un',                      pt: 'Uma',                     de: 'Ein',                  ar: 'بل' },
  'f2.title.l3':     { fr: '.',                      en: '.',                    es: '.',                       pt: '.',                       de: '.',                    ar: '.' },
  'f2.lead':         { fr: 'Choisis ton pack métier ou compose ton équipe d\'agents. Sales, Marketing, Comms, Support, RH, Compta, Sécurité, Knowledge brain… Ils travaillent ensemble dans le même workspace.', en: 'Pick a vertical pack or compose your own team. Sales, Marketing, Comms, Support, HR, Accounting, Security, Knowledge brain… They work together in the same workspace.', es: 'Elige un pack vertical o compón tu propio equipo. Sales, Marketing, Comms, Support, RH, Contabilidad, Seguridad, Knowledge brain… Trabajan juntos en el mismo workspace.', pt: 'Escolhe um pack vertical ou compõe a tua equipa. Sales, Marketing, Comms, Support, RH, Contabilidade, Segurança, Knowledge brain… Trabalham juntos no mesmo workspace.', de: 'Wählen Sie ein Branchenpaket oder stellen Sie Ihr eigenes Team zusammen.', ar: 'اختر حزمة قطاعية أو ركّب فريقك الخاص.' },
  'f2.cta':          { fr: 'Explorer le marketplace', en: 'Explore the marketplace', es: 'Explorar marketplace', pt: 'Explorar marketplace',  de: 'Marketplace erkunden', ar: 'استكشف المتجر' },
  // Stats
  'stats.s1':        { fr: 'Agents IA spécialisés',  en: 'Specialized AI agents', es: 'Agentes IA especializados', pt: 'Agentes IA especializados', de: 'Spezialisierte KI-Agenten', ar: 'وكلاء ذكاء اصطناعي متخصصون' },
  'stats.s2':        { fr: 'Disponibilité multi-canal', en: 'Multi-channel availability', es: 'Disponibilidad multicanal', pt: 'Disponibilidade multicanal', de: 'Multi-Kanal-Verfügbarkeit', ar: 'توفّر متعدد القنوات' },
  'stats.s3':        { fr: 'Pour activer ton équipe IA', en: 'To activate your AI team', es: 'Para activar tu equipo IA', pt: 'Para ativar a tua equipa IA', de: 'Um Ihr KI-Team zu aktivieren', ar: 'لتفعيل فريقك الذكي' },
  // Video 2
  'v2.badge':        { fr: 'Customer story',        en: 'Customer story',       es: 'Historia de cliente',    pt: 'Caso de cliente',         de: 'Kundenstory',          ar: 'قصة عميل' },
  'v2.title.l1':     { fr: 'Comment Sophie',         en: 'How Sophie',           es: 'Cómo Sophie',             pt: 'Como Sophie',             de: 'Wie Sophie',           ar: 'كيف ضاعفت صوفي' },
  'v2.title.em':     { fr: 'CA',                     en: 'revenue',              es: 'ingresos',                pt: 'receita',                 de: 'Umsatz',               ar: 'إيراداتها' },
  'v2.title.l2':     { fr: 'a triplé son',           en: 'tripled her',          es: 'triplicó sus',            pt: 'triplicou a',             de: 'ihren',                ar: 'ثلاث مرات' },
  'v2.title.l3':     { fr: 'en 3 mois.',             en: 'in 3 months.',         es: 'en 3 meses.',             pt: 'em 3 meses.',             de: 'in 3 Monaten.',        ar: 'في 3 أشهر.' },
  'v2.lead':         { fr: 'Sa boutique recevait 200 messages WhatsApp/jour, sans système. Avec Orlode, son agent commercial qualifie les leads, envoie les devis, relance les paniers abandonnés. Elle dort enfin la nuit.', en: 'Her store received 200 WhatsApp messages/day, with no system. With Orlode, her sales agent qualifies leads, sends quotes, recovers abandoned carts. She finally sleeps at night.', es: 'Su tienda recibía 200 mensajes WhatsApp/día, sin sistema. Con Orlode, su agente comercial califica leads, envía cotizaciones, recupera carritos abandonados. Por fin duerme de noche.', pt: 'A sua loja recebia 200 mensagens WhatsApp/dia, sem sistema. Com Orlode, o agente comercial qualifica leads, envia cotações, recupera carrinhos abandonados. Finalmente dorme à noite.', de: 'Ihr Laden erhielt 200 WhatsApp-Nachrichten/Tag, ohne System. Mit Orlode qualifiziert ihr Vertriebsagent Leads, sendet Angebote, holt abgebrochene Warenkörbe zurück. Endlich schläft sie nachts.', ar: 'كان متجرها يستقبل 200 رسالة واتساب يوميًا دون نظام. مع Orlode، يؤهل وكيل المبيعات العملاء المحتملين ويرسل عروض الأسعار ويستعيد العربات المهجورة. وأخيرًا، تنام ليلاً.' },
  'v2.s1.v':         { fr: '×3.2',                   en: '×3.2',                 es: '×3.2',                    pt: '×3.2',                    de: '×3.2',                 ar: '×3.2' },
  'v2.s1.l':         { fr: 'Croissance CA',          en: 'Revenue growth',       es: 'Crecimiento ingresos',    pt: 'Crescimento receita',     de: 'Umsatzwachstum',       ar: 'نمو الإيرادات' },
  'v2.s2.v':         { fr: '−65%',                   en: '−65%',                 es: '−65%',                    pt: '−65%',                    de: '−65%',                 ar: '−65%' },
  'v2.s2.l':         { fr: 'Temps de réponse',       en: 'Response time',        es: 'Tiempo de respuesta',     pt: 'Tempo de resposta',       de: 'Antwortzeit',          ar: 'وقت الاستجابة' },
  'v2.s3.v':         { fr: '0',                      en: '0',                    es: '0',                       pt: '0',                       de: '0',                    ar: '0' },
  'v2.s3.l':         { fr: 'Lead perdu la nuit',     en: 'Lead lost overnight',  es: 'Lead perdido de noche',   pt: 'Lead perdido à noite',    de: 'Verlorener Nacht-Lead', ar: 'عميل مفقود ليلاً' },
  'v2.title.video':  { fr: '« Mon équipe peut enfin se concentrer sur la vente. »', en: '« My team can finally focus on selling. »', es: '« Mi equipo por fin se concentra en vender. »', pt: '« A minha equipa finalmente foca-se em vender. »', de: '„Mein Team kann sich endlich auf den Verkauf konzentrieren."', ar: '«فريقي أخيرًا يركّز على البيع.»' },
  'v2.subtitle.video':{ fr: 'Sophie, founder · 3 boutiques · 12 employés', en: 'Sophie, founder · 3 stores · 12 employees', es: 'Sophie, fundadora · 3 tiendas · 12 empleados', pt: 'Sophie, fundadora · 3 lojas · 12 funcionários', de: 'Sophie, Gründerin · 3 Filialen · 12 Mitarbeiter', ar: 'صوفي، المؤسسة · 3 متاجر · 12 موظفًا' },
  // Feature 3
  'f3.badge':        { fr: 'Analytics & sécurité',   en: 'Analytics & security', es: 'Analytics y seguridad',  pt: 'Analytics & segurança',   de: 'Analytics & Sicherheit', ar: 'التحليلات والأمن' },
  'f3.title.l1':     { fr: 'Tout est',               en: 'Everything is',        es: 'Todo está',               pt: 'Tudo é',                  de: 'Alles ist',            ar: 'كل شيء' },
  'f3.title.em':     { fr: 'tracé',                  en: 'tracked',              es: 'rastreado',               pt: 'rastreado',               de: 'nachverfolgt',         ar: 'مُتابَع' },
  'f3.title.l2':     { fr: '. Tout est protégé.',    en: '. Everything is secure.', es: '. Todo está protegido.', pt: '. Tudo é protegido.',   de: '. Alles ist geschützt.', ar: '. كل شيء محميّ.' },
  'f3.lead':         { fr: 'Audit logs exportables, agent Compliance qui scanne en continu (RGPD/ISO/SOC2), agent Cyber qui détecte les menaces. Pour scaler en confiance.', en: 'Exportable audit logs, Compliance agent scanning continuously (GDPR/ISO/SOC2), Cyber agent detecting threats. To scale with confidence.', es: 'Logs de auditoría exportables, agente Compliance que escanea en continuo (GDPR/ISO/SOC2), agente Cyber que detecta amenazas. Para escalar con confianza.', pt: 'Logs de auditoria exportáveis, agente Compliance a verificar continuamente (GDPR/ISO/SOC2), agente Cyber a detetar ameaças. Para escalar com confiança.', de: 'Exportierbare Audit-Logs, Compliance-Agent scannt kontinuierlich (DSGVO/ISO/SOC2), Cyber-Agent erkennt Bedrohungen. Sicher skalieren.', ar: 'سجلات تدقيق قابلة للتصدير، وكيل Compliance يفحص باستمرار (GDPR/ISO/SOC2)، وكيل Cyber يكتشف التهديدات. للتوسع بثقة.' },
  // Pricing
  'pricing.badge':   { fr: 'Tarifs simples',         en: 'Simple pricing',       es: 'Precios simples',         pt: 'Preços simples',          de: 'Einfache Preise',      ar: 'أسعار بسيطة' },
  'pricing.title.l1':{ fr: 'Une',                    en: 'An',                   es: 'Un',                      pt: 'Uma',                     de: 'Ein',                  ar: 'فريق' },
  'pricing.title.em':{ fr: 'équipe IA',              en: 'AI team',              es: 'equipo IA',               pt: 'equipa IA',               de: 'KI-Team',              ar: 'ذكاء اصطناعي' },
  'pricing.title.l2':{ fr: 'à partir de',            en: 'starting at',          es: 'desde',                   pt: 'a partir de',             de: 'ab',                   ar: 'بدءًا من' },
  'pricing.title.price': { fr: '$20/mois',           en: '$20/month',            es: '$20/mes',                 pt: '$20/mês',                 de: '$20/Monat',            ar: '20$/شهر' },
  'pricing.lead':    { fr: 'Choisis ton pack. Bring Your Own Everything. Annule à tout moment.', en: 'Pick your pack. Bring Your Own Everything. Cancel anytime.', es: 'Elige tu pack. Bring Your Own Everything. Cancela cuando quieras.', pt: 'Escolhe o teu pack. Bring Your Own Everything. Cancela quando quiseres.', de: 'Wählen Sie Ihr Paket. Bring Your Own Everything. Jederzeit kündbar.', ar: 'اختر حزمتك. أحضر أدواتك معك. ألغِ في أي وقت.' },
  'pricing.choose':  { fr: 'Choisir',                en: 'Choose',               es: 'Elegir',                  pt: 'Escolher',                de: 'Wählen',               ar: 'اختر' },
  'pricing.recommended': { fr: 'RECOMMANDÉ',         en: 'RECOMMENDED',          es: 'RECOMENDADO',             pt: 'RECOMENDADO',             de: 'EMPFOHLEN',            ar: 'موصى به' },
  // Testimonials
  'tm.badge':        { fr: 'Phase beta',             en: 'Beta phase',           es: 'Fase beta',               pt: 'Fase beta',               de: 'Beta-Phase',           ar: 'مرحلة بيتا' },
  'tm.title.l1':     { fr: 'Les',                    en: 'The',                  es: 'Los',                     pt: 'Os',                      de: 'Die',                  ar: 'أوائل' },
  'tm.title.em':     { fr: 'premières',              en: 'first',                es: 'primeros',                pt: 'primeiros',               de: 'ersten',               ar: 'الفرق' },
  'tm.title.l2':     { fr: 'équipes',                en: 'teams',                es: 'equipos',                 pt: 'equipas',                 de: 'Teams,',               ar: 'التي' },
  'tm.title.l3':     { fr: 'qui scalent avec Orlode.', en: 'scaling with Orlode.', es: 'que escalan con Orlode.', pt: 'a escalar com Orlode.', de: 'die mit Orlode skalieren.', ar: 'تتوسع مع Orlode.' },
  // Big CTA
  'cta.badge':       { fr: 'Tarifs fondateurs · Phase de lancement', en: 'Founder pricing · Launch phase', es: 'Precio fundador · Fase de lanzamiento', pt: 'Preço fundador · Fase de lançamento', de: 'Gründer-Preis · Launch-Phase', ar: 'سعر المؤسس · مرحلة الإطلاق' },
  'cta.title.l1':    { fr: 'Construis ton équipe IA',  en: 'Build your AI team',   es: 'Construye tu equipo IA',  pt: 'Constrói a tua equipa IA', de: 'Baue dein KI-Team', ar: 'ابنِ فريقك الذكي' },
  'cta.title.em':    { fr: '10 minutes',              en: '10 minutes',           es: '10 minutos',              pt: '10 minutos',              de: '10 Minuten',           ar: '10 دقائق' },
  'cta.title.l2':    { fr: 'en',                      en: 'in',                   es: 'en',                      pt: 'em',                      de: 'in',                   ar: 'في' },
  'cta.title.l3':    { fr: '.',                       en: '.',                    es: '.',                       pt: '.',                       de: '.',                    ar: '.' },
  'cta.lead':        { fr: "Aucune installation. Aucune carte bancaire requise pour démarrer. Active ton premier agent et envoie ton premier message dès aujourd'hui.", en: 'No installation. No credit card required to start. Activate your first agent and send your first message today.', es: 'Sin instalación. Sin tarjeta para empezar. Activa tu primer agente y envía tu primer mensaje hoy.', pt: 'Sem instalação. Sem cartão para começar. Ativa o teu primeiro agente e envia a tua primeira mensagem hoje.', de: 'Keine Installation. Keine Kreditkarte erforderlich, um zu starten. Aktivieren Sie Ihren ersten Agenten und senden Sie Ihre erste Nachricht heute.', ar: 'بدون تثبيت. بدون بطاقة لتبدأ. فعّل أول وكيل وأرسل أول رسالة اليوم.' },
  'cta.primary':     { fr: 'Commencer gratuitement',  en: 'Start for free',       es: 'Empezar gratis',          pt: 'Começar grátis',          de: 'Kostenlos starten',    ar: 'ابدأ مجانًا' },
  'cta.market':      { fr: 'Voir le marketplace',     en: 'See marketplace',      es: 'Ver marketplace',         pt: 'Ver marketplace',         de: 'Marketplace ansehen',  ar: 'انظر المتجر' },
  // Footer
  'foot.tagline':    { fr: "Le système d'exploitation IA de l'entreprise moderne.", en: 'The AI operating system for the modern enterprise.', es: 'El sistema operativo IA para la empresa moderna.', pt: 'O sistema operacional IA para a empresa moderna.', de: 'Das KI-Betriebssystem für moderne Unternehmen.', ar: 'نظام تشغيل الذكاء الاصطناعي للشركة الحديثة.' },
  'foot.product':    { fr: 'Produit',                 en: 'Product',              es: 'Producto',                pt: 'Produto',                 de: 'Produkt',              ar: 'المنتج' },
  'foot.solutions':  { fr: 'Solutions',               en: 'Solutions',            es: 'Soluciones',              pt: 'Soluções',                de: 'Lösungen',             ar: 'الحلول' },
  'foot.resources':  { fr: 'Ressources',              en: 'Resources',            es: 'Recursos',                pt: 'Recursos',                de: 'Ressourcen',           ar: 'الموارد' },
  'foot.company':    { fr: 'Entreprise',              en: 'Company',              es: 'Empresa',                 pt: 'Empresa',                 de: 'Unternehmen',          ar: 'الشركة' },
  'foot.legal':      { fr: 'Juridique',               en: 'Legal',                es: 'Legal',                   pt: 'Legal',                   de: 'Rechtliches',          ar: 'قانوني' },
  'foot.newsletter.title': { fr: 'Reste informé',     en: 'Stay in the loop',     es: 'Mantente al día',         pt: 'Fica a par',              de: 'Bleib auf dem Laufenden', ar: 'ابقَ على اطلاع' },
  'foot.newsletter.lead':  { fr: '1 email/mois · nouveautés produit · 0 spam', en: '1 email/month · product updates · zero spam', es: '1 email/mes · novedades · sin spam', pt: '1 email/mês · novidades · sem spam', de: '1 E-Mail/Monat · Produkt-Updates · 0 Spam', ar: 'بريد واحد شهريًا · تحديثات · بدون إزعاج' },
  'foot.newsletter.placeholder': { fr: 'ton@email.com', en: 'you@email.com', es: 'tu@email.com', pt: 'tu@email.com', de: 'du@email.com', ar: 'البريد@example.com' },
  'foot.newsletter.btn':  { fr: "S'inscrire",         en: 'Subscribe',            es: 'Suscribir',               pt: 'Subscrever',              de: 'Abonnieren',           ar: 'اشترك' },
  'foot.copyright':  { fr: '© 2026 Orlode AI · All rights reserved', en: '© 2026 Orlode AI · All rights reserved', es: '© 2026 Orlode AI · Todos los derechos reservados', pt: '© 2026 Orlode AI · Todos os direitos reservados', de: '© 2026 Orlode AI · Alle Rechte vorbehalten', ar: '© 2026 Orlode AI · جميع الحقوق محفوظة' },
};

function lv2T(key: string, lang: LV2Lang): string {
  const entry = LV2_T[key];
  if (!entry) return key;
  return entry[lang] ?? entry['en'] ?? entry['fr'] ?? key;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  ink:      '#0A2A20',
  inkSoft:  '#5A6B62',
  inkLight: '#94A3A0',
  cream:    '#FFFAF0',
  creamDeep:'#F5EDD6',
  violet:   '#7C3AED',
  violetDeep:'#5B21B6',
  emerald:  '#10B981',
  emeraldDeep:'#059669',
  gold:     '#D4A017',
  pink:     '#EC4899',
};

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800&display=swap');
  /* ── Animations for the product mockups (Niveau 1: pure CSS) ─────────── */
  @keyframes lv2BubblePop { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes lv2Typing { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
  @keyframes lv2AgentPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124,58,237,0); } 50% { transform: scale(1.04); box-shadow: 0 0 0 12px rgba(124,58,237,0.15); } }
  @keyframes lv2NumCount { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes lv2BarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes lv2Slide { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes lv2Glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } 50% { box-shadow: 0 0 24px 4px rgba(16,185,129,0.4); } }
  .lv2-bubble { animation: lv2BubblePop 0.4s ease-out backwards; }
  .lv2-typing-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #94A3A0; margin: 0 1.5px; animation: lv2Typing 1.4s infinite ease-in-out; }
  .lv2-typing-dot:nth-child(2) { animation-delay: 0.2s; } .lv2-typing-dot:nth-child(3) { animation-delay: 0.4s; }
  .lv2-agent-tile { animation: lv2BubblePop 0.4s ease-out backwards; }
  .lv2-agent-active { animation: lv2AgentPulse 2.4s infinite; }
  .lv2-bar { transform-origin: left center; animation: lv2BarGrow 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
  .lv2-stat { animation: lv2NumCount 0.6s ease-out backwards; }
  .lv2-alert { animation: lv2Slide 0.5s ease-out backwards; }
  .lv2-glow { animation: lv2Glow 2.8s infinite; }
  .lv2 * { box-sizing: border-box; }
  .lv2 { font-family: 'Inter', sans-serif; color: ${C.ink}; background: ${C.cream}; min-height: 100vh; }
  .lv2 .display { font-family: 'Fraunces', serif; letter-spacing: -0.025em; line-height: 1.05; font-weight: 700; }
  .lv2 .display em { font-style: italic; font-weight: 500; color: ${C.violet}; }
  .lv2 .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .lv2 .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 14px 22px; background: ${C.ink}; color: ${C.cream}; border-radius: 999px; font-weight: 600; font-size: 14px; border: none; cursor: pointer; transition: all 0.2s; text-decoration: none; }
  .lv2 .btn-primary:hover { background: ${C.violetDeep}; transform: translateY(-1px); box-shadow: 0 12px 28px -8px ${C.violet}80; }
  .lv2 .btn-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 14px 22px; background: transparent; color: ${C.ink}; border-radius: 999px; font-weight: 600; font-size: 14px; border: 1.5px solid ${C.ink}20; cursor: pointer; transition: all 0.2s; text-decoration: none; }
  .lv2 .btn-secondary:hover { border-color: ${C.ink}; background: ${C.creamDeep}; }
  .lv2 .pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: ${C.violet}10; color: ${C.violetDeep}; border: 1px solid ${C.violet}30; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .lv2 .h1 { font-size: clamp(40px, 6vw, 76px); }
  .lv2 .h2 { font-size: clamp(32px, 4.5vw, 56px); }
  .lv2 .h3 { font-size: clamp(22px, 2.5vw, 32px); }
  .lv2 .lead { font-size: 18px; color: ${C.inkSoft}; line-height: 1.6; }
  .lv2 .nav { position: sticky; top: 0; z-index: 50; background: rgba(255,250,240,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid ${C.ink}08; }
  .lv2 .card { background: ${C.cream}; border-radius: 24px; border: 1px solid ${C.ink}08; box-shadow: 0 1px 0 ${C.ink}06; }
  .lv2 .card-dark { background: ${C.ink}; color: ${C.cream}; border-radius: 28px; padding: 60px 48px; }
  .lv2 .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
  .lv2 .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .lv2 .feature-img { width: 100%; aspect-ratio: 4/3; border-radius: 20px; object-fit: cover; box-shadow: 0 30px 60px -20px ${C.ink}30; }
  .lv2 .stat-num { font-family: 'Fraunces', serif; font-size: 64px; font-weight: 700; color: ${C.violet}; line-height: 1; }
  .lv2 .stat-lbl { font-size: 14px; color: ${C.inkSoft}; margin-top: 8px; }
  .lv2 .nav-link { color: ${C.ink}; text-decoration: none; font-size: 14px; font-weight: 500; padding: 8px 12px; border-radius: 8px; transition: background 0.15s; }
  .lv2 .nav-link:hover { background: ${C.creamDeep}; }
  .lv2 .testimonial { background: ${C.creamDeep}; padding: 28px; border-radius: 20px; border: 1px solid ${C.ink}08; }
  .lv2 .price-card { background: ${C.cream}; border-radius: 24px; padding: 32px; border: 1.5px solid ${C.ink}08; transition: all 0.2s; position: relative; }
  .lv2 .price-card.featured { border-color: ${C.violet}; box-shadow: 0 30px 60px -20px ${C.violet}30; }
  .lv2 .price-tag { background: linear-gradient(135deg, ${C.gold}, ${C.violet}); color: ${C.cream}; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; }
  .lv2 ul.check { list-style: none; padding: 0; margin: 16px 0 0; }
  .lv2 ul.check li { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; font-size: 14px; color: ${C.inkSoft}; }
  .lv2 ul.check li svg { color: ${C.emerald}; flex-shrink: 0; margin-top: 3px; }
  .lv2 .fade-in { animation: lv2FadeIn 0.6s ease-out backwards; }
  @keyframes lv2FadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  /* ── Tablet (mid breakpoint) ─────────────────────────────────────────── */
  @media (max-width: 1024px) {
    .lv2 .grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .lv2 .lv2-footer-cols { grid-template-columns: repeat(3, 1fr) !important; }
    .lv2 .container { padding: 0 20px; }
  }
  /* ── Mobile ──────────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .lv2 .grid-2, .lv2 .grid-3 { grid-template-columns: 1fr !important; gap: 32px !important; }
    .lv2 .stat-num { font-size: 44px; }
    .lv2 .nav-links { display: none; }
    .lv2 .lv2-footer-top { grid-template-columns: 1fr !important; gap: 32px !important; }
    .lv2 .lv2-footer-cols { grid-template-columns: repeat(2, 1fr) !important; gap: 24px !important; }
    .lv2 .card-dark { padding: 36px 24px !important; border-radius: 22px !important; }
    .lv2 .price-card { padding: 24px !important; }
    .lv2 .feature-img { aspect-ratio: 4/3; }
    .lv2 section { padding-top: 60px !important; padding-bottom: 60px !important; }
    .lv2 .lv2-hero-badge-tl { top: -10px !important; right: 8px !important; padding: 8px 10px !important; font-size: 10px !important; }
    .lv2 .lv2-hero-badge-bl { bottom: -10px !important; left: 8px !important; padding: 10px 12px !important; }
    .lv2 .lv2-mobile-show { display: inline-flex !important; }
    .lv2 .lv2-pricing-grid { grid-template-columns: 1fr !important; }
  }
  /* ── Small phones ────────────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .lv2 .lv2-footer-cols { grid-template-columns: 1fr !important; }
    .lv2 .container { padding: 0 16px; }
    .lv2 .card-dark { padding: 28px 18px !important; }
    .lv2 .h1 { font-size: 38px !important; }
    .lv2 .h2 { font-size: 28px !important; }
    .lv2 .lead { font-size: 16px !important; }
  }
  /* Hidden by default; shown on mobile via .lv2-mobile-show */
  .lv2-mobile-show { display: none; }
  .lv2-mobile-menu { position: fixed; inset: 0; background: rgba(255,250,240,0.97); backdrop-filter: blur(20px); z-index: 100; display: flex; flex-direction: column; padding: 24px; animation: lv2FadeIn 0.2s ease-out; }
  .lv2-mobile-menu a { padding: 16px 8px; font-size: 18px; font-weight: 600; color: ${C.ink}; text-decoration: none; border-bottom: 1px solid ${C.ink}10; }
`;

// Hero photo: branded Orlode key visual at /landing/hero.png. Override via
// VITE_LANDING_HERO_IMAGE_URL if you ship a fresh version without a redeploy.
const IMG = {
  hero: ((import.meta as any).env?.VITE_LANDING_HERO_IMAGE_URL as string | undefined)
    ?? '/landing/hero.png',
  cta:  'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=1200&q=80&auto=format&fit=crop',
};

// Video URLs — configurable via env so the team can update without code change.
// Default: YouTube placeholder ("dQw4w9WgXcQ" — replace with real demo when ready).
// Set VITE_LANDING_DEMO_VIDEO_URL and VITE_LANDING_STORY_VIDEO_URL in .env to override.
const VIDEO_DEMO_URL  = ((import.meta as any).env?.VITE_LANDING_DEMO_VIDEO_URL  as string | undefined) ?? '';
const VIDEO_STORY_URL = ((import.meta as any).env?.VITE_LANDING_STORY_VIDEO_URL as string | undefined) ?? '';

// Convert YouTube / Vimeo URLs to embed format. Returns the original URL if
// it's already an embed or an unsupported format.
function toEmbedUrl(url: string): string {
  if (!url) return '';
  if (/\/embed\//.test(url) || /player\.vimeo\.com/.test(url)) return url;
  // youtu.be/ID
  const ytShort = url.match(/youtu\.be\/([\w-]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}?autoplay=1&rel=0`;
  // youtube.com/watch?v=ID  OR  /shorts/ID
  const yt = url.match(/youtube\.com\/(?:watch\?v=|shorts\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  // vimeo.com/ID
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED PRODUCT MOCKUPS (Niveau 1: pure CSS, no extra dependencies)
// Replaces the static Unsplash images with realistic UI showing the product
// in action. Each component is self-contained and animation-loops naturally.
// ─────────────────────────────────────────────────────────────────────────────

// Hero — compact phone-style chat showing a customer + AI conversation. The
// bubbles fade-in sequentially via staggered animation-delay. After ~6s the
// component re-mounts via parent `key` prop so the loop restarts visibly.
function HeroChatMockup() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const messages = [
    { side: 'in',  text: 'Hi, do you have the new Nike Air Max in size 42?', delay: 0.3 },
    { side: 'out', text: 'Hey 👋 Yes, we have 3 in stock at the Lekki store. $189. Want me to reserve one for you?', delay: 1.2 },
    { side: 'in',  text: 'Yes please! Can you send me the invoice?', delay: 2.6 },
    { side: 'out', text: '✅ Done — invoice sent to your email and 1 pair held under your name. Pickup before Saturday 6pm.', delay: 3.6 },
  ];

  return (
    <div key={tick} style={{
      width: '100%', aspectRatio: '4/3', borderRadius: 24, padding: 18,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      boxShadow: `0 50px 100px -30px ${C.ink}40`,
      display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden',
    }}>
      {/* WhatsApp-like header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#075e54', borderRadius: 14, color: '#fff' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>O</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Orlode AI · Sales</div>
          <div style={{ fontSize: 10, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#25D366', display: 'inline-block' }} />
            online · répond en 2 sec
          </div>
        </div>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {messages.map((m, i) => (
          <div key={i} className="lv2-bubble" style={{
            animationDelay: `${m.delay}s`,
            alignSelf: m.side === 'in' ? 'flex-start' : 'flex-end',
            maxWidth: '78%',
            background: m.side === 'in' ? '#fff' : '#dcf8c6',
            color: '#111',
            padding: '8px 12px',
            borderRadius: m.side === 'in' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
            fontSize: 12.5,
            lineHeight: 1.4,
            boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
          }}>{m.text}</div>
        ))}
        {/* Final typing bubble for "the conversation continues" feel */}
        <div className="lv2-bubble" style={{ animationDelay: '5s', alignSelf: 'flex-start', background: '#fff', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
          <span className="lv2-typing-dot" /><span className="lv2-typing-dot" /><span className="lv2-typing-dot" />
        </div>
      </div>
    </div>
  );
}

// Feature 2 — grid of 12 agent tiles. Tiles light up sequentially (pulse) to
// communicate "30+ agents, all working together".
function AgentsGridMockup() {
  const tiles = [
    { e: '💼', n: 'Sales',     c: '#7C3AED' },
    { e: '📣', n: 'Marketing', c: '#EC4899' },
    { e: '📧', n: 'Comms',     c: '#0EA5E9' },
    { e: '🎫', n: 'Support',   c: '#F59E0B' },
    { e: '💰', n: 'Accounting',c: '#059669' },
    { e: '👥', n: 'HR',        c: '#8B5CF6' },
    { e: '🛎️', n: 'Reception', c: '#06B6D4' },
    { e: '🛡️', n: 'Cyber',     c: '#EF4444' },
    { e: '📚', n: 'Knowledge', c: '#0284C7' },
    { e: '✅', n: 'Approval',  c: '#10B981' },
    { e: '📊', n: 'Insights',  c: '#D97706' },
    { e: '⚖️', n: 'Legal',     c: '#475569' },
  ];
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % tiles.length), 1200);
    return () => clearInterval(id);
  }, [tiles.length]);

  return (
    <div className="feature-img" style={{
      padding: 24, background: 'linear-gradient(135deg, #FEF3C7 0%, #FCE7F3 50%, #EDE9FE 100%)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, letterSpacing: '0.05em' }}>🤖 ORLODE AGENTS · LIVE</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#10B981', padding: '3px 10px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} className="lv2-glow" />
          {tiles[active].n} · working…
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flex: 1 }}>
        {tiles.map((t, i) => {
          const isActive = i === active;
          return (
            <div
              key={i}
              className={`lv2-agent-tile ${isActive ? 'lv2-agent-active' : ''}`}
              style={{
                animationDelay: `${i * 0.05}s`,
                background: isActive ? `${t.c}` : '#fff',
                color: isActive ? '#fff' : t.c,
                borderRadius: 12,
                padding: '12px 8px',
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 700,
                boxShadow: isActive ? `0 8px 24px -4px ${t.c}80` : '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease',
                border: `1.5px solid ${isActive ? t.c : 'rgba(0,0,0,0.05)'}`,
              }}
            >
              <div>{t.e}</div>
              <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, opacity: isActive ? 1 : 0.7 }}>{t.n}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.7)', borderRadius: 10, backdropFilter: 'blur(8px)' }}>
        <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>30+ agents disponibles · 4-10 par pack</span>
        <span style={{ fontSize: 11, color: C.violet, fontWeight: 800 }}>Voir tous →</span>
      </div>
    </div>
  );
}

// Feature 3 — compliance dashboard with score gauge + alerts feed
function DashboardMockup() {
  const [score, setScore] = React.useState(72);
  React.useEffect(() => {
    const id = setInterval(() => setScore(s => Math.min(98, s + 1)), 200);
    return () => clearInterval(id);
  }, []);
  const alerts = [
    { sev: 'OK',    txt: 'GDPR audit log exported · 1,420 entries · 00:34', c: '#10B981' },
    { sev: 'INFO',  txt: 'Compliance scan completed · ISO 27001 · 96/100',   c: '#0EA5E9' },
    { sev: 'WARN',  txt: '2 SOC 2 controls need review (low priority)',       c: '#F59E0B' },
    { sev: 'OK',    txt: 'Cyber agent · 0 phishing attempts blocked today',   c: '#10B981' },
  ];
  return (
    <div className="feature-img" style={{
      padding: 20, background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
      color: '#fff', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em' }}>🛡️ COMPLIANCE DASHBOARD · LIVE</div>
        <span style={{ fontSize: 10, fontWeight: 700, background: '#10B981', padding: '3px 8px', borderRadius: 100 }} className="lv2-glow">SECURED</span>
      </div>
      {/* Score gauge */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>Compliance score</span>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 800, color: '#10B981' }}>{score}<span style={{ fontSize: 14, opacity: 0.6 }}>/100</span></span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 100, overflow: 'hidden' }}>
          <div className="lv2-bar" style={{ width: `${score}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 100 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          {[
            { l: 'GDPR',     v: 98 },
            { l: 'ISO 27001', v: 96 },
            { l: 'SOC 2',    v: 89 },
            { l: 'NIST CSF', v: 92 },
          ].map((s, i) => (
            <div key={i} className="lv2-stat" style={{ animationDelay: `${i * 0.15}s`, flex: 1, textAlign: 'center', padding: '6px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#34D399' }}>{s.v}</div>
              <div style={{ fontSize: 9, opacity: 0.6, fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Alerts feed */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, letterSpacing: '0.05em' }}>RECENT ACTIVITY</div>
        {alerts.map((a, i) => (
          <div key={i} className="lv2-alert" style={{
            animationDelay: `${0.4 + i * 0.18}s`,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 10,
            borderLeft: `3px solid ${a.c}`,
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: a.c, padding: '2px 6px', background: `${a.c}20`, borderRadius: 4, minWidth: 36, textAlign: 'center' }}>{a.sev}</span>
            <span style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.3 }}>{a.txt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reusable video card. Renders a stylized poster + play button until clicked,
// then swaps in the actual iframe (lazy load = saves ~1MB on initial page).
// If no URL is provided, shows a "Demo coming soon" state instead of broken
// iframe — useful while the team is filming the real videos.
function VideoCard({
  url, title, subtitle, posterFrom = '#5B21B6', posterTo = '#0F172A',
  duration, badge,
}: {
  url: string; title: string; subtitle?: string;
  posterFrom?: string; posterTo?: string;
  duration?: string; badge?: string;
}) {
  const [playing, setPlaying] = React.useState(false);
  const embedUrl = toEmbedUrl(url);
  const hasVideo = !!embedUrl;

  return (
    <div style={{
      width: '100%', borderRadius: 24, overflow: 'hidden',
      background: `linear-gradient(135deg, ${posterFrom}, ${posterTo})`,
      aspectRatio: '16/9', position: 'relative', cursor: hasVideo ? 'pointer' : 'default',
      boxShadow: `0 40px 80px -20px ${C.ink}40`,
    }}
      onClick={() => hasVideo && setPlaying(true)}>
      {/* Decorative dot grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        <pattern id="vidDots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#fff" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#vidDots)" />
      </svg>

      {playing && embedUrl ? (
        <iframe
          src={embedUrl}
          title={title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          {/* Title overlay top */}
          <div style={{ position: 'absolute', top: 24, left: 24, right: 24, color: '#fff' }}>
            {badge && (
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: 100, marginBottom: 12 }}>
                {badge}
              </span>
            )}
            <h3 className="display" style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, maxWidth: '70%' }}>
              {title}
            </h3>
            {subtitle && <p style={{ fontSize: 14, opacity: 0.8, margin: '6px 0 0', maxWidth: '70%' }}>{subtitle}</p>}
          </div>

          {/* Big play button center */}
          <button
            onClick={() => hasVideo && setPlaying(true)}
            disabled={!hasVideo}
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 92, height: 92, borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: hasVideo ? 'pointer' : 'not-allowed',
              boxShadow: hasVideo ? '0 20px 50px -10px rgba(0,0,0,0.5)' : 'none',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { if (hasVideo) e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)'; }}
            onMouseOut={e => { if (hasVideo) e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'; }}>
            <PlayCircle size={56} fill={hasVideo ? C.violet : '#94A3A0'} color="#fff" strokeWidth={1.5} />
          </button>

          {/* Bottom strip: duration + "Watch demo" */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px 24px',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.5))',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: '#fff',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
              {hasVideo ? `▶ Lancer la vidéo${duration ? ` · ${duration}` : ''}` : '🎬 Vidéo bientôt disponible'}
            </span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{hasVideo ? 'HD · sans son par défaut' : 'En production'}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function LandingV2Page() {
  const { lang, setLang } = useLangStore();
  const t = (key: string) => lv2T(key, lang as LV2Lang);
  const [mobileMenu, setMobileMenu] = React.useState(false);

  useEffect(() => {
    document.title = 'Orlode AI — The AI operating system for modern businesses';
  }, []);

  // Close mobile menu when window resizes back to desktop
  React.useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMobileMenu(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    document.body.style.overflow = mobileMenu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenu]);

  return (
    <div className="lv2">
      <style>{GLOBAL_STYLES}</style>

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, fontWeight: 800, fontSize: 16 }}>O</div>
            <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>Orlode</span>
          </Link>
          <div className="nav-links" style={{ display: 'flex', gap: 4 }}>
            <a href="#features" className="nav-link">{t('nav.products')}</a>
            <a href="#pricing" className="nav-link">{t('nav.pricing')}</a>
            <Link to="/talents" className="nav-link">Talents</Link>
            <Link to="/influenceurs" className="nav-link">Influenceurs</Link>
            <Link to="/marketplace" className="nav-link">{t('nav.marketplace')}</Link>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Language picker — hidden on mobile (lives in the menu instead) */}
            <select
              value={lang}
              onChange={e => setLang(e.target.value as LangCode)}
              aria-label="Language"
              className="nav-links"
              style={{
                background: 'transparent', border: `1px solid ${C.ink}15`, borderRadius: 8,
                padding: '6px 8px', fontSize: 13, color: C.ink, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>
              ))}
            </select>
            <Link to="/login" className="nav-link nav-links">{t('nav.login')}</Link>
            <Link to="/login" className="btn-primary nav-links" style={{ padding: '10px 18px', fontSize: 13 }}>
              {t('nav.cta')} <ArrowRight size={14} />
            </Link>
            {/* Mobile hamburger — only shown <=768px via .lv2-mobile-show */}
            <button
              className="lv2-mobile-show"
              onClick={() => setMobileMenu(true)}
              aria-label="Open menu"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, color: C.ink }}>
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenu && (
        <div className="lv2-mobile-menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Link to="/" onClick={() => setMobileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream, fontWeight: 800, fontSize: 16 }}>O</div>
              <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>Orlode</span>
            </Link>
            <button onClick={() => setMobileMenu(false)} aria-label="Close menu"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, color: C.ink }}>
              <XIcon size={22} />
            </button>
          </div>
          <a onClick={() => setMobileMenu(false)} href="#features">{t('nav.products')}</a>
          <a onClick={() => setMobileMenu(false)} href="#pricing">{t('nav.pricing')}</a>
          <Link onClick={() => setMobileMenu(false)} to="/talents">Talents</Link>
          <Link onClick={() => setMobileMenu(false)} to="/influenceurs">Influenceurs</Link>
          <Link onClick={() => setMobileMenu(false)} to="/marketplace">{t('nav.marketplace')}</Link>
          <Link onClick={() => setMobileMenu(false)} to="/login">{t('nav.login')}</Link>
          <div style={{ marginTop: 20 }}>
            <select
              value={lang}
              onChange={e => setLang(e.target.value as LangCode)}
              aria-label="Language"
              style={{ width: '100%', background: 'transparent', border: `1px solid ${C.ink}15`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
          <Link onClick={() => setMobileMenu(false)} to="/login" className="btn-primary" style={{ marginTop: 16, justifyContent: 'center', fontSize: 15 }}>
            {t('nav.cta')} <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0 100px' }}>
        <div className="container">
          <div className="grid-2">
            <div className="fade-in">
              <span className="pill">
                <Sparkles size={12} fill={C.violetDeep} /> {t('hero.badge')}
              </span>
              <h1 className="display h1" style={{ marginTop: 24 }}>
                {t('hero.title.l1')}<br />{t('hero.title.l2')} <em>{t('hero.title.em')}</em><br />{t('hero.title.l3')}<br />{t('hero.title.l4')}
              </h1>
              <p className="lead" style={{ marginTop: 24, maxWidth: 480 }}>
                {t('hero.lead')}
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                <Link to="/login" className="btn-primary">
                  {t('hero.cta.primary')} <ArrowRight size={16} />
                </Link>
                <Link to="/marketplace" className="btn-secondary">
                  <PlayCircle size={16} /> {t('hero.cta.demo')}
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 40, flexWrap: 'wrap' }}>
                {[
                  { v: '30+', l: t('hero.stat1.lbl') },
                  { v: '$20', l: t('hero.stat2.lbl') },
                  { v: '24/7', l: t('hero.stat3.lbl') },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.ink, fontFamily: 'Fraunces' }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="fade-in" style={{ animationDelay: '0.15s' }}>
              <div style={{ position: 'relative' }}>
                <VerticalsMosaic />
                {/* Hidden fallback img kept for OG / accessibility */}
                <img src={IMG.hero} alt="" style={{ display: 'none' }} />
                {/* Floating badge bottom-left */}
                <div className="lv2-hero-badge-bl" style={{ position: 'absolute', bottom: -20, left: -20, background: C.cream, borderRadius: 16, padding: '14px 18px', boxShadow: `0 20px 40px -10px ${C.ink}30`, border: `1px solid ${C.ink}08`, display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.emerald}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={18} color={C.emeraldDeep} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>Sales agent · Live</div>
                    <div style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>1 sale closed · just now</div>
                  </div>
                </div>
                {/* Floating badge top-right — adds visual richness */}
                <div className="lv2-hero-badge-tl" style={{ position: 'absolute', top: -16, right: -16, background: C.cream, borderRadius: 14, padding: '10px 14px', boxShadow: `0 16px 32px -8px ${C.ink}25`, border: `1px solid ${C.ink}08`, display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.emerald }} className="lv2-glow" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>30+ agents online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────────── */}
      <section style={{ background: C.creamDeep, padding: '40px 0' }}>
        <div className="container">
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>
            {t('trust.txt')}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, flexWrap: 'wrap', opacity: 0.7 }}>
            {['💳 Stripe', '🅿️ PayPal', '💚 WhatsApp', '✈️ Telegram', '#️⃣ Slack', '📧 Gmail', '🗓️ Calendar', '🎨 Notion'].map(l => (
              <span key={l} style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIDEO 1 — Product demo ───────────────────────────────────────── */}
      <section style={{ padding: '80px 0 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
            <span className="pill"><PlayCircle size={12} fill={C.violetDeep} /> {t('video1.badge')}</span>
            <h2 className="display h2" style={{ marginTop: 16 }}>
              {t('video1.title')}
            </h2>
            <p className="lead" style={{ marginTop: 12 }}>
              {t('video1.lead')}
            </p>
          </div>
          <VideoCard
            url={VIDEO_DEMO_URL}
            title={t('video1.title')}
            subtitle={t('video1.lead')}
            posterFrom={C.violetDeep}
            posterTo={C.ink}
            duration="1:32"
            badge="🎥 PRODUCT DEMO"
          />
        </div>
      </section>

      {/* ── FEATURE 1 — image LEFT ───────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 0' }}>
        <div className="container">
          <div className="grid-2">
            <HeroChatMockup />
            <div>
              <span className="pill" style={{ background: `${C.emerald}10`, color: C.emeraldDeep, borderColor: `${C.emerald}30` }}>
                <MessageSquare size={12} /> {t('f1.badge')}
              </span>
              <h2 className="display h2" style={{ marginTop: 16 }}>
                {t('f1.title.l1')}<br />{t('f1.title.bot')} <em>{t('f1.title.em')}</em>{t('f1.title.l2')}
              </h2>
              <p className="lead" style={{ marginTop: 16 }}>
                {t('f1.lead')}
              </p>
              <ul className="check">
                <li><Check size={16} /> {t('f1.li1')}</li>
                <li><Check size={16} /> {t('f1.li2')}</li>
                <li><Check size={16} /> {t('f1.li3')}</li>
                <li><Check size={16} /> {t('f1.li4')}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE 2 — image RIGHT ─────────────────────────────────────── */}
      <section style={{ padding: '0 0 100px', background: C.creamDeep }}>
        <div className="container" style={{ paddingTop: 100 }}>
          <div className="grid-2">
            <div>
              <span className="pill" style={{ background: `${C.violet}10`, color: C.violetDeep, borderColor: `${C.violet}30` }}>
                <Bot size={12} /> {t('f2.badge')}
              </span>
              <h2 className="display h2" style={{ marginTop: 16 }}>
                {t('f2.title.l1')}<br />{t('f2.title.l2')} <em>{t('f2.title.em')}</em>{t('f2.title.l3')}
              </h2>
              <p className="lead" style={{ marginTop: 16 }}>
                {t('f2.lead')}
              </p>
              <ul className="check">
                <li><Check size={16} /> Pack PME — 4 agents — $20/mo</li>
                <li><Check size={16} /> 7 packs verticaux WhatsApp (Boutique, Restaurant, Hôtel, Résidence, Salon, Cabinet, Immobilier) — $20/mo</li>
                <li><Check size={16} /> Super Pack Enterprise — 10 agents — $45/mo (-25%)</li>
                <li><Check size={16} /> Add-on à $5/mo</li>
              </ul>
              <Link to="/marketplace" className="btn-secondary" style={{ marginTop: 24 }}>
                {t('f2.cta')} <ChevronRight size={16} />
              </Link>
            </div>
            <AgentsGridMockup />
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div className="grid-3">
            {[
              { n: '30+',    l: t('stats.s1'), i: Bot },
              { n: '24/7',   l: t('stats.s2'), i: MessageSquare },
              { n: '7 days', l: t('stats.s3'), i: Zap },
            ].map((s, i) => {
              const Icon = s.i;
              return (
                <div key={i} className="card" style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `${C.violet}15`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon size={28} color={C.violet} />
                  </div>
                  <div className="stat-num">{s.n}</div>
                  <div className="stat-lbl">{s.l}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── VIDEO 2 — Customer story ─────────────────────────────────────── */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container">
          <div className="grid-2">
            <div>
              <span className="pill" style={{ background: `${C.gold}15`, color: C.gold, borderColor: `${C.gold}40` }}>
                <Star size={12} fill={C.gold} /> {t('v2.badge')}
              </span>
              <h2 className="display h2" style={{ marginTop: 16 }}>
                {t('v2.title.l1')}<br />{t('v2.title.l2')} <em>{t('v2.title.em')}</em><br />{t('v2.title.l3')}
              </h2>
              <p className="lead" style={{ marginTop: 16 }}>
                {t('v2.lead')}
              </p>
              <div style={{ display: 'flex', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
                {[
                  { v: t('v2.s1.v'), l: t('v2.s1.l') },
                  { v: t('v2.s2.v'), l: t('v2.s2.l') },
                  { v: t('v2.s3.v'), l: t('v2.s3.l') },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: 'Fraunces', fontSize: 32, fontWeight: 800, color: C.violet, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <VideoCard
              url={VIDEO_STORY_URL}
              title={t('v2.title.video')}
              subtitle={t('v2.subtitle.video')}
              posterFrom="#D97706"
              posterTo="#7C2D12"
              duration="3:14"
              badge="⭐ STORY"
            />
          </div>
        </div>
      </section>

      {/* ── FEATURE 3 — image LEFT ──────────────────────────────────────── */}
      <section style={{ padding: '0 0 100px' }}>
        <div className="container">
          <div className="grid-2">
            <DashboardMockup />
            <div>
              <span className="pill" style={{ background: `${C.gold}15`, color: C.gold, borderColor: `${C.gold}40` }}>
                <BarChart3 size={12} /> {t('f3.badge')}
              </span>
              <h2 className="display h2" style={{ marginTop: 16 }}>
                {t('f3.title.l1')} <em>{t('f3.title.em')}</em>{t('f3.title.l2')}
              </h2>
              <p className="lead" style={{ marginTop: 16 }}>
                {t('f3.lead')}
              </p>
              <ul className="check">
                <li><Check size={16} /> Audit logs exportables CSV/PDF pour auditeurs</li>
                <li><Check size={16} /> Compliance live : score GDPR / ISO 27001 / SOC 2 / NIST CSF / HIPAA</li>
                <li><Check size={16} /> SIEM intégré, détection phishing, monitoring vulnérabilités</li>
                <li><Check size={16} /> BYOE : héberge sur ton propre projet cloud (Firebase / GCP / AWS)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERTICALES MÉTIER ─────────────────────────────────────────────
           7 packs verticaux livrés en prod : commerce, restaurant, hôtel,
           résidence, salon, cabinet (multi-profil), immobilier. Chaque carte
           ouvre une page d'activation dédiée avec WhatsApp + Telegram natifs. */}
      <section id="verticales" style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 60px' }}>
            <span className="pill" style={{ background: `${C.emerald}10`, color: C.emeraldDeep, borderColor: `${C.emerald}30` }}>
              <Sparkles size={12} fill={C.emeraldDeep} /> 7 packs livrés
            </span>
            <h2 className="display h2" style={{ marginTop: 16 }}>
              Un pack <em>par métier</em>. <em>WhatsApp + Telegram</em> au cœur.
            </h2>
            <div style={{ marginTop: 18, display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: '#25D36615', color: '#128C7E', letterSpacing: '0.04em' }}>● WHATSAPP BUSINESS</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: '#0088CC15', color: '#006699', letterSpacing: '0.04em' }}>● TELEGRAM BOT</span>
              <span style={{ fontSize: 11, color: C.inkSoft }}>inbox unifié dans chaque pack</span>
            </div>
            <p className="lead" style={{ marginTop: 12 }}>
              Choisis ta verticale — interface dédiée, agents pré-configurés, <strong>$20/mo</strong> par pack.
              Tu peux activer plusieurs packs en parallèle (ex. boutique + restaurant pour un complexe hôtelier).
            </p>
          </div>

          <div className="vert-grid">
            {[
              { emoji: '🛍',  title: 'Boutique',    pitch: 'Vends sur WhatsApp & Telegram avec une photo. Catalogue + commandes + paiement.', color: C.emerald,  bg: '#10B98115', deepColor: C.emeraldDeep, href: '/agents/commerce' },
              { emoji: '🍽',  title: 'Restaurant',  pitch: 'Menu, commandes, réservations, KDS cuisine — WhatsApp & Telegram.',              color: '#F97316',  bg: '#F9731615', deepColor: '#C2410C',     href: '/agents/restaurant' },
              { emoji: '🏨',  title: 'Hôtel',       pitch: 'Chambres et séjours — réservation multi-nuits sur WhatsApp & Telegram.',         color: '#0EA5E9',  bg: '#0EA5E915', deepColor: '#0369A1',     href: '/agents/hotel' },
              { emoji: '🏢',  title: 'Résidence',   pitch: 'Studios, F2, F3 — locations courte & longue durée, calendrier dispo.',            color: '#6366F1',  bg: '#6366F115', deepColor: '#4338CA',     href: '/agents/residence' },
              { emoji: '💇',  title: 'Salon',       pitch: 'Coiffure, beauté, esthétique — RDV pris automatiquement, fidélité intégrée.',     color: C.pink,     bg: '#EC489915', deepColor: '#DB2777',     href: '/agents/service' },
              { emoji: '🩺',  title: 'Cabinet',     pitch: 'Médecin, dentiste, avocat, notaire, comptable, véto — 1 page, 6 profils.',        color: '#14B8A6',  bg: '#14B8A615', deepColor: '#0F766E',     href: '/agents/cabinet' },
              { emoji: '🏠',  title: 'Immobilier',  pitch: 'Biens et visites — qualif leads + agenda sur WhatsApp & Telegram.',               color: C.violet,   bg: '#7C3AED15', deepColor: C.violetDeep,  href: '/agents/realestate' },
            ].map(p => (
              <Link key={p.title} to={p.href} className="vert-card" style={{ borderColor: `${p.color}25` }}>
                <div className="vert-icon" style={{ background: p.bg, color: p.deepColor }}>
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                </div>
                <h3 className="display" style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: '14px 0 6px', letterSpacing: '-0.01em' }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 13, color: C.inkSoft, margin: 0, lineHeight: 1.5, flex: 1 }}>
                  {p.pitch}
                </p>
                <div className="vert-cta" style={{ color: p.deepColor }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>$20/mo</span>
                  <span className="vert-arrow"><ChevronRight size={16} /></span>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48, color: C.inkSoft, fontSize: 13 }}>
            Tu cherches plutôt un bundle <strong>Sales+Comms+Marketing+Support</strong> ?{' '}
            <a href="#pricing" style={{ color: C.violetDeep, fontWeight: 700, textDecoration: 'none' }}>
              Voir les packs cross-cutting ↓
            </a>
          </div>
        </div>

        <style>{`
          .lv2 .vert-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .lv2 .vert-card {
            background: ${C.cream}; border-radius: 20px; padding: 26px;
            border: 1.5px solid; cursor: pointer; text-decoration: none;
            display: flex; flex-direction: column; min-height: 220px;
            transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          }
          .lv2 .vert-card:hover { transform: translateY(-6px); }
          .lv2 .vert-icon {
            width: 56px; height: 56px; border-radius: 14px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 8px 18px -8px rgba(10,42,32,0.18);
          }
          .lv2 .vert-cta {
            margin-top: 16px; padding-top: 14px;
            border-top: 1px solid ${C.ink}08;
            display: flex; align-items: center; justify-content: space-between;
            font-family: 'JetBrains Mono', monospace;
          }
          .lv2 .vert-arrow {
            display: inline-flex; align-items: center; justify-content: center;
            width: 28px; height: 28px; border-radius: 8px;
            background: ${C.creamDeep}; color: ${C.inkSoft};
            transition: transform 0.2s ease;
          }
          .lv2 .vert-card:hover .vert-arrow { transform: translateX(3px); }
          @media (max-width: 900px) { .lv2 .vert-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 600px) { .lv2 .vert-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>

      {/* ── MARKETPLACES (Talents + Influenceurs) ───────────────────────── */}
      <section style={{ padding: '100px 0', background: C.ink, color: C.cream, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 30% 20%, #0F5C3F40, transparent 55%), radial-gradient(ellipse at 75% 80%, #6366F140, transparent 55%)`,
          pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 60px' }}>
            <span className="pill" style={{
              background: 'rgba(212, 165, 116, 0.12)',
              color: '#E8C9A0',
              border: '1px solid #D4A57440',
            }}>
              <Sparkles size={12} /> Orlode Marketplaces · Global
            </span>
            <h2 className="display h2" style={{ marginTop: 16, color: C.cream }}>
              Au-delà des agents IA. <em style={{ fontStyle: 'italic', color: '#E8C9A0' }}>Une marketplace humaine.</em>
            </h2>
            <p className="lead" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 12 }}>
              Recrute du talent en vidéo ou collabore avec des créateurs vérifiés. Sans intermédiaire, contact WhatsApp direct.
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20,
            maxWidth: 1080, margin: '0 auto',
          }} className="mp-grid">
            {[
              {
                to: '/talents',
                badge: 'GLOBAL · 20+ pays',
                title: 'Orlode Talents',
                em: 'Recrute en vidéo.',
                desc: '1 minute pour montrer qui tu es. Les entreprises te trouvent par ce que tu sais vraiment faire — pas par ton CV.',
                cta: 'Explorer le feed',
                bullets: ['Vidéo brute 1 min', 'Contact WhatsApp direct', 'Pas de commission'],
                grad: 'linear-gradient(155deg, #0F5C3F 0%, #063322 70%, #D4A574 100%)',
                accent: '#7FCAA6',
              },
              {
                to: '/influenceurs',
                badge: 'GLOBAL · Bêta',
                title: 'Orlode Influenceurs',
                em: 'Marques ↔ créateurs.',
                desc: 'Les marques cliquent sur tes liens publics, vérifient elles-mêmes ton audience. Tu négocies les briefs sans agence.',
                cta: 'Voir l\'annuaire',
                bullets: ['Profils vérifiés humainement', 'Briefs WhatsApp direct', '0 % de commission'],
                grad: 'linear-gradient(155deg, #6366F1 0%, #4F46E5 70%, #D4A574 100%)',
                accent: '#A5B4FC',
              },
            ].map(m => (
              <Link key={m.to} to={m.to} style={{
                display: 'block',
                background: m.grad,
                borderRadius: 24,
                padding: 32,
                color: C.cream,
                textDecoration: 'none',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 50px -15px rgba(0,0,0,0.4)',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              }} className="mp-card">
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  color: m.accent, marginBottom: 16,
                  textTransform: 'uppercase',
                }}>
                  {m.badge}
                </div>
                <h3 className="display" style={{
                  fontSize: 'clamp(28px, 3.5vw, 38px)', fontWeight: 800,
                  letterSpacing: '-0.025em', lineHeight: 1.05,
                  margin: '0 0 8px', color: C.cream,
                }}>
                  {m.title}
                </h3>
                <div className="display" style={{
                  fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: 600,
                  fontStyle: 'italic', color: m.accent,
                  margin: '0 0 18px',
                }}>
                  {m.em}
                </div>
                <p style={{
                  fontSize: 15, color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.6, margin: '0 0 22px',
                }}>
                  {m.desc}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {m.bullets.map(b => (
                    <li key={b} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 13, color: 'rgba(255,255,255,0.9)',
                      padding: '6px 0',
                    }}>
                      <Check size={14} color={m.accent} />
                      {b}
                    </li>
                  ))}
                </ul>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(20px)',
                  padding: '10px 18px', borderRadius: 100,
                  fontSize: 14, fontWeight: 600, color: C.cream,
                }}>
                  {m.cta} <ArrowRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        </div>
        <style>{`
          .lv2 .mp-card:hover { transform: translateY(-4px); box-shadow: 0 30px 60px -15px rgba(0,0,0,0.5); }
          @media (max-width: 900px) { .lv2 .mp-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '100px 0', background: C.creamDeep }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 60px' }}>
            <span className="pill"><Sparkles size={12} fill={C.violetDeep} /> Bundles cross-cutting</span>
            <h2 className="display h2" style={{ marginTop: 16 }}>
              Pas une verticale ? <em>Compose</em> ton équipe d'agents.
            </h2>
            <p className="lead" style={{ marginTop: 12 }}>
              Pour les PME multi-services et les grandes équipes, on regroupe les agents transversaux (Sales, Comms, Compta, Support) en bundles. Bring Your Own Everything. Annule à tout moment.
            </p>
          </div>

          <div className="grid-3">
            {/* Pack PME */}
            <div className="price-card">
              <div style={{ fontSize: 32 }}>🚀</div>
              <h3 className="display h3" style={{ marginTop: 12 }}>Pack PME</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Vente · Comms · Marketing · Support</p>
              <div style={{ marginTop: 20 }}>
                <span style={{ fontFamily: 'Fraunces', fontSize: 48, fontWeight: 800, color: C.ink }}>$20</span>
                <span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 500 }}> /mo</span>
              </div>
              <ul className="check">
                <li><Check size={16} /> 4 agents inclus</li>
                <li><Check size={16} /> WhatsApp + Email + Telegram</li>
                <li><Check size={16} /> Pipeline CRM intégré</li>
                <li><Check size={16} /> Support beta réactif</li>
              </ul>
              <Link to="/marketplace" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}>
                Choisir <ChevronRight size={16} />
              </Link>
            </div>

            {/* Pack Entreprise — featured */}
            <div className="price-card featured">
              <span className="price-tag">RECOMMANDÉ</span>
              <div style={{ fontSize: 32 }}>🏢</div>
              <h3 className="display h3" style={{ marginTop: 12 }}>Pack Entreprise</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>Sales · Compta · Support · Comms</p>
              <div style={{ marginTop: 20 }}>
                <span style={{ fontFamily: 'Fraunces', fontSize: 48, fontWeight: 800, color: C.ink }}>$20</span>
                <span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 500 }}> /mo</span>
              </div>
              <ul className="check">
                <li><Check size={16} /> 4 agents inclus</li>
                <li><Check size={16} /> Devis & factures multi-devises</li>
                <li><Check size={16} /> Multi-utilisateurs</li>
                <li><Check size={16} /> Support email prioritaire</li>
              </ul>
              <Link to="/marketplace" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}>
                Choisir <ChevronRight size={16} />
              </Link>
            </div>

            {/* Super Pack */}
            <div className="price-card">
              <div style={{ fontSize: 32 }}>👑</div>
              <h3 className="display h3" style={{ marginTop: 12 }}>Super Pack</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 4 }}>10 agents · Tout-en-un</p>
              <div style={{ marginTop: 20 }}>
                <span style={{ fontSize: 14, color: C.inkLight, textDecoration: 'line-through', marginRight: 6 }}>$60</span>
                <span style={{ fontFamily: 'Fraunces', fontSize: 48, fontWeight: 800, color: C.ink }}>$45</span>
                <span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 500 }}> /mo</span>
              </div>
              <ul className="check">
                <li><Check size={16} /> Tous les 10 agents flagship</li>
                <li><Check size={16} /> Knowledge brain (RAG sur tous tes docs)</li>
                <li><Check size={16} /> Workflows d'approbation</li>
                <li><Check size={16} /> Économie -25% vs séparé</li>
              </ul>
              <Link to="/marketplace" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}>
                Choisir <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section id="testimonials" style={{ padding: '100px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 60px' }}>
            <span className="pill"><Star size={12} fill={C.violetDeep} /> {t('tm.badge')}</span>
            <h2 className="display h2" style={{ marginTop: 16 }}>
              {t('tm.title.l1')} <em>{t('tm.title.em')}</em> {t('tm.title.l2')}<br />{t('tm.title.l3')}
            </h2>
          </div>
          <div className="grid-3">
            {[
              { n: 'Sophie K.',  r: 'Fashion brand · Founder',          q: 'Mes clientes reçoivent des réponses en 30 secondes même la nuit. CA +35% en 2 mois.' },
              { n: 'D. Marko',   r: 'Restaurant chain · Operations',    q: 'L\'agent prend les commandes, gère les livraisons, envoie les promos. Mes équipes sont libres pour servir en salle.' },
              { n: 'A. Garcia',  r: 'Real estate · Lead Broker',         q: 'Devis créé et envoyé par mail + WhatsApp en parallèle, signé en 3 minutes. Magique.' },
            ].map((t, i) => (
              <div key={i} className="testimonial">
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {[...Array(5)].map((_, j) => <Star key={j} size={14} fill={C.gold} color={C.gold} />)}
                </div>
                <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.6, margin: '0 0 16px' }}>« {t.q} »</p>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.n}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{t.r}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BIG CTA ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 0 100px' }}>
        <div className="container">
          <div className="card-dark" style={{
            backgroundImage: `linear-gradient(135deg, ${C.violetDeep}f0, ${C.ink}f5), url(${IMG.cta})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}>
            <div style={{ maxWidth: 600 }}>
              <span className="pill" style={{ background: `${C.cream}15`, color: C.cream, borderColor: `${C.cream}30` }}>
                <Sparkles size={12} /> {t('cta.badge')}
              </span>
              <h2 className="display h2" style={{ marginTop: 20, color: C.cream }}>
                {t('cta.title.l1')}<br />{t('cta.title.l2')} <em style={{ color: C.gold }}>{t('cta.title.em')}</em>{t('cta.title.l3')}
              </h2>
              <p style={{ fontSize: 18, color: 'rgba(255,250,240,0.8)', marginTop: 16, lineHeight: 1.5 }}>
                {t('cta.lead')}
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
                <Link to="/login" className="btn-primary" style={{ background: C.cream, color: C.ink }}>
                  {t('cta.primary')} <ArrowRight size={16} />
                </Link>
                <Link to="/marketplace" className="btn-secondary" style={{ borderColor: 'rgba(255,250,240,0.3)', color: C.cream }}>
                  <Globe size={16} /> {t('cta.market')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.ink}10`, padding: '60px 0 30px', background: C.creamDeep }}>
        <div className="container">
          {/* Top: brand + newsletter */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 60, alignItems: 'flex-start', marginBottom: 48 }} className="lv2-footer-top">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`, color: C.cream, fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>O</div>
                <span className="display" style={{ fontSize: 22, fontWeight: 800 }}>Orlode</span>
              </div>
              <p style={{ fontSize: 14, color: C.inkSoft, maxWidth: 360, lineHeight: 1.6, margin: 0 }}>{t('foot.tagline')}</p>
              {/* Social icons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                {[
                  { i: Twitter,   href: 'https://twitter.com/orlode',   l: 'Twitter / X' },
                  { i: Linkedin,  href: 'https://linkedin.com/company/orlode', l: 'LinkedIn' },
                  { i: Youtube,   href: 'https://youtube.com/@orlode',  l: 'YouTube' },
                  { i: Instagram, href: 'https://instagram.com/orlode', l: 'Instagram' },
                  { i: Facebook,  href: 'https://facebook.com/orlode',  l: 'Facebook' },
                  { i: Github,    href: 'https://github.com/orlode',    l: 'GitHub' },
                ].map(s => {
                  const Icon = s.i;
                  return (
                    <a key={s.l} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.l}
                      style={{ width: 36, height: 36, borderRadius: 10, background: C.cream, border: `1px solid ${C.ink}10`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, transition: 'all 0.2s' }}
                      onMouseOver={e => { e.currentTarget.style.background = C.ink; e.currentTarget.style.color = C.cream; }}
                      onMouseOut={e => { e.currentTarget.style.background = C.cream; e.currentTarget.style.color = C.inkSoft; }}>
                      <Icon size={16} />
                    </a>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{t('foot.newsletter.title')}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>{t('foot.newsletter.lead')}</div>
              <form
                onSubmit={(e) => { e.preventDefault(); alert('Merci ! Tu seras prévenu·e dès la prochaine update.'); }}
                style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email" required
                  placeholder={t('foot.newsletter.placeholder')}
                  style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${C.ink}15`, background: C.cream, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.ink }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '11px 18px', fontSize: 13 }}>{t('foot.newsletter.btn')}</button>
              </form>
            </div>
          </div>

          {/* Middle: 5 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, marginBottom: 40 }} className="lv2-footer-cols">
            {[
              { title: t('foot.product'),   links: [
                { l: t('nav.marketplace'),  to: '/marketplace' },
                { l: t('nav.pricing'),      to: '/v2#pricing' },
                { l: t('hero.cta.demo'),    to: '/v2#features' },
                { l: 'Changelog',            to: '/changelog' },
              ]},
              { title: t('foot.solutions'), links: [
                { l: '🛍 Boutique',          to: '/agents/commerce' },
                { l: '🍽 Restaurant',        to: '/agents/restaurant' },
                { l: '🏨 Hôtel',             to: '/agents/hotel' },
                { l: '🏢 Résidence',         to: '/agents/residence' },
                { l: '💇 Salon',             to: '/agents/service' },
                { l: '🩺 Cabinet',           to: '/agents/cabinet' },
                { l: '🏠 Immobilier',        to: '/agents/realestate' },
              ]},
              { title: t('foot.resources'), links: [
                { l: 'Documentation',        to: '/docs' },
                { l: 'Help center',          to: '/help' },
                { l: 'Blog',                 to: '/blog' },
                { l: 'Status',               to: '/status' },
              ]},
              { title: t('foot.company'),   links: [
                { l: 'About',                to: '/about' },
                { l: 'Customers',            to: '/customers' },
                { l: 'Careers',              to: '/careers' },
                { l: 'Contact',              to: '/contact' },
              ]},
              { title: t('foot.legal'),     links: [
                { l: 'Terms',                to: '/legal/terms' },
                { l: 'Privacy',              to: '/legal/privacy' },
                { l: 'Cookies',              to: '/legal/cookies' },
                { l: 'Security',             to: '/legal/security' },
              ]},
            ].map((col, i) => (
              <div key={i}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.ink, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>{col.title}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {col.links.map((l, j) => (
                    <li key={j}>
                      <Link to={l.to} style={{ fontSize: 13, color: C.inkSoft, textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseOver={e => e.currentTarget.style.color = C.ink}
                        onMouseOut={e => e.currentTarget.style.color = C.inkSoft}>
                        {l.l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom: copyright + lang picker */}
          <div style={{ borderTop: `1px solid ${C.ink}10`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 12, color: C.inkSoft }}>{t('foot.copyright')}</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Globe size={14} color={C.inkSoft} />
              <select value={lang} onChange={e => setLang(e.target.value as LangCode)}
                style={{ background: 'transparent', border: `1px solid ${C.ink}15`, borderRadius: 8, padding: '5px 8px', fontSize: 12, color: C.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }}>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Hero verticals mosaic — artistic AI Core composition ──────────────────
// A central glowing AI "face" with the 6 Orlode verticals (Boutique, Restaurant,
// Hôtel, PME, Salon, Cabinet) in hexagonal orbit. Wireframe rings, beam lines
// from each vertical into the AI core, particle aura, pulsing eyes. The whole
// thing is pure SVG + CSS — no images, scales perfectly.
function VerticalsMosaic() {
  const verticals = [
    // Hexagon positions (clock-face): top, top-right, bottom-right, bottom, bottom-left, top-left
    { emoji: '🛒', name: 'Boutique',   accent: '#7FCAA6', glow: '#10B981', pos: { top:  '6%',  left: '50%' }, angle: -90 },
    { emoji: '🍽️', name: 'Restaurant', accent: '#FED7AA', glow: '#F97316', pos: { top: '24%', left: '92%' }, angle: -30 },
    { emoji: '💇', name: 'Salon',      accent: '#F9A8D4', glow: '#EC4899', pos: { top: '72%', left: '92%' }, angle:  30 },
    { emoji: '🏨', name: 'Hôtel',      accent: '#BAE6FD', glow: '#3B82F6', pos: { top: '90%', left: '50%' }, angle:  90 },
    { emoji: '🩺', name: 'Cabinet',    accent: '#5EEAD4', glow: '#14B8A6', pos: { top: '72%', left:  '8%' }, angle: 150 },
    { emoji: '💼', name: 'PME',        accent: '#A5B4FC', glow: '#6366F1', pos: { top: '24%', left:  '8%' }, angle: 210 },
  ];

  return (
    <div style={{
      width: '100%',
      aspectRatio: '1/1',
      borderRadius: 28,
      background: 'radial-gradient(circle at 50% 50%, #0E2920 0%, #050D0A 70%, #000 100%)',
      boxShadow: '0 50px 100px -30px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grain texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
        opacity: 0.08, mixBlendMode: 'overlay', pointerEvents: 'none',
      }} />

      {/* Animated background wireframe */}
      <svg viewBox="0 0 200 200" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
      }}>
        {/* Dot grid suggesting depth */}
        <defs>
          <radialGradient id="lv2-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#34D399" stopOpacity="0.55" />
            <stop offset="40%" stopColor="#10B981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lv2-core-head" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#A7F3D0" stopOpacity="1" />
            <stop offset="40%" stopColor="#10B981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#064E3B" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="lv2-eye-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ECFEFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </radialGradient>
          <pattern id="lv2-grid" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.06)" />
          </pattern>
        </defs>

        {/* Dot grid background */}
        <rect width="200" height="200" fill="url(#lv2-grid)" />

        {/* Outer aura halo */}
        <circle cx="100" cy="100" r="80" fill="url(#lv2-core-glow)" />

        {/* Three concentric wireframe rings (rotating slowly) */}
        <g style={{ transformOrigin: '100px 100px', animation: 'lv2-rotate 80s linear infinite' }}>
          <circle cx="100" cy="100" r="55" fill="none" stroke="#34D399" strokeOpacity="0.18" strokeWidth="0.5" strokeDasharray="2,3" />
        </g>
        <g style={{ transformOrigin: '100px 100px', animation: 'lv2-rotate 60s linear infinite reverse' }}>
          <circle cx="100" cy="100" r="45" fill="none" stroke="#7FCAA6" strokeOpacity="0.22" strokeWidth="0.5" />
          <circle cx="100" cy="55" r="1.5" fill="#A7F3D0" />
          <circle cx="55" cy="100" r="1.5" fill="#A7F3D0" />
          <circle cx="145" cy="100" r="1.5" fill="#A7F3D0" />
          <circle cx="100" cy="145" r="1.5" fill="#A7F3D0" />
        </g>
        <g style={{ transformOrigin: '100px 100px', animation: 'lv2-rotate 40s linear infinite' }}>
          <circle cx="100" cy="100" r="35" fill="none" stroke="#A7F3D0" strokeOpacity="0.3" strokeWidth="0.6" strokeDasharray="0.8,3" />
        </g>

        {/* Beams from center to each vertical position (hexagon vertices) */}
        {[-90, -30, 30, 90, 150, 210].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x2 = 100 + Math.cos(rad) * 84;
          const y2 = 100 + Math.sin(rad) * 84;
          return (
            <line
              key={i}
              x1="100" y1="100" x2={x2} y2={y2}
              stroke="url(#lv2-core-glow)"
              strokeWidth="0.7"
              strokeOpacity="0.7"
              style={{ animation: `lv2-pulse 3s ${i * 0.3}s ease-in-out infinite` }}
            />
          );
        })}

        {/* AI face core — abstract head silhouette */}
        <g style={{ transformOrigin: '100px 100px', animation: 'lv2-core-pulse 4s ease-in-out infinite' }}>
          {/* Head shape */}
          <ellipse cx="100" cy="100" rx="22" ry="26" fill="url(#lv2-core-head)" />
          {/* Brain lobes (subtle inner detail) */}
          <path d="M 88 92 Q 100 80, 112 92 Q 100 96, 88 92 Z" fill="#064E3B" opacity="0.5" />
          {/* Two glowing eye-slits */}
          <ellipse cx="92"  cy="98" rx="3.5" ry="2" fill="url(#lv2-eye-glow)" />
          <ellipse cx="108" cy="98" rx="3.5" ry="2" fill="url(#lv2-eye-glow)" />
          {/* Mouth hint — thin horizontal */}
          <line x1="94" y1="110" x2="106" y2="110" stroke="#A7F3D0" strokeWidth="0.8" strokeOpacity="0.6" strokeLinecap="round" />
          {/* Status bar antenna on top */}
          <line x1="100" y1="74" x2="100" y2="68" stroke="#34D399" strokeWidth="0.6" />
          <circle cx="100" cy="66" r="1.4" fill="#A7F3D0" />
        </g>
      </svg>

      {/* Vertical satellite cards in hexagonal orbit */}
      {verticals.map((v, i) => (
        <div key={v.name} className="lv2-sat" style={{
          position: 'absolute',
          top: v.pos.top, left: v.pos.left,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(14px) saturate(160%)',
          WebkitBackdropFilter: 'blur(14px) saturate(160%)',
          border: `1px solid ${v.glow}40`,
          borderRadius: 14,
          padding: '8px 14px 8px 10px',
          color: '#FFFFFF',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: `0 8px 24px -6px ${v.glow}50, inset 0 0 0 1px rgba(255,255,255,0.04)`,
          minWidth: 'fit-content', whiteSpace: 'nowrap',
          animation: `lv2-sat-in 0.7s cubic-bezier(0.16,1,0.3,1) backwards, lv2-float 5s ease-in-out infinite`,
          animationDelay: `${0.15 + i * 0.08}s, ${i * 0.4}s`,
          zIndex: 2,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${v.glow}, ${v.glow}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
            boxShadow: `0 0 12px -2px ${v.glow}`,
          }}>
            {v.emoji}
          </div>
          <div style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 13, fontWeight: 700,
            letterSpacing: '-0.01em',
          }}>
            {v.name}
          </div>
        </div>
      ))}

      {/* Floating "AI" status pill at top */}
      <div style={{
        position: 'absolute', top: 16, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(167, 243, 208, 0.25)',
        padding: '5px 12px', borderRadius: 100,
        color: '#A7F3D0',
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'inline-flex', alignItems: 'center', gap: 6,
        zIndex: 3,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#34D399',
          animation: 'lv2-blink 1.4s ease-in-out infinite',
          boxShadow: '0 0 8px #34D399',
        }} />
        Orlode AI · Active
      </div>

      <style>{`
        @keyframes lv2-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lv2-core-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50%      { transform: scale(1.04); filter: brightness(1.15); }
        }
        @keyframes lv2-pulse {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.85; }
        }
        @keyframes lv2-sat-in {
          from { opacity: 0; transform: translate(-50%, -30%) scale(0.7); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes lv2-float {
          0%, 100% { translate: 0 0; }
          50%      { translate: 0 -6px; }
        }
        @keyframes lv2-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
        .lv2-sat { transition: transform 0.3s ease, box-shadow 0.3s ease; }
      `}</style>
    </div>
  );
}
