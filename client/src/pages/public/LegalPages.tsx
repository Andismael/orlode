/**
 * Public legal pages — Terms of Service, Privacy Policy, Legal Notice.
 * Bilingual (FR/EN) via useLangStore. Compliant with RGPD (EU) + CCPA (USA).
 *
 * Mounted at:
 *   /legal/terms
 *   /legal/privacy
 *   /legal/notice
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLangStore } from '@/store/langStore';
import { useSEO } from '@/hooks/useSEO';

const LAST_UPDATED = '2026-04-21';
const COMPANY = 'Orlode';                // Commercial / product name
const LEGAL_ENTITY = 'Ouihope';           // Legal entity publishing the Service
const LEGAL_ENTITY_TYPE = 'Non-profit organization (USA)';
const LEGAL_ENTITY_FORM_FR = 'Organisation à but non lucratif (USA)';
const EIN = '33-3218181';                 // US Employer Identification Number
const LEGAL_ADDRESS = '6354 Rancho Mission Rd, Unit 515, San Diego, CA 92108, USA';
const LEGAL_REPRESENTATIVE = 'Ismael Nguessan';
const DOMAIN = 'orlode.com';
const CONTACT_EMAIL = 'legal@orlode.com';
const SUPPORT_EMAIL = 'support@orlode.com';
const DPO_EMAIL = 'privacy@orlode.com';

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout
// ─────────────────────────────────────────────────────────────────────────────

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const { lang } = useLangStore();
  useEffect(() => { window.scrollTo(0, 0); }, [title]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-sm text-violet-600 hover:underline">← {lang === 'fr' ? 'Retour à l\'accueil' : 'Back to home'}</Link>
        </div>
        <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10 prose prose-slate max-w-none">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-xs text-slate-500 mb-6">
            {lang === 'fr' ? 'Dernière mise à jour' : 'Last updated'} : {LAST_UPDATED}
          </p>
          {children}
        </article>
        {/* Language switcher for legal pages */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <LangSwitch />
        </div>
        {/* Cross-links */}
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
          <Link to="/legal/terms" className="text-slate-600 hover:text-violet-600">{lang === 'fr' ? 'CGU' : 'Terms'}</Link>
          <span className="text-slate-300">·</span>
          <Link to="/legal/privacy" className="text-slate-600 hover:text-violet-600">{lang === 'fr' ? 'Confidentialité' : 'Privacy'}</Link>
          <span className="text-slate-300">·</span>
          <Link to="/legal/notice" className="text-slate-600 hover:text-violet-600">{lang === 'fr' ? 'Mentions légales' : 'Legal Notice'}</Link>
        </div>
      </div>
    </div>
  );
}

function LangSwitch() {
  const { lang, setLang } = useLangStore();
  return (
    <div className="inline-flex gap-1 bg-white rounded-full p-1 border border-slate-200">
      <button onClick={() => setLang('fr')} className={`px-3 py-1 rounded-full text-xs ${lang === 'fr' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>FR</button>
      <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-full text-xs ${lang === 'en' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>EN</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Terms of Service
// ─────────────────────────────────────────────────────────────────────────────

export function TermsPage() {
  const { lang } = useLangStore();
  useSEO({
    title: lang === 'fr' ? 'Conditions Générales | Orlode' : 'Terms of Service | Orlode',
    description: lang === 'fr' ? 'Conditions générales d\'utilisation de la plateforme Orlode AI.' : 'Terms of Service for the Orlode AI platform.',
    path: '/legal/terms',
  });

  if (lang === 'en') return <LegalLayout title="Terms of Service"><TermsEn /></LegalLayout>;
  return <LegalLayout title="Conditions Générales d'Utilisation"><TermsFr /></LegalLayout>;
}

function TermsFr() {
  return (
    <>
      <h2>1. Objet</h2>
      <p>Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de la plateforme <strong>{COMPANY}</strong> accessible à l'adresse <a href={`https://${DOMAIN}`}>{DOMAIN}</a>, proposant des agents d'intelligence artificielle destinés aux entreprises (le « Service »).</p>

      <h2>2. Acceptation</h2>
      <p>L'utilisation du Service implique l'acceptation sans réserve des présentes CGU. En créant un compte, vous confirmez avoir au moins <strong>18 ans</strong> et disposer de la capacité juridique pour contracter.</p>

      <h2>3. Plans et facturation</h2>
      <p>{COMPANY} propose plusieurs plans d'abonnement : <strong>Free</strong> (gratuit), <strong>Creator</strong>, <strong>Starter</strong>, <strong>Pro</strong> et <strong>Premium</strong>. Les tarifs, limites (documents, messages, utilisateurs) et fonctionnalités sont détaillés sur la page tarifs. Les abonnements payants sont facturés mensuellement ou annuellement via notre prestataire Stripe. Les paiements sont non remboursables sauf mention contraire.</p>

      <h2>4. Utilisation acceptable</h2>
      <p>Vous vous engagez à ne pas :</p>
      <ul>
        <li>utiliser le Service à des fins illégales ou frauduleuses ;</li>
        <li>envoyer de contenu diffamatoire, discriminatoire, haineux ou pornographique ;</li>
        <li>tenter de compromettre la sécurité ou de faire du reverse-engineering ;</li>
        <li>revendre le Service à des tiers sans autorisation écrite ;</li>
        <li>utiliser le Service pour entraîner des modèles d'IA concurrents.</li>
      </ul>
      <p>En cas de violation, nous pouvons suspendre ou résilier votre compte sans préavis.</p>

      <h2>5. Contenus utilisateur</h2>
      <p>Vous conservez la propriété de tous les documents, textes, images que vous téléversez. Vous nous accordez une licence non exclusive pour les traiter, indexer et utiliser afin de fournir le Service (notamment via nos fournisseurs d'IA : Anthropic Claude, Google Gemini, OpenAI).</p>

      <h2>6. Intelligence artificielle — limites</h2>
      <p>Le Service utilise des modèles d'IA qui peuvent produire des résultats <strong>inexacts, incomplets ou trompeurs</strong>. Vous reconnaissez devoir vérifier toute information critique (juridique, médicale, financière) avant de l'utiliser. {COMPANY} décline toute responsabilité pour des décisions prises sur la base de sorties IA.</p>

      <h2>7. Propriété intellectuelle</h2>
      <p>Le code, l'architecture, les noms, logos et interfaces d'Orlode sont protégés. Tout usage non autorisé est interdit. Les agents personnalisés que vous créez restent votre propriété (plan Creator).</p>

      <h2>8. Résiliation</h2>
      <p>Vous pouvez résilier à tout moment depuis <code>/admin/billing</code>. La résiliation prend effet à la fin de la période déjà payée. {COMPANY} peut résilier votre compte en cas de violation des CGU ou de non-paiement.</p>

      <h2>9. Responsabilité</h2>
      <p>Dans la limite autorisée par la loi, {COMPANY} n'est pas responsable des dommages indirects (perte de profit, de données, d'image). Notre responsabilité totale est plafonnée au montant versé durant les 12 derniers mois.</p>

      <h2>10. Droit applicable</h2>
      <p>Les présentes CGU sont régies par le droit de l'<strong>État de Californie, USA</strong> (siège légal de {LEGAL_ENTITY}). Les clients de l'Union européenne bénéficient en plus des dispositions impératives de leur droit national (notamment consommateur et RGPD). Tout litige relève à défaut d'accord amiable de la juridiction compétente de San Diego, Californie.</p>

      <h2>11. Éditeur</h2>
      <p>Le Service est édité par <strong>{LEGAL_ENTITY}</strong>, {LEGAL_ENTITY_FORM_FR}, enregistrée auprès de l'IRS (USA) sous l'EIN {EIN}. Siège social : {LEGAL_ADDRESS}. Représentant légal : {LEGAL_REPRESENTATIVE}.</p>

      <h2>12. Contact</h2>
      <p>Toute question : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · Support : <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <h2>1. Purpose</h2>
      <p>These Terms of Service (the "Terms") govern access to and use of the <strong>{COMPANY}</strong> platform available at <a href={`https://${DOMAIN}`}>{DOMAIN}</a>, which provides artificial intelligence agents for businesses (the "Service").</p>

      <h2>2. Acceptance</h2>
      <p>By using the Service, you agree to these Terms. By creating an account, you confirm you are at least <strong>18 years old</strong> and have the legal capacity to enter into this agreement.</p>

      <h2>3. Plans and billing</h2>
      <p>{COMPANY} offers subscription plans: <strong>Free</strong>, <strong>Creator</strong>, <strong>Starter</strong>, <strong>Pro</strong>, and <strong>Premium</strong>. Prices, limits (documents, messages, users), and features are detailed on the pricing page. Paid plans are billed monthly or yearly through our payment processor Stripe. Payments are non-refundable unless otherwise stated.</p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service for illegal or fraudulent purposes;</li>
        <li>submit defamatory, discriminatory, hateful, or pornographic content;</li>
        <li>attempt to breach security or reverse-engineer the Service;</li>
        <li>resell the Service to third parties without written authorization;</li>
        <li>use the Service to train competing AI models.</li>
      </ul>
      <p>Violation may lead to immediate suspension or termination without notice.</p>

      <h2>5. User content</h2>
      <p>You retain ownership of all documents, text, and images you upload. You grant {COMPANY} a non-exclusive license to process, index, and use them to provide the Service (including via our AI providers: Anthropic Claude, Google Gemini, OpenAI).</p>

      <h2>6. AI — limitations</h2>
      <p>The Service uses AI models that may produce <strong>inaccurate, incomplete, or misleading</strong> results. You acknowledge the need to verify any critical information (legal, medical, financial) before acting on it. {COMPANY} is not liable for decisions made based on AI output.</p>

      <h2>7. Intellectual property</h2>
      <p>Orlode's code, architecture, names, logos, and interfaces are protected. Unauthorized use is prohibited. Custom agents you create remain your property (Creator plan).</p>

      <h2>8. Termination</h2>
      <p>You may cancel anytime from <code>/admin/billing</code>. Cancellation takes effect at the end of the current paid period. {COMPANY} may terminate your account for violation of these Terms or non-payment.</p>

      <h2>9. Liability</h2>
      <p>To the fullest extent permitted by law, {COMPANY} is not liable for indirect damages (loss of profit, data, or reputation). Total liability is capped at amounts paid in the 12 months preceding the claim.</p>

      <h2>10. Governing law</h2>
      <p>These Terms are governed by the laws of the <strong>State of California, USA</strong> (where {LEGAL_ENTITY} is headquartered). European Union customers additionally benefit from mandatory consumer and data-protection rules (notably GDPR) under their national law. Disputes are resolved, failing amicable settlement, by the competent courts of San Diego, California.</p>

      <h2>11. Publisher</h2>
      <p>The Service is operated by <strong>{LEGAL_ENTITY}</strong>, a {LEGAL_ENTITY_TYPE} registered with the IRS under EIN {EIN}. Headquarters: {LEGAL_ADDRESS}. Legal representative: {LEGAL_REPRESENTATIVE}.</p>

      <h2>12. Contact</h2>
      <p>Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Policy
// ─────────────────────────────────────────────────────────────────────────────

export function PrivacyPage() {
  const { lang } = useLangStore();
  useSEO({
    title: lang === 'fr' ? 'Politique de confidentialité | Orlode' : 'Privacy Policy | Orlode',
    description: lang === 'fr' ? 'Comment Orlode collecte, utilise et protège vos données (RGPD + CCPA).' : 'How Orlode collects, uses, and protects your data (GDPR + CCPA).',
    path: '/legal/privacy',
  });

  if (lang === 'en') return <LegalLayout title="Privacy Policy"><PrivacyEn /></LegalLayout>;
  return <LegalLayout title="Politique de confidentialité"><PrivacyFr /></LegalLayout>;
}

function PrivacyFr() {
  return (
    <>
      <p className="lead">Cette politique décrit comment {COMPANY} collecte, utilise, protège et partage vos données personnelles, en conformité avec le <strong>RGPD</strong> (Union européenne) et le <strong>CCPA</strong> (Californie).</p>

      <h2>1. Données que nous collectons</h2>
      <ul>
        <li><strong>Identité</strong> : nom, email, photo de profil (via Firebase Auth)</li>
        <li><strong>Entreprise</strong> : nom, adresse, N° TVA, logo (renseignés par vous)</li>
        <li><strong>Contenu</strong> : documents, conversations, paramètres que vous créez</li>
        <li><strong>Paiement</strong> : traité par Stripe ; nous ne stockons aucune donnée bancaire</li>
        <li><strong>Technique</strong> : adresse IP, user-agent, logs d'usage (pour sécurité et amélioration)</li>
      </ul>

      <h2>2. Finalités</h2>
      <ul>
        <li>Fournir le Service (traitement IA, stockage documents, facturation)</li>
        <li>Sécurité (détection fraude, protection contre abus)</li>
        <li>Communications de service (emails transactionnels)</li>
        <li>Amélioration du produit (métriques anonymisées)</li>
      </ul>

      <h2>3. Base légale (RGPD)</h2>
      <p>Nous traitons vos données sur la base de : l'<strong>exécution du contrat</strong> (prestation du Service), votre <strong>consentement</strong> (marketing, cookies non essentiels), et nos <strong>intérêts légitimes</strong> (sécurité, amélioration).</p>

      <h2>4. Partage avec des tiers</h2>
      <p>Vos données sont partagées uniquement avec des sous-traitants nécessaires :</p>
      <ul>
        <li><strong>Firebase / Google Cloud</strong> (US, EU) — hébergement, auth, base de données</li>
        <li><strong>Stripe</strong> (US, IE) — paiements</li>
        <li><strong>Anthropic</strong> (US) — Claude (traitement IA)</li>
        <li><strong>Google AI</strong> (US) — Gemini (traitement IA)</li>
        <li><strong>OpenAI</strong> (US) — embeddings + transcription</li>
        <li><strong>Pinecone</strong> (US) — recherche vectorielle</li>
        <li><strong>Resend</strong> (US) — envoi d'emails</li>
      </ul>
      <p>Tous sont liés par des clauses contractuelles types (SCC) ou le cadre Data Privacy Framework. <strong>Nous ne vendons pas vos données.</strong></p>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li>Compte actif : durée de votre abonnement + 1 an</li>
        <li>Logs techniques : 90 jours</li>
        <li>Factures : 10 ans (obligation légale)</li>
        <li>Après suppression : effacement sous 30 jours, backups inclus</li>
      </ul>

      <h2>6. Vos droits — RGPD (EU)</h2>
      <ul>
        <li><strong>Accès</strong> : obtenir une copie de vos données</li>
        <li><strong>Rectification</strong> : corriger des données inexactes</li>
        <li><strong>Effacement</strong> (droit à l'oubli)</li>
        <li><strong>Portabilité</strong> : export au format JSON</li>
        <li><strong>Opposition</strong> : refuser certains traitements</li>
        <li><strong>Retrait du consentement</strong> à tout moment</li>
      </ul>
      <p>Exercer un droit : <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>. Réponse sous 30 jours. Réclamation : CNIL (cnil.fr) ou autorité de votre pays.</p>

      <h2>7. Vos droits — CCPA (Californie, USA)</h2>
      <ul>
        <li><strong>Right to Know</strong> : catégories de données collectées</li>
        <li><strong>Right to Delete</strong> : suppression de vos données</li>
        <li><strong>Right to Opt-Out</strong> : nous ne vendons pas de données (Do Not Sell)</li>
        <li><strong>Right to Non-Discrimination</strong> : même service si vous exercez ces droits</li>
      </ul>
      <p>Contact : <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a></p>

      <h2>8. Cookies</h2>
      <p>Nous utilisons des cookies <strong>essentiels</strong> (session, sécurité) sans consentement, et des cookies <strong>analytiques</strong> (Google Analytics) avec votre consentement. Paramétrage via la bannière cookies.</p>

      <h2>9. Sécurité</h2>
      <p>Chiffrement en transit (TLS 1.3) et au repos (AES-256). Authentification Firebase avec MFA disponible. Accès restreint aux ingénieurs avec MFA obligatoire. Sauvegardes quotidiennes.</p>

      <h2>10. Transferts internationaux</h2>
      <p>Certaines données sont traitées hors UE (US principalement). Nous utilisons des Clauses Contractuelles Types (SCC) pour garantir un niveau de protection équivalent au RGPD.</p>

      <h2>11. Mineurs</h2>
      <p>Le Service n'est pas destiné aux mineurs de moins de 16 ans. Si vous pensez qu'un enfant nous a communiqué des données, contactez-nous pour suppression immédiate.</p>

      <h2>12. Modifications</h2>
      <p>Nous pouvons mettre à jour cette politique. Changements substantiels notifiés par email 30 jours avant entrée en vigueur.</p>

      <h2>13. Contact</h2>
      <p>Data Protection Officer (DPO) : <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a></p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <p className="lead">This policy describes how {COMPANY} collects, uses, protects, and shares your personal data, in compliance with <strong>GDPR</strong> (European Union) and <strong>CCPA</strong> (California, USA).</p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Identity</strong>: name, email, profile photo (via Firebase Auth)</li>
        <li><strong>Business</strong>: name, address, tax ID, logo (provided by you)</li>
        <li><strong>Content</strong>: documents, conversations, settings you create</li>
        <li><strong>Payment</strong>: handled by Stripe; we never store card data</li>
        <li><strong>Technical</strong>: IP address, user-agent, usage logs (security and improvement)</li>
      </ul>

      <h2>2. Purposes</h2>
      <ul>
        <li>Provide the Service (AI processing, document storage, billing)</li>
        <li>Security (fraud detection, abuse prevention)</li>
        <li>Service communications (transactional emails)</li>
        <li>Product improvement (anonymized metrics)</li>
      </ul>

      <h2>3. Legal basis (GDPR)</h2>
      <p>We process your data based on: <strong>contract performance</strong> (delivering the Service), your <strong>consent</strong> (marketing, non-essential cookies), and our <strong>legitimate interests</strong> (security, improvement).</p>

      <h2>4. Third-party sharing</h2>
      <p>Your data is shared only with necessary subprocessors:</p>
      <ul>
        <li><strong>Firebase / Google Cloud</strong> (US, EU) — hosting, auth, database</li>
        <li><strong>Stripe</strong> (US, IE) — payments</li>
        <li><strong>Anthropic</strong> (US) — Claude (AI processing)</li>
        <li><strong>Google AI</strong> (US) — Gemini (AI processing)</li>
        <li><strong>OpenAI</strong> (US) — embeddings + transcription</li>
        <li><strong>Pinecone</strong> (US) — vector search</li>
        <li><strong>Resend</strong> (US) — email delivery</li>
      </ul>
      <p>All are bound by Standard Contractual Clauses (SCC) or Data Privacy Framework. <strong>We do not sell your data.</strong></p>

      <h2>5. Data retention</h2>
      <ul>
        <li>Active account: subscription duration + 1 year</li>
        <li>Technical logs: 90 days</li>
        <li>Invoices: 10 years (legal obligation)</li>
        <li>After deletion: erased within 30 days including backups</li>
      </ul>

      <h2>6. Your rights — GDPR (EU)</h2>
      <ul>
        <li><strong>Access</strong>: obtain a copy of your data</li>
        <li><strong>Rectification</strong>: correct inaccurate data</li>
        <li><strong>Erasure</strong> (right to be forgotten)</li>
        <li><strong>Portability</strong>: JSON export</li>
        <li><strong>Objection</strong>: refuse certain processing</li>
        <li><strong>Withdraw consent</strong> at any time</li>
      </ul>
      <p>To exercise: <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>. Response within 30 days. Complaint: CNIL (cnil.fr) or your country's authority.</p>

      <h2>7. Your rights — CCPA (California, USA)</h2>
      <ul>
        <li><strong>Right to Know</strong>: categories of data collected</li>
        <li><strong>Right to Delete</strong>: removal of your data</li>
        <li><strong>Right to Opt-Out</strong>: we don't sell data (Do Not Sell)</li>
        <li><strong>Right to Non-Discrimination</strong>: same service if you exercise these rights</li>
      </ul>
      <p>Contact: <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a></p>

      <h2>8. Cookies</h2>
      <p>We use <strong>essential</strong> cookies (session, security) without consent, and <strong>analytics</strong> cookies (Google Analytics) with your consent. Settings via the cookie banner.</p>

      <h2>9. Security</h2>
      <p>Encryption in transit (TLS 1.3) and at rest (AES-256). Firebase authentication with MFA available. Restricted engineer access with mandatory MFA. Daily backups.</p>

      <h2>10. International transfers</h2>
      <p>Some data is processed outside EU (mostly US). We use Standard Contractual Clauses (SCC) to ensure GDPR-equivalent protection.</p>

      <h2>11. Minors</h2>
      <p>The Service is not intended for users under 16. If you believe a child has provided us with data, contact us for immediate deletion.</p>

      <h2>12. Changes</h2>
      <p>We may update this policy. Material changes are notified by email 30 days before taking effect.</p>

      <h2>13. Contact</h2>
      <p>Data Protection Officer (DPO): <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a></p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legal Notice / Mentions légales
// ─────────────────────────────────────────────────────────────────────────────

export function LegalNoticePage() {
  const { lang } = useLangStore();
  useSEO({
    title: lang === 'fr' ? 'Mentions légales | Orlode' : 'Legal Notice | Orlode',
    description: lang === 'fr' ? 'Mentions légales de la plateforme Orlode AI.' : 'Legal notice for the Orlode AI platform.',
    path: '/legal/notice',
  });

  if (lang === 'en') return <LegalLayout title="Legal Notice"><NoticeEn /></LegalLayout>;
  return <LegalLayout title="Mentions légales"><NoticeFr /></LegalLayout>;
}

function NoticeFr() {
  return (
    <>
      <h2>Éditeur du site</h2>
      <p>
        <strong>{LEGAL_ENTITY}</strong> ({COMPANY} est le nom commercial du service)<br />
        Forme juridique : {LEGAL_ENTITY_FORM_FR}<br />
        EIN (IRS, USA) : {EIN}<br />
        Siège social : {LEGAL_ADDRESS}<br />
        Email : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br />
        Directeur de publication : {LEGAL_REPRESENTATIVE}
      </p>

      <h2>Hébergement</h2>
      <p>
        <strong>Google Cloud / Firebase Hosting</strong><br />
        Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA<br />
        <a href="https://cloud.google.com" target="_blank" rel="noreferrer">cloud.google.com</a>
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>L'ensemble des éléments accessibles sur ce site (textes, images, logos, code, structure) sont protégés par les lois relatives à la propriété intellectuelle et appartiennent à {COMPANY} ou à ses partenaires. Toute reproduction, représentation, modification ou adaptation, totale ou partielle, est interdite sans autorisation écrite préalable.</p>

      <h2>Liens hypertextes</h2>
      <p>Ce site peut contenir des liens vers des sites tiers. {COMPANY} n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.</p>

      <h2>Données personnelles</h2>
      <p>Consultez notre <Link to="/legal/privacy">Politique de confidentialité</Link> pour connaître l'utilisation faite de vos données personnelles.</p>

      <h2>Contact</h2>
      <p>Pour toute question juridique : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </>
  );
}

function NoticeEn() {
  return (
    <>
      <h2>Site publisher</h2>
      <p>
        <strong>{LEGAL_ENTITY}</strong> ({COMPANY} is the commercial name of the service)<br />
        Legal form: {LEGAL_ENTITY_TYPE}<br />
        EIN (IRS, USA): {EIN}<br />
        Headquarters: {LEGAL_ADDRESS}<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br />
        Publication director: {LEGAL_REPRESENTATIVE}
      </p>

      <h2>Hosting</h2>
      <p>
        <strong>Google Cloud / Firebase Hosting</strong><br />
        Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA<br />
        <a href="https://cloud.google.com" target="_blank" rel="noreferrer">cloud.google.com</a>
      </p>

      <h2>Intellectual property</h2>
      <p>All elements on this site (text, images, logos, code, structure) are protected by intellectual property laws and belong to {COMPANY} or its partners. Any reproduction, representation, modification, or adaptation, in whole or in part, is prohibited without prior written authorization.</p>

      <h2>External links</h2>
      <p>This site may contain links to third-party sites. {COMPANY} has no control over these sites and declines any responsibility regarding their content.</p>

      <h2>Personal data</h2>
      <p>See our <Link to="/legal/privacy">Privacy Policy</Link> for details on how your personal data is used.</p>

      <h2>Contact</h2>
      <p>For legal questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </>
  );
}
