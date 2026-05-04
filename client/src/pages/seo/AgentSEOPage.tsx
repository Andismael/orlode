/**
 * AgentSEOPage — /ai/:slug — Dynamic SEO landing page per agent/industry
 * Pre-renders content for Google crawlers + conversion CTAs
 */
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Check, Star, Zap, MessageSquare, Globe } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

// ── ALL SEO PAGES DATA ──────────────────────────────────────────────────────

const SEO_PAGES: Record<string, {
  title: string; h1: string; description: string; icon: string; color: string;
  features: string[]; useCases: string[]; faq: Array<{ q: string; a: string }>;
  industry?: string; cta: string;
}> = {
  // ── AGENTS ──
  'marketing-ai': {
    title: 'Agent Marketing IA — Posts, Videos, SEO, Campagnes | Orlode',
    h1: 'Agent Marketing IA', description: 'Generez des posts sociaux, videos AI, campagnes email et analysez vos performances marketing — automatiquement.',
    icon: '📣', color: '#8B5CF6',
    features: ['Posts multi-plateforme (LinkedIn, Facebook, Instagram)', 'Videos AI generees automatiquement', 'Calendrier editorial', 'SEO et mots-cles', 'Analyse concurrents', 'Campagnes ROI tracking'],
    useCases: ['PME sans equipe marketing', 'Agences qui gerent plusieurs clients', 'E-commerce qui veut scaler'],
    faq: [{ q: 'L\'agent peut-il poster directement ?', a: 'Oui, il genere et planifie les posts. La publication se fait via les connecteurs sociaux.' }, { q: 'Combien coute l\'agent marketing ?', a: 'Inclus dans les plans Starter ($19.99), Pro ($49.99) et Premium ($99.99).' }],
    cta: 'Booster mon marketing avec l\'IA',
  },
  'rh-ai': {
    title: 'Agent RH IA — Conges, Recrutement, Onboarding | Orlode',
    h1: 'Agent RH IA', description: 'Automatisez la gestion des conges, le recrutement, l\'onboarding et les evaluations de performance.',
    icon: '👩', color: '#6366F1',
    features: ['Gestion des conges automatique', 'Recrutement IA (CV scoring, entretiens)', 'Onboarding 12 etapes', 'Organigramme', 'Evaluations de performance', 'Enquetes satisfaction'],
    useCases: ['Entreprises de 10-500 employes', 'Startups en croissance', 'Cabinets de recrutement'],
    faq: [{ q: 'L\'agent peut-il gerer les bulletins de paie ?', a: 'Non directement, mais il se connecte a vos outils de paie via l\'API custom.' }, { q: 'Est-ce conforme RGPD ?', a: 'Oui, toutes les donnees sont chiffrees et hebergees sur Firebase avec consentement.' }],
    cta: 'Automatiser mes RH',
  },
  'comptabilite-ai': {
    title: 'Agent Comptabilite IA — Factures, Tresorerie, TVA | Orlode',
    h1: 'Agent Comptabilite IA', description: 'Creez des factures, suivez votre tresorerie, gerez la TVA et automatisez les relances — tout par IA.',
    icon: '💰', color: '#16A34A',
    features: ['Factures PDF multi-devises', 'Relances automatiques (J+7, J+15, J+30)', 'Tresorerie et previsions', 'P&L et compte de resultat', 'TVA collectee/deductible', 'Notes de frais'],
    useCases: ['Freelances et auto-entrepreneurs', 'PME sans comptable dedie', 'Cabinets comptables'],
    faq: [{ q: 'L\'agent remplace-t-il un comptable ?', a: 'Non, il automatise 80% des taches repetitives. Votre comptable se concentre sur le strategique.' }],
    cta: 'Simplifier ma comptabilite',
  },
  'commercial-ai': {
    title: 'Agent Commercial IA — CRM, Pipeline, Devis, Forecast | Orlode',
    h1: 'Agent Commercial IA', description: 'Gerez vos leads, pipeline de vente, devis et previsions commerciales avec l\'IA.',
    icon: '🤝', color: '#F97316',
    features: ['CRM complet avec scoring IA', 'Pipeline 7 etapes', 'Devis automatiques', 'Sequences email IA', 'Forecast 3 scenarios', 'Performance equipe'],
    useCases: ['Equipes commerciales B2B', 'Agences immobilieres', 'Consultants'],
    faq: [{ q: 'L\'agent peut-il envoyer des emails ?', a: 'Oui, via les connecteurs Gmail et WhatsApp integres.' }],
    cta: 'Booster mes ventes',
  },
  'support-ai': {
    title: 'Agent Support Client IA — Tickets, SLA, Chatbot | Orlode',
    h1: 'Agent Support Client IA', description: 'Gerez vos tickets avec SLA, sentiment IA, auto-assignation et base de connaissances.',
    icon: '📞', color: '#06B6D4',
    features: ['Tickets SLA automatiques', 'Detection sentiment client', 'Auto-assignation', 'Base de connaissances IA', 'NPS et satisfaction', 'Escalation intelligente'],
    useCases: ['SaaS avec beaucoup de tickets', 'E-commerce', 'Services B2B'],
    faq: [{ q: 'L\'agent peut-il repondre seul aux clients ?', a: 'Oui, il suggere des reponses et peut resoudre automatiquement les questions frequentes.' }],
    cta: 'Ameliorer mon support',
  },
  'website-builder': {
    title: 'Website Builder IA — Creez un Site Web en 5 Minutes | Orlode',
    h1: 'Website Builder IA', description: 'Generez un site web professionnel avec chatbot IA integre. 3 templates : vitrine, e-commerce, annonces.',
    icon: '🌐', color: '#3B82F6',
    features: ['Generation automatique depuis vos donnees', '3 templates (vitrine, e-commerce, listing)', 'Widget chat IA integre', 'PWA automatique', 'Modification par chat', 'Deploiement Firebase'],
    useCases: ['PME sans site web', 'Restaurants, garages, salons', 'Agences immobilieres'],
    faq: [{ q: 'Dois-je savoir coder ?', a: 'Non, absolument pas. L\'IA genere tout. Vous modifiez par chat ou via l\'editeur visuel.' }, { q: 'Le site est-il responsive ?', a: 'Oui, tous les sites sont optimises mobile + PWA installable.' }],
    cta: 'Creer mon site en 5 min',
  },
  // ── INDUSTRIES ──
  'ai-restaurant': {
    title: 'IA pour Restaurants — Commandes, Menu, Reservations | Orlode',
    h1: 'IA pour Restaurants', description: 'Automatisez votre restaurant avec l\'IA : commandes, menu intelligent, reservations, fidelisation et analytics.',
    icon: '🍽️', color: '#10B981', industry: 'Restauration',
    features: ['Prise de commandes automatique', 'Menu intelligent', 'Reservations 24/7', 'Fidelisation clients', 'Analyse plats populaires', 'Reduction gaspillage'],
    useCases: ['Restaurants', 'Fast-foods', 'Traiteurs', 'Dark kitchens'],
    faq: [{ q: 'L\'agent peut-il prendre des commandes WhatsApp ?', a: 'Oui, via l\'integration WhatsApp Business incluse.' }],
    cta: 'Digitaliser mon restaurant',
  },
  'ai-immobilier': {
    title: 'IA pour Immobilier — Clients, Estimations, Visites | Orlode',
    h1: 'IA pour l\'Immobilier', description: 'Agent IA pour agences immobilieres : qualification prospects, estimation prix, visites virtuelles, analyse marche.',
    icon: '🏠', color: '#3B82F6', industry: 'Immobilier',
    features: ['Qualification prospects automatique', 'Estimation de prix IA', 'Visites virtuelles', 'Analyse tendances marche', 'Relances automatiques', 'Site web avec annonces'],
    useCases: ['Agences immobilieres', 'Promoteurs', 'Gestionnaires de biens'],
    faq: [{ q: 'L\'agent peut-il publier mes annonces ?', a: 'Oui, il genere les descriptions et peut les publier sur votre site Orlode.' }],
    cta: 'Digitaliser mon agence',
  },
  'ai-garage': {
    title: 'IA pour Garages — Diagnostic, Devis, Stock Pieces | Orlode',
    h1: 'IA pour Garages Auto', description: 'Agent IA pour garages : diagnostic OBD, devis automatiques, gestion stock pieces, planning interventions.',
    icon: '🚗', color: '#64748B', industry: 'Automobile',
    features: ['Diagnostic OBD-II automatique', 'Devis generes par IA', 'Gestion stock pieces', 'Planning mecaniciens', 'Historique vehicules', 'Rappels entretien'],
    useCases: ['Garages auto', 'Concessionnaires', 'Centres auto'],
    faq: [{ q: 'Comment fonctionne le diagnostic ?', a: 'Le client donne le code erreur OBD et l\'IA identifie le probleme + estime le cout.' }],
    cta: 'Digitaliser mon garage',
  },
  'ai-salon-beaute': {
    title: 'IA pour Salons de Beaute — RDV, Fidelisation, Analyse | Orlode',
    h1: 'IA pour Salons de Beaute', description: 'Agent IA pour salons : prise de RDV automatique, analyse peau, fidelisation, gestion stock produits.',
    icon: '💇', color: '#EC4899', industry: 'Beaute',
    features: ['RDV automatiques', 'Analyse peau par photo', 'Programme fidelite', 'Gestion stock produits', 'Rappels clients', 'Prevision affluence'],
    useCases: ['Salons de coiffure', 'Instituts de beaute', 'Spas', 'Barbershops'],
    faq: [{ q: 'Les clients peuvent prendre RDV par WhatsApp ?', a: 'Oui, l\'agent repond 24/7 sur WhatsApp et prend les rendez-vous automatiquement.' }],
    cta: 'Digitaliser mon salon',
  },
  'ai-afrique': {
    title: 'IA pour Entreprises Africaines — Orlode AI',
    h1: 'IA pour l\'Afrique', description: 'La premiere plateforme multi-agents IA concue pour les entreprises africaines. WhatsApp, mobile-first, Wave Money.',
    icon: '🌍', color: '#F59E0B', industry: 'Afrique',
    features: ['Paiement Wave Mobile Money', 'WhatsApp Business integre', 'Mobile-first', '48 agents specialises', 'Marketplace agents metiers africains', 'Support multilingue (FR, EN, AR)'],
    useCases: ['PME en Afrique de l\'Ouest', 'Startups Abidjan, Dakar, Lagos', 'ONG et associations'],
    faq: [{ q: 'Ca marche avec Wave ?', a: 'Oui, les paiements sont acceptes par Stripe (carte) et Wave Mobile Money.' }, { q: 'C\'est adapte au marche africain ?', a: 'Oui, Orlode est concu pour l\'Afrique : WhatsApp natif, mobile-first, agents metiers locaux (agriculture, coiffure, restauration...).' }],
    cta: 'Essayer Orlode gratuitement',
  },
  'ai-agriculture': {
    title: 'IA pour Agriculture — Sol, Meteo, Rendement | Orlode',
    h1: 'IA pour l\'Agriculture', description: 'Agent agronome IA : analyse sol, detection maladies, prevision rendement, prix du marche.',
    icon: '🌱', color: '#16A34A', industry: 'Agriculture',
    features: ['Analyse sol par photo', 'Detection maladies des plantes', 'Prevision rendement', 'Calendrier agricole', 'Prix du marche en temps reel', 'Alertes meteo'],
    useCases: ['Agriculteurs', 'Cooperatives', 'Agronomes'],
    faq: [{ q: 'Ca marche sans internet ?', a: 'Le site est PWA — certaines features marchent offline. Pour l\'IA, une connexion est necessaire.' }],
    cta: 'Essayer pour mon exploitation',
  },
  'ai-education': {
    title: 'IA pour Education — Cours, Quiz, Progression | Orlode',
    h1: 'IA pour l\'Education', description: 'Agent educatif IA : creation de cours, quiz auto-generes, suivi progression eleves, certificats.',
    icon: '🎓', color: '#6366F1', industry: 'Education',
    features: ['Cours generes par IA', 'Quiz automatiques', 'Suivi progression', 'Certificats', 'Adapte au programme local', 'Multi-niveaux'],
    useCases: ['Ecoles', 'Centres de formation', 'E-learning', 'Universites'],
    faq: [{ q: 'L\'IA cree les cours toute seule ?', a: 'Oui, vous donnez le sujet et le niveau, l\'IA genere le cours complet avec modules et quiz.' }],
    cta: 'Digitaliser ma formation',
  },
  'ai-finance': {
    title: 'IA pour Finance — Credit Scoring, Fraude, Previsions | Orlode',
    h1: 'IA pour la Finance', description: 'Agent financier IA : scoring de credit, detection fraude, previsions tresorerie, rapports automatiques.',
    icon: '🏦', color: '#0891B2', industry: 'Finance / Microfinance',
    features: ['Credit scoring IA', 'Detection de fraude', 'Previsions tresorerie', 'Rapports financiers auto', 'Gestion prets', 'Analyse tendances marche'],
    useCases: ['Microfinance', 'Banques', 'Fintech', 'Courtiers'],
    faq: [{ q: 'Le scoring est-il fiable ?', a: 'L\'IA analyse des dizaines de facteurs. La precision s\'ameliore avec vos donnees.' }],
    cta: 'Essayer pour ma fintech',
  },
};

const ALL_SLUGS = Object.keys(SEO_PAGES);

export default function AgentSEOPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? SEO_PAGES[slug] : null;

  useSEO({
    title: page?.title,
    description: page?.description,
    path: slug ? `/ai/${slug}` : undefined,
  });

  if (!page) return (
    <div style={{ minHeight: '100vh', background: '#080C1A', color: '#fff', padding: 40, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Page introuvable</h1>
      <Link to="/" style={{ color: '#a855f7' }}>Retour a l'accueil</Link>
    </div>
  );

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: '#fff', color: '#111827' }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #f3f4f6', padding: '12px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ fontWeight: 700, fontSize: 18, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, color: '#111827' }}>
            <img src="/logo.png" alt="Orlode" style={{ width: 28, height: 28, borderRadius: 6 }} /> Orlode AI
          </Link>
          <Link to="/register" style={{ padding: '10px 20px', background: page.color, color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Essai gratuit
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: 'clamp(60px, 10vw, 100px) 24px', textAlign: 'center', background: `linear-gradient(135deg, ${page.color}08, ${page.color}03)` }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>{page.icon}</span>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>{page.h1}</h1>
          <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#6b7280', lineHeight: 1.7, marginBottom: 32 }}>{page.description}</p>
          <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: page.color, color: '#fff', borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none', boxShadow: `0 4px 14px ${page.color}40` }}>
            <Zap size={16} /> {page.cta} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>Fonctionnalites</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {page.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'start', gap: 10, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
                <Check size={16} style={{ color: page.color, marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ padding: '64px 24px', background: '#f9fafb' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Pour qui ?</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {page.useCases.map((u, i) => (
              <span key={i} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: 14 }}>{u}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>Questions frequentes</h2>
          {page.faq.map((f, i) => (
            <div key={i} style={{ marginBottom: 20, padding: 20, background: '#f9fafb', borderRadius: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Schema FAQ for Google Rich Results */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: page.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }) }} />

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center', background: `linear-gradient(135deg, ${page.color}10, ${page.color}05)` }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Pret a essayer ?</h2>
        <p style={{ color: '#6b7280', marginBottom: 24 }}>Creez votre compte gratuitement en 2 minutes.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ padding: '14px 28px', background: page.color, color: '#fff', borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
            <Zap size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Essai gratuit
          </Link>
          <Link to="/" style={{ padding: '14px 28px', background: '#fff', color: '#374151', borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: '1px solid #e5e7eb' }}>
            Voir tous les agents
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '32px 24px', background: '#111827', color: '#9ca3af', textAlign: 'center' }}>
        <p style={{ fontSize: 13 }}>Orlode AI — 48 agents IA pour votre entreprise</p>
        <p style={{ fontSize: 11, marginTop: 8 }}>© {new Date().getFullYear()} Orlode AI</p>
      </footer>
    </div>
  );
}

// Export for sitemap generation
export { ALL_SLUGS, SEO_PAGES };
