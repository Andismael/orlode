/**
 * Agent Dashboard Configuration
 * Each built-in agent has its config: pages, stats, quick actions, data collections
 */

export interface AgentPageLink {
  path: string;
  label: string;
  icon: string; // lucide icon name
  description: string;
}

export interface AgentStat {
  key: string;
  label: string;
  icon: string;
  color: string; // tailwind color
  collection?: string; // Firestore collection to count
  defaultValue?: string;
}

export interface AgentQuickAction {
  label: string;
  prompt: string; // auto-fill chat with this
  icon: string;
}

export interface AgentDashboardConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string; // gradient from/to
  category: string;
  pages: AgentPageLink[];
  stats: AgentStat[];
  quickActions: AgentQuickAction[];
  dataCollections: { key: string; label: string; columns: { key: string; label: string }[] }[];
}

export const AGENT_DASHBOARDS: Record<string, AgentDashboardConfig> = {
  // ── CORE ─────────────────────────────────────────────────────
  knowledge: {
    id: 'knowledge', name: 'Knowledge', icon: '📚', description: 'Le cerveau de votre entreprise — Documents, Q&A, analyse, génération',
    color: 'from-blue-600 to-emerald-500', category: 'Core',
    pages: [
      { path: '/knowledge', label: 'Chat Q&A', icon: 'MessageSquare', description: 'Posez vos questions aux documents' },
      { path: '/data', label: 'Bibliothèque', icon: 'FolderOpen', description: 'Tous vos documents indexés' },
    ],
    stats: [
      { key: 'documents', label: 'Documents indexés', icon: 'FileText', color: 'blue', collection: 'documents' },
      { key: 'questions', label: 'Questions posées', icon: 'MessageSquare', color: 'green', collection: 'conversations' },
      { key: 'accuracy', label: 'Précision', icon: 'Target', color: 'violet', defaultValue: '94%' },
    ],
    quickActions: [
      { label: 'Rechercher dans les docs', prompt: 'Recherche dans mes documents : ', icon: 'Search' },
      { label: 'Résumer un document', prompt: 'Résume le dernier document uploadé', icon: 'FileText' },
      { label: 'Extraire des données', prompt: 'Extrais les données clés de mes documents', icon: 'Database' },
      { label: 'Indexer un fichier', prompt: 'Indexe ce document', icon: 'Upload' },
      { label: 'Générer un document', prompt: 'Génère un rapport sur ', icon: 'PenTool' },
    ],
    dataCollections: [
      { key: 'documents', label: 'Documents', columns: [{ key: 'name', label: 'Nom' }, { key: 'type', label: 'Type' }, { key: 'size', label: 'Taille' }, { key: 'status', label: 'Statut' }] },
    ],
  },

  wildcard: {
    id: 'wildcard', name: 'Wildcard', icon: '🔮', description: 'Agent polyvalent pour toute tâche',
    color: 'from-purple-600 to-pink-500', category: 'Core',
    pages: [
      { path: '/chat', label: 'Chat libre', icon: 'MessageSquare', description: 'Discutez de tout' },
    ],
    stats: [
      { key: 'conversations', label: 'Conversations', icon: 'MessageSquare', color: 'purple', collection: 'conversations' },
      { key: 'tasks', label: 'Tâches résolues', icon: 'CheckCircle', color: 'green', defaultValue: '—' },
      { key: 'languages', label: 'Langues', icon: 'Globe', color: 'blue', defaultValue: '6' },
      { key: 'uptime', label: 'Disponibilité', icon: 'Activity', color: 'emerald', defaultValue: '99.9%' },
    ],
    quickActions: [
      { label: 'Traduire un texte', prompt: 'Traduis en anglais : ', icon: 'Languages' },
      { label: 'Rédiger un texte', prompt: 'Rédige un texte professionnel sur ', icon: 'PenTool' },
      { label: 'Calculer', prompt: 'Calcule ', icon: 'Calculator' },
      { label: 'Résumer', prompt: 'Résume ce texte : ', icon: 'AlignLeft' },
    ],
    dataCollections: [],
  },

  // ── OPERATIONS ─────────────────────────────────────────────
  reception: {
    id: 'reception', name: 'Réception', icon: '🚪', description: 'Accueil visiteurs, pointage, présence',
    color: 'from-teal-600 to-teal-400', category: 'Opérations',
    // Tout est unifié dans ReceptionRedesignPage avec ses 12 onglets internes
    pages: [
      { path: '/reception', label: 'Réception', icon: 'LayoutDashboard', description: 'Hub complet : visiteurs, présence, badges, kiosk, rapports' },
    ],
    stats: [
      { key: 'visitors', label: 'Visiteurs aujourd\'hui', icon: 'Users', color: 'teal', collection: 'visitors' },
      { key: 'present', label: 'Employés présents', icon: 'UserCheck', color: 'green' },
      { key: 'absent', label: 'Absents', icon: 'UserX', color: 'red' },
      { key: 'appointments', label: 'RDV du jour', icon: 'Calendar', color: 'blue', collection: 'appointments' },
    ],
    quickActions: [
      { label: 'Enregistrer un visiteur', prompt: 'Enregistre un visiteur : ', icon: 'UserPlus' },
      { label: 'Voir les présences', prompt: 'Combien d\'employés sont présents aujourd\'hui ?', icon: 'Users' },
      { label: 'Créer un RDV', prompt: 'Crée un rendez-vous pour ', icon: 'Calendar' },
    ],
    dataCollections: [
      { key: 'visitors', label: 'Visiteurs', columns: [{ key: 'name', label: 'Nom' }, { key: 'company', label: 'Entreprise' }, { key: 'host', label: 'Hôte' }, { key: 'checkinTime', label: 'Arrivée' }] },
    ],
  },

  hr: {
    id: 'hr', name: 'Ressources Humaines', icon: '👩', description: 'Congés, recrutement, onboarding',
    color: 'from-indigo-600 to-indigo-400', category: 'Opérations',
    // Tout est unifié dans HRRedesignPage avec ses 19 onglets internes
    pages: [
      { path: '/hr', label: 'RH', icon: 'LayoutDashboard', description: 'Hub complet : effectifs, congés, paie, performance, onboarding' },
    ],
    stats: [
      { key: 'employees', label: 'Employés', icon: 'Users', color: 'indigo', collection: 'users' },
      { key: 'leaves', label: 'Congés en cours', icon: 'Calendar', color: 'amber', collection: 'leaveRequests' },
      { key: 'onboarding', label: 'En onboarding', icon: 'UserPlus', color: 'green', collection: 'onboarding' },
      { key: 'satisfaction', label: 'Satisfaction', icon: 'Heart', color: 'pink', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Poser un congé', prompt: 'Je veux poser des congés du ', icon: 'Calendar' },
      { label: 'Mon solde de congés', prompt: 'Quel est mon solde de congés ?', icon: 'Calculator' },
      { label: 'Annuaire employés', prompt: 'Montre l\'annuaire des employés', icon: 'Users' },
      { label: 'Checklist onboarding', prompt: 'Crée une checklist d\'onboarding pour un nouveau ', icon: 'ClipboardList' },
    ],
    dataCollections: [
      { key: 'leaveRequests', label: 'Demandes de congés', columns: [{ key: 'userId', label: 'Employé' }, { key: 'type', label: 'Type' }, { key: 'startDate', label: 'Début' }, { key: 'endDate', label: 'Fin' }, { key: 'status', label: 'Statut' }] },
    ],
  },

  accounting: {
    id: 'accounting', name: 'Comptabilité', icon: '💰', description: 'Factures, budget, trésorerie',
    color: 'from-green-600 to-green-400', category: 'Opérations',
    // Tout est unifié dans FinanceRedesignPage avec ses 8 onglets internes
    pages: [
      { path: '/finance', label: 'Finance', icon: 'LayoutDashboard', description: 'Hub complet : factures, budget, dépenses, cash-flow, P&L' },
    ],
    stats: [
      { key: 'invoices', label: 'Factures', icon: 'FileText', color: 'green', collection: 'invoices' },
      { key: 'revenue', label: 'Revenus du mois', icon: 'TrendingUp', color: 'emerald', defaultValue: '—' },
      { key: 'expenses', label: 'Dépenses', icon: 'TrendingDown', color: 'red', collection: 'expenses' },
      { key: 'balance', label: 'Trésorerie', icon: 'Wallet', color: 'blue', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Créer une facture', prompt: 'Crée une facture de ', icon: 'FilePlus' },
      { label: 'Voir le budget', prompt: 'Quel est le budget restant ?', icon: 'BarChart2' },
      { label: 'Analyse cash-flow', prompt: 'Analyse le cash-flow du mois', icon: 'TrendingUp' },
      { label: 'Note de frais', prompt: 'J\'ai une note de frais de ', icon: 'Receipt' },
    ],
    dataCollections: [
      { key: 'invoices', label: 'Factures', columns: [{ key: 'number', label: '#' }, { key: 'client', label: 'Client' }, { key: 'amount', label: 'Montant' }, { key: 'status', label: 'Statut' }, { key: 'dueDate', label: 'Échéance' }] },
    ],
  },

  sales: {
    id: 'sales', name: 'Commercial', icon: '🤝', description: 'Pipeline, leads, devis',
    color: 'from-orange-600 to-orange-400', category: 'Opérations',
    pages: [
      { path: '/sales', label: 'Pipeline', icon: 'TrendingUp', description: 'Pipeline commercial' },
      { path: '/sales/quotes', label: 'Devis', icon: 'FileText', description: 'Gestion des devis' },
      { path: '/workspace', label: 'Espace travail', icon: 'Briefcase', description: 'Devis et actions' },
    ],
    stats: [
      { key: 'leads', label: 'Leads actifs', icon: 'Users', color: 'orange', collection: 'leads' },
      { key: 'pipeline', label: 'Pipeline', icon: 'TrendingUp', color: 'amber', defaultValue: '—' },
      { key: 'quotes', label: 'Devis envoyés', icon: 'FileText', color: 'blue', collection: 'quotes' },
      { key: 'conversion', label: 'Taux conversion', icon: 'Target', color: 'green', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Ajouter un lead', prompt: 'Ajoute un lead : ', icon: 'UserPlus' },
      { label: 'Créer un devis', prompt: 'Crée un devis pour ', icon: 'FileText' },
      { label: 'Pipeline actuel', prompt: 'Montre le pipeline commercial', icon: 'TrendingUp' },
      { label: 'Rapport ventes', prompt: 'Génère un rapport de ventes', icon: 'BarChart3' },
    ],
    dataCollections: [
      { key: 'leads', label: 'Leads', columns: [{ key: 'name', label: 'Nom' }, { key: 'company', label: 'Entreprise' }, { key: 'status', label: 'Statut' }, { key: 'value', label: 'Valeur' }] },
    ],
  },

  support: {
    id: 'support', name: 'Support Client', icon: '📞', description: 'Tickets SLA, suggestion IA, auto-assignation, base de connaissances, satisfaction',
    color: 'from-cyan-600 to-cyan-400', category: 'Opérations',
    pages: [
      { path: '/support', label: 'Centre Support', icon: 'HeadphonesIcon', description: 'Dashboard tickets + KPIs + SLA' },
      { path: '/support/kb', label: 'Base de connaissances', icon: 'BookOpen', description: 'FAQ et articles' },
    ],
    stats: [
      { key: 'open', label: 'Tickets ouverts', icon: 'CircleDot', color: 'cyan', collection: 'tickets' },
      { key: 'resolved', label: 'Résolus ce mois', icon: 'CheckCircle', color: 'green', defaultValue: '—' },
      { key: 'avgTime', label: 'Temps moyen', icon: 'Clock', color: 'amber', defaultValue: '—' },
      { key: 'satisfaction', label: 'Satisfaction', icon: 'Star', color: 'yellow', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Créer un ticket', prompt: 'Crée un ticket support : ', icon: 'Plus' },
      { label: 'Chercher dans la FAQ', prompt: 'Comment faire pour ', icon: 'Search' },
      { label: 'Escalader', prompt: 'Escalade le ticket ', icon: 'ArrowUp' },
    ],
    dataCollections: [
      { key: 'tickets', label: 'Tickets', columns: [{ key: 'subject', label: 'Sujet' }, { key: 'priority', label: 'Priorité' }, { key: 'status', label: 'Statut' }, { key: 'assignee', label: 'Assigné' }] },
    ],
  },

  it: {
    id: 'it', name: 'IT', icon: '🖥', description: 'Helpdesk SLA, inventaire, licences, monitoring, suggestion IA',
    color: 'from-slate-600 to-slate-400', category: 'Opérations',
    pages: [
      { path: '/it', label: 'Dashboard IT', icon: 'Monitor', description: 'Vue d\'ensemble' },
      { path: '/it/tickets', label: 'Tickets', icon: 'CircleDot', description: 'Tickets IT' },
      { path: '/it/assets', label: 'Assets', icon: 'Package', description: 'Inventaire matériel' },
      { path: '/it/licenses', label: 'Licences', icon: 'Key', description: 'Gestion des licences' },
    ],
    stats: [
      { key: 'tickets', label: 'Tickets IT', icon: 'CircleDot', color: 'slate', collection: 'itTickets' },
      { key: 'assets', label: 'Assets', icon: 'Package', color: 'blue', collection: 'assets' },
      { key: 'licenses', label: 'Licences', icon: 'Key', color: 'violet', collection: 'licenses' },
      { key: 'uptime', label: 'Uptime', icon: 'Activity', color: 'green', defaultValue: '99.9%' },
    ],
    quickActions: [
      { label: 'Créer ticket IT', prompt: 'Crée un ticket IT : ', icon: 'Plus' },
      { label: 'Inventaire', prompt: 'Liste les assets en inventaire', icon: 'Package' },
      { label: 'Statut serveurs', prompt: 'Quel est le statut des serveurs ?', icon: 'Activity' },
    ],
    dataCollections: [
      { key: 'itTickets', label: 'Tickets IT', columns: [{ key: 'subject', label: 'Sujet' }, { key: 'priority', label: 'Priorité' }, { key: 'status', label: 'Statut' }] },
    ],
  },

  // ── STRATEGY ─────────────────────────────────────────────
  meeting: {
    id: 'meeting', name: 'Réunions', icon: '🎤', description: 'Transcription, résumé, actions',
    color: 'from-rose-600 to-rose-400', category: 'Stratégie',
    pages: [
      { path: '/meetings', label: 'Réunions', icon: 'Video', description: 'Liste des réunions' },
    ],
    stats: [
      { key: 'total', label: 'Réunions', icon: 'Video', color: 'rose', collection: 'meetings' },
      { key: 'thisWeek', label: 'Cette semaine', icon: 'Calendar', color: 'blue', defaultValue: '—' },
      { key: 'actions', label: 'Actions en cours', icon: 'CheckSquare', color: 'amber', defaultValue: '—' },
      { key: 'hours', label: 'Heures ce mois', icon: 'Clock', color: 'gray', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Résumer une réunion', prompt: 'Résume la dernière réunion', icon: 'AlignLeft' },
      { label: 'Actions à faire', prompt: 'Quelles sont les actions décidées en réunion ?', icon: 'CheckSquare' },
      { label: 'Transcrire', prompt: 'Transcris cet enregistrement audio', icon: 'Mic' },
    ],
    dataCollections: [],
  },

  vision: {
    id: 'vision', name: 'Vision', icon: '👁', description: 'Reconnaissance faciale et analyse d\'images',
    color: 'from-fuchsia-600 to-fuchsia-400', category: 'Stratégie',
    pages: [
      { path: '/faces', label: 'Reconnaissance', icon: 'ScanFace', description: 'Annuaire facial' },
    ],
    stats: [
      { key: 'faces', label: 'Visages enregistrés', icon: 'ScanFace', color: 'fuchsia', defaultValue: '—' },
      { key: 'detections', label: 'Détections aujourd\'hui', icon: 'Eye', color: 'blue', defaultValue: '—' },
      { key: 'accuracy', label: 'Précision', icon: 'Target', color: 'green', defaultValue: '96%' },
      { key: 'cameras', label: 'Caméras actives', icon: 'Camera', color: 'gray', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Analyser une image', prompt: 'Analyse cette image', icon: 'Image' },
      { label: 'Identifier un visage', prompt: 'Identifie cette personne', icon: 'ScanFace' },
    ],
    dataCollections: [],
  },

  insights: {
    id: 'insights', name: 'Insights', icon: '📊', description: 'Tendances, anomalies et recommandations',
    color: 'from-yellow-600 to-amber-400', category: 'Stratégie',
    pages: [
      { path: '/insights', label: 'Tableau Insights', icon: 'BarChart3', description: 'Tendances et alertes' },
      { path: '/analytics', label: 'Analytique', icon: 'TrendingUp', description: 'Analyse avancée' },
    ],
    stats: [
      { key: 'insights', label: 'Insights générés', icon: 'Lightbulb', color: 'amber', collection: 'insights' },
      { key: 'trends', label: 'Tendances actives', icon: 'TrendingUp', color: 'blue', defaultValue: '—' },
      { key: 'anomalies', label: 'Anomalies', icon: 'AlertTriangle', color: 'red', defaultValue: '0' },
      { key: 'recommendations', label: 'Recommandations', icon: 'Sparkles', color: 'violet', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Tendances du mois', prompt: 'Quelles sont les tendances ce mois ?', icon: 'TrendingUp' },
      { label: 'Détecter anomalies', prompt: 'Détecte des anomalies dans les données', icon: 'AlertTriangle' },
      { label: 'Recommandations', prompt: 'Donne-moi des recommandations stratégiques', icon: 'Sparkles' },
    ],
    dataCollections: [],
  },

  comms: {
    id: 'comms', name: 'Communications', icon: '📧', description: 'Emails, notifications, rédaction',
    color: 'from-pink-600 to-pink-400', category: 'Stratégie',
    pages: [
      { path: '/emails', label: 'Centre Emails', icon: 'Mail', description: 'Gestion des emails' },
    ],
    stats: [
      { key: 'sent', label: 'Emails envoyés', icon: 'Send', color: 'pink', defaultValue: '—' },
      { key: 'drafts', label: 'Brouillons', icon: 'PenTool', color: 'blue', defaultValue: '—' },
      { key: 'templates', label: 'Templates', icon: 'Copy', color: 'violet', defaultValue: '—' },
      { key: 'notifications', label: 'Notifications', icon: 'Bell', color: 'amber', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Rédiger un email', prompt: 'Rédige un email professionnel pour ', icon: 'PenTool' },
      { label: 'Résumer mes emails', prompt: 'Résume mes derniers emails non lus', icon: 'AlignLeft' },
      { label: 'Email de relance', prompt: 'Rédige un email de relance pour ', icon: 'RefreshCw' },
    ],
    dataCollections: [],
  },

  marketing: {
    id: 'marketing', name: 'Marketing', icon: '📣', description: 'Posts multi-plateforme, campagnes, calendrier editorial, SEO, analytics',
    color: 'from-violet-600 to-violet-400', category: 'Stratégie',
    // Tout est unifié dans MarketingRedesignPage avec ses 13 onglets internes
    pages: [
      { path: '/marketing', label: 'Marketing', icon: 'Megaphone', description: 'Hub complet : posts, calendrier, campagnes, vidéos AI, analytics' },
    ],
    stats: [
      { key: 'campaigns', label: 'Campagnes actives', icon: 'Megaphone', color: 'violet', defaultValue: '—' },
      { key: 'posts', label: 'Posts planifiés', icon: 'PenTool', color: 'blue', collection: 'socialPosts' },
      { key: 'reach', label: 'Portée totale', icon: 'Eye', color: 'green', defaultValue: '—' },
      { key: 'engagement', label: 'Engagement', icon: 'Heart', color: 'pink', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Créer un post LinkedIn', prompt: 'Crée un post LinkedIn pour annoncer ', icon: 'PenTool' },
      { label: 'Calendrier contenu', prompt: 'Planifie un calendrier de contenu pour le mois', icon: 'Calendar' },
      { label: 'Créer une vidéo', prompt: 'Crée une vidéo marketing pour ', icon: 'Video' },
      { label: 'Analyse performance', prompt: 'Analyse la performance de nos dernières campagnes', icon: 'BarChart3' },
    ],
    dataCollections: [],
  },

  cybersecurity: {
    id: 'cybersecurity', name: 'Cybersécurité', icon: '🛡', description: 'CISO virtuel: menaces, incidents, vulns, phishing, compliance, SIEM-lite',
    color: 'from-red-600 to-red-400', category: 'Stratégie',
    pages: [
      { path: '/security', label: 'Centre de Sécurité', icon: 'Shield', description: 'Dashboard menaces, KPIs, score' },
      { path: '/security/incidents', label: 'Incidents', icon: 'AlertTriangle', description: 'Workflow complet avec timeline' },
      { path: '/security/vulnerabilities', label: 'Vulnérabilités', icon: 'Bug', description: 'Scan CVE, remediation' },
      { path: '/security/phishing', label: 'Phishing', icon: 'Fish', description: 'Simulation campagnes' },
      { path: '/security/compliance', label: 'Conformité', icon: 'CheckSquare', description: 'RGPD/ISO/SOC2/NIST' },
      { path: '/security/policies', label: 'Politiques', icon: 'FileText', description: 'Politiques securite IA' },
      { path: '/security/access', label: 'Accès', icon: 'Key', description: 'Revue MFA, dormants, privileges' },
      { path: '/security/audit', label: 'Audit logs', icon: 'FileText', description: 'Journaux d\'audit' },
    ],
    stats: [
      { key: 'score', label: 'Score sécurité', icon: 'Shield', color: 'red', defaultValue: '—' },
      { key: 'incidents', label: 'Incidents ouverts', icon: 'AlertTriangle', color: 'amber', collection: 'securityIncidents' },
      { key: 'vulns', label: 'Vulnérabilités', icon: 'Bug', color: 'orange', collection: 'vulnerabilities' },
      { key: 'threats', label: 'Menaces bloquées', icon: 'ShieldOff', color: 'blue', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Score sécurité', prompt: 'Quel est notre score de sécurité ?', icon: 'Shield' },
      { label: 'Scanner vulnérabilités', prompt: 'Lance un scan de vulnérabilités', icon: 'Bug' },
      { label: 'Simulation phishing', prompt: 'Lance une campagne de phishing test', icon: 'Fish' },
      { label: 'Audit complet IA', prompt: 'Fais un audit de sécurité complet', icon: 'Search' },
      { label: 'Conformité RGPD', prompt: 'Sommes-nous conformes au RGPD ?', icon: 'CheckSquare' },
      { label: 'Signaler incident', prompt: 'Signale un incident de sécurité : ', icon: 'AlertTriangle' },
    ],
    dataCollections: [],
  },

  legal: {
    id: 'legal', name: 'Juridique', icon: '⚖', description: 'Contrats, dossiers, echeances, conformite RGPD, clauses, analyse IA',
    color: 'from-stone-700 to-stone-500', category: 'Stratégie',
    // Tout est unifié dans LegalRedesignPage avec ses onglets internes (contrats, modèles, archives, échéances)
    pages: [
      { path: '/legal', label: 'Juridique', icon: 'Scale', description: 'Hub complet : contrats, modèles, archives, conformité RGPD' },
    ],
    stats: [
      { key: 'contracts', label: 'Contrats actifs', icon: 'FileText', color: 'stone', collection: 'contracts' },
      { key: 'pending', label: 'En attente signature', icon: 'Clock', color: 'amber', defaultValue: '—' },
      { key: 'compliance', label: 'Conformité', icon: 'CheckSquare', color: 'green', defaultValue: '—' },
      { key: 'deadlines', label: 'Échéances proches', icon: 'AlertTriangle', color: 'red', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Rédiger un contrat', prompt: 'Rédige un contrat de prestation pour ', icon: 'PenTool' },
      { label: 'Vérifier conformité', prompt: 'Vérifie si notre politique est conforme RGPD', icon: 'CheckSquare' },
      { label: 'Analyser un contrat', prompt: 'Analyse ce contrat et identifie les risques', icon: 'Search' },
    ],
    dataCollections: [
      { key: 'contracts', label: 'Contrats', columns: [{ key: 'title', label: 'Titre' }, { key: 'parties', label: 'Parties' }, { key: 'status', label: 'Statut' }, { key: 'expiresAt', label: 'Expiration' }] },
    ],
  },

  training: {
    id: 'training', name: 'Formation', icon: '🎓', description: 'Cours IA, quiz auto, assignation, progression, certificats, leaderboard',
    color: 'from-sky-600 to-sky-400', category: 'Stratégie',
    pages: [
      { path: '/training', label: 'Centre Formation', icon: 'GraduationCap', description: 'Catalogue de cours' },
      { path: '/training/manage', label: 'Gestion', icon: 'Settings', description: 'Gérer les cours' },
    ],
    stats: [
      { key: 'courses', label: 'Cours disponibles', icon: 'BookOpen', color: 'sky', collection: 'courses' },
      { key: 'enrolled', label: 'Inscrits', icon: 'Users', color: 'blue', defaultValue: '—' },
      { key: 'completion', label: 'Taux complétion', icon: 'CheckCircle', color: 'green', defaultValue: '—' },
      { key: 'quizzes', label: 'Quiz créés', icon: 'HelpCircle', color: 'violet', collection: 'quizzes' },
    ],
    quickActions: [
      { label: 'Créer un cours', prompt: 'Crée un cours sur ', icon: 'BookOpen' },
      { label: 'Générer un quiz', prompt: 'Génère un quiz de 10 questions sur ', icon: 'HelpCircle' },
      { label: 'Progression', prompt: 'Montre la progression des apprenants', icon: 'BarChart3' },
    ],
    dataCollections: [],
  },

  news: {
    id: 'news', name: 'Veille', icon: '⭐', description: 'Veille sectorielle et concurrentielle',
    color: 'from-amber-600 to-yellow-400', category: 'Stratégie',
    pages: [],
    stats: [
      { key: 'articles', label: 'Articles suivis', icon: 'Newspaper', color: 'amber', defaultValue: '—' },
      { key: 'alerts', label: 'Alertes actives', icon: 'Bell', color: 'red', defaultValue: '—' },
      { key: 'competitors', label: 'Concurrents suivis', icon: 'Eye', color: 'blue', defaultValue: '—' },
      { key: 'briefings', label: 'Briefings / jour', icon: 'Clock', color: 'green', defaultValue: '6' },
    ],
    quickActions: [
      { label: 'Dernières tendances', prompt: 'Quelles sont les dernières tendances dans notre secteur ?', icon: 'TrendingUp' },
      { label: 'Analyse concurrents', prompt: 'Analyse nos concurrents principaux', icon: 'Eye' },
      { label: 'Briefing du jour', prompt: 'Donne-moi le briefing actualités du jour', icon: 'Newspaper' },
    ],
    dataCollections: [],
  },

  coach: {
    id: 'coach', name: 'Coach', icon: '🧑‍🏫', description: 'Coaching, bien-être, mentorat',
    color: 'from-lime-600 to-lime-400', category: 'Stratégie',
    pages: [],
    stats: [
      { key: 'sessions', label: 'Sessions coaching', icon: 'MessageSquare', color: 'lime', defaultValue: '—' },
      { key: 'goals', label: 'Objectifs actifs', icon: 'Target', color: 'blue', defaultValue: '—' },
      { key: 'wellbeing', label: 'Score bien-être', icon: 'Heart', color: 'pink', defaultValue: '—' },
      { key: 'mentees', label: 'Mentorés', icon: 'Users', color: 'violet', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Coaching carrière', prompt: 'Donne-moi des conseils pour évoluer vers un poste de ', icon: 'TrendingUp' },
      { label: 'Bien-être', prompt: 'Analyse mon niveau de stress et recommande des actions', icon: 'Heart' },
      { label: 'Dynamique équipe', prompt: 'Analyse la dynamique de mon équipe', icon: 'Users' },
      { label: 'Plan de développement', prompt: 'Crée un plan de développement professionnel', icon: 'Target' },
    ],
    dataCollections: [],
  },

  datascientist: {
    id: 'datascientist', name: 'Data Scientist', icon: '🔬', description: 'Analyse cross-modules, prédictions',
    color: 'from-cyan-700 to-blue-500', category: 'Stratégie',
    pages: [
      { path: '/analytics', label: 'Analytique', icon: 'BarChart3', description: 'Tableaux de bord' },
    ],
    stats: [
      { key: 'analyses', label: 'Analyses réalisées', icon: 'BarChart3', color: 'cyan', defaultValue: '—' },
      { key: 'predictions', label: 'Prédictions actives', icon: 'TrendingUp', color: 'blue', defaultValue: '—' },
      { key: 'correlations', label: 'Corrélations trouvées', icon: 'GitBranch', color: 'violet', defaultValue: '—' },
      { key: 'accuracy', label: 'Précision modèles', icon: 'Target', color: 'green', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Analyse cross-modules', prompt: 'Synthétise les données de tous les départements', icon: 'BarChart3' },
      { label: 'Prédictions revenus', prompt: 'Prédis le revenu du prochain trimestre', icon: 'TrendingUp' },
      { label: 'Corrélations', prompt: 'Trouve les corrélations entre RH et ventes', icon: 'GitBranch' },
      { label: 'Évaluation risques', prompt: 'Identifie les risques business actuels', icon: 'AlertTriangle' },
    ],
    dataCollections: [],
  },

  physical_security: {
    id: 'physical_security', name: 'Sécurité Physique', icon: '🛡️', description: 'Gestion gardes, rotations, incidents, alertes, patrouilles',
    color: 'from-slate-700 to-red-600', category: 'Opérations',
    pages: [
      { path: '/physical-security', label: 'Centre Sécurité', icon: 'Shield', description: 'Dashboard sécurité physique' },
      { path: '/physical-security/guards', label: 'Gardes', icon: 'Users', description: 'Liste et planning des gardes' },
      { path: '/physical-security/incidents', label: 'Incidents', icon: 'AlertTriangle', description: 'Registre des incidents' },
      { path: '/physical-security/patrols', label: 'Patrouilles', icon: 'MapPin', description: 'Suivi des rondes' },
      { path: '/physical-security/access', label: 'Accès', icon: 'KeyRound', description: 'Logs d\'accès' },
      { path: '/physical-security/reports', label: 'Rapports', icon: 'BarChart3', description: 'Rapports sécurité' },
    ],
    stats: [
      { key: 'guards', label: 'Gardes en service', icon: 'Shield', color: 'slate', defaultValue: '—' },
      { key: 'incidents', label: 'Incidents aujourd\'hui', icon: 'AlertTriangle', color: 'red', defaultValue: '0' },
      { key: 'patrols', label: 'Rondes effectuées', icon: 'MapPin', color: 'blue', defaultValue: '—' },
      { key: 'accessLogs', label: 'Accès du jour', icon: 'KeyRound', color: 'green', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Signaler un incident', prompt: 'Signale un incident de sécurité : ', icon: 'AlertTriangle' },
      { label: 'Planning gardes', prompt: 'Montre le planning des gardes cette semaine', icon: 'Calendar' },
      { label: 'Suivi rondes', prompt: 'Où en sont les rondes de patrouille ?', icon: 'MapPin' },
      { label: 'Rapport quotidien', prompt: 'Génère le rapport de sécurité quotidien', icon: 'BarChart3' },
      { label: 'Alerte urgence', prompt: 'Déclenche une alerte de sécurité urgente : ', icon: 'Bell' },
      { label: 'Analyse risques', prompt: 'Analyse les zones et heures à risque', icon: 'TrendingUp' },
    ],
    dataCollections: [
      { key: 'incidents', label: 'Incidents', columns: [{ key: 'type', label: 'Type' }, { key: 'location', label: 'Lieu' }, { key: 'severity', label: 'Gravité' }, { key: 'status', label: 'Statut' }, { key: 'reportedAt', label: 'Date' }] },
    ],
  },

  surveillance: {
    id: 'surveillance', name: 'Surveillance Caméra', icon: '📹', description: 'Monitoring CCTV, détection IA, alertes temps réel, rapports 24h',
    color: 'from-gray-800 to-blue-700', category: 'Opérations',
    pages: [
      { path: '/surveillance', label: 'Centre Surveillance', icon: 'Camera', description: 'Dashboard caméras et alertes' },
      { path: '/surveillance/cameras', label: 'Caméras', icon: 'Video', description: 'Flux caméras en direct' },
      { path: '/surveillance/alerts', label: 'Alertes', icon: 'Bell', description: 'Alertes détectées par IA' },
      { path: '/surveillance/zones', label: 'Zones', icon: 'Map', description: 'Zones de surveillance' },
      { path: '/surveillance/recordings', label: 'Enregistrements', icon: 'HardDrive', description: 'Archives vidéo' },
      { path: '/surveillance/reports', label: 'Rapports 24h', icon: 'BarChart3', description: 'Rapports quotidiens' },
    ],
    stats: [
      { key: 'cameras', label: 'Caméras actives', icon: 'Camera', color: 'blue', defaultValue: '—' },
      { key: 'alerts', label: 'Alertes aujourd\'hui', icon: 'AlertTriangle', color: 'red', defaultValue: '0' },
      { key: 'detections', label: 'Détections IA', icon: 'Eye', color: 'amber', defaultValue: '—' },
      { key: 'uptime', label: 'Uptime caméras', icon: 'Activity', color: 'green', defaultValue: '99.5%' },
    ],
    quickActions: [
      { label: 'Voir les caméras', prompt: 'Montre le statut de toutes les caméras', icon: 'Camera' },
      { label: 'Dernières alertes', prompt: 'Quelles sont les dernières alertes détectées ?', icon: 'AlertTriangle' },
      { label: 'Rapport 24h', prompt: 'Génère le rapport de surveillance des 24 dernières heures', icon: 'BarChart3' },
      { label: 'Analyser une zone', prompt: 'Analyse l\'activité dans la zone ', icon: 'Map' },
      { label: 'Heatmap trafic', prompt: 'Montre la heatmap de trafic d\'aujourd\'hui', icon: 'Flame' },
      { label: 'Rechercher un clip', prompt: 'Recherche dans les enregistrements : ', icon: 'Search' },
    ],
    dataCollections: [
      { key: 'alerts', label: 'Alertes', columns: [{ key: 'type', label: 'Type' }, { key: 'camera', label: 'Caméra' }, { key: 'zone', label: 'Zone' }, { key: 'severity', label: 'Gravité' }, { key: 'timestamp', label: 'Heure' }] },
    ],
  },

  commercial: {
    id: 'commercial', name: 'Agent Commercial', icon: '💼', description: 'Propositions, prospection, conversion',
    color: 'from-amber-700 to-orange-500', category: 'Stratégie',
    pages: [
      { path: '/commercial', label: 'Page commerciale', icon: 'Briefcase', description: 'Agent public' },
    ],
    stats: [
      { key: 'prospects', label: 'Prospects', icon: 'Users', color: 'amber', defaultValue: '—' },
      { key: 'proposals', label: 'Propositions', icon: 'FileText', color: 'blue', defaultValue: '—' },
      { key: 'conversion', label: 'Taux conversion', icon: 'Target', color: 'green', defaultValue: '—' },
      { key: 'chats', label: 'Chats visiteurs', icon: 'MessageSquare', color: 'violet', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Analyser un prospect', prompt: 'Analyse le site web de ce prospect : ', icon: 'Search' },
      { label: 'Script de vente', prompt: 'Génère un script de vente pour ', icon: 'PenTool' },
      { label: 'Proposition commerciale', prompt: 'Crée une proposition commerciale pour ', icon: 'FileText' },
    ],
    dataCollections: [],
  },
  website: {
    id: 'website', name: 'Website Builder', icon: '🌐', description: 'Creez un site web pro avec widget chat IA integre',
    color: 'from-blue-500 to-violet-500', category: 'Operations',
    pages: [
      { path: '/website', label: 'Builder', icon: 'Globe', description: 'Mode IA ou manuel · drag-drop · preview live' },
    ],
    stats: [
      { key: 'status', label: 'Statut', icon: 'Globe', color: 'green', defaultValue: 'Non cree' },
      { key: 'pages', label: 'Pages', icon: 'FileText', color: 'blue', defaultValue: '0' },
      { key: 'visitors', label: 'Visiteurs', icon: 'Users', color: 'violet', defaultValue: '—' },
      { key: 'chats', label: 'Chats widget', icon: 'MessageSquare', color: 'amber', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Creer mon site web', prompt: 'Cree un site web professionnel pour mon entreprise', icon: 'Globe' },
      { label: 'Modifier le site', prompt: 'Modifie mon site web : ', icon: 'PenTool' },
      { label: 'Ajouter une page', prompt: 'Ajoute une page promotions a mon site web', icon: 'Plus' },
      { label: 'Code widget', prompt: 'Donne moi le code pour ajouter le chat IA sur mon site WordPress', icon: 'Code' },
      { label: 'Statut du site', prompt: 'Quel est le statut de mon site web ?', icon: 'Eye' },
    ],
    dataCollections: [],
  },

  approval: {
    id: 'approval', name: 'Approbation & Securite', icon: '✅', description: 'Approbations multi-niveaux + audit securite donnees + compliance RGPD',
    color: 'from-emerald-500 to-teal-500', category: 'Operations',
    pages: [
      { path: '/approval', label: 'En attente', icon: 'Clock', description: 'Demandes en attente de validation' },
      { path: '/approval/history', label: 'Historique', icon: 'CheckCircle', description: 'Approbations passees' },
      { path: '/approval/analytics', label: 'Analytics', icon: 'BarChart3', description: 'Statistiques d\'approbation' },
    ],
    stats: [
      { key: 'pending', label: 'En attente', icon: 'Clock', color: 'amber', defaultValue: '0' },
      { key: 'approved', label: 'Approuvees', icon: 'CheckCircle', color: 'green', defaultValue: '—' },
      { key: 'securityScore', label: 'Score securite', icon: 'Shield', color: 'blue', defaultValue: '—' },
      { key: 'rate', label: 'Taux approbation', icon: 'TrendingUp', color: 'emerald', defaultValue: '—' },
    ],
    quickActions: [
      { label: 'Demandes en attente', prompt: 'Montre toutes les demandes en attente d\'approbation', icon: 'Clock' },
      { label: 'Creer une demande', prompt: 'Cree une demande d\'approbation pour ', icon: 'Plus' },
      { label: 'Demande de conge', prompt: 'Cree une demande de conge pour 5 jours a partir du ', icon: 'Calendar' },
      { label: 'Note de frais', prompt: 'Cree une demande d\'approbation pour une note de frais de ', icon: 'Receipt' },
      { label: 'Audit securite', prompt: 'Lance un audit de securite complet de nos donnees', icon: 'Shield' },
      { label: 'Compliance RGPD', prompt: 'Verifie notre conformite RGPD', icon: 'CheckSquare' },
      { label: 'Audit permissions', prompt: 'Verifie les permissions de tous les membres', icon: 'Key' },
      { label: 'Review agent', prompt: 'Analyse et review cet agent marketplace soumis : ', icon: 'Search' },
    ],
    dataCollections: [
      { key: 'approvals', label: 'Approbations', columns: [{ key: 'title', label: 'Titre' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Statut' }, { key: 'currentLevel', label: 'Niveau' }] },
    ],
  },

  workflow: {
    id: 'workflow', name: 'Workflow Automation', icon: '⚡', description: 'Automatisez vos processus: triggers, approbations, notifications, taches planifiees',
    color: 'from-yellow-500 to-orange-500', category: 'Operations',
    // Tout est unifié dans WorkflowRedesignPage avec ses onglets internes (workflows, builder, templates, historique)
    pages: [
      { path: '/workflow', label: 'Workflows', icon: 'Zap', description: 'Hub complet : workflows actifs, builder, templates, historique d\'exécution' },
    ],
    stats: [
      { key: 'active', label: 'Workflows actifs', icon: 'Zap', color: 'amber', defaultValue: '—' },
      { key: 'executions', label: 'Executions / jour', icon: 'Activity', color: 'green', defaultValue: '—' },
      { key: 'success', label: 'Taux de succes', icon: 'CheckCircle', color: 'emerald', defaultValue: '98%' },
      { key: 'pending', label: 'En attente approbation', icon: 'Clock', color: 'blue', defaultValue: '0' },
    ],
    quickActions: [
      { label: 'Creer un workflow', prompt: 'Cree un workflow pour automatiser ', icon: 'Zap' },
      { label: 'Relance factures', prompt: 'Cree un workflow de relance automatique pour les factures impayees', icon: 'RefreshCw' },
      { label: 'Onboarding auto', prompt: 'Cree un workflow d\'onboarding automatise pour les nouveaux employes', icon: 'UserPlus' },
      { label: 'Escalade tickets', prompt: 'Cree un workflow d\'escalade automatique quand un ticket depasse le SLA', icon: 'ArrowUp' },
      { label: 'Rapport hebdo', prompt: 'Cree un workflow qui genere et envoie un rapport hebdomadaire chaque lundi', icon: 'BarChart3' },
      { label: 'Voir les executions', prompt: 'Montre l\'historique des executions de workflows', icon: 'Clock' },
    ],
    dataCollections: [
      { key: 'workflows', label: 'Workflows', columns: [{ key: 'name', label: 'Nom' }, { key: 'trigger', label: 'Trigger' }, { key: 'status', label: 'Statut' }, { key: 'lastRun', label: 'Derniere exec' }] },
    ],
  },
};

export function getAgentDashboard(agentId: string): AgentDashboardConfig | undefined {
  return AGENT_DASHBOARDS[agentId];
}

export function getAllAgentDashboards(): AgentDashboardConfig[] {
  return Object.values(AGENT_DASHBOARDS);
}
