/**
 * Agent & Skills catalog
 * Defines all available agents with their skills and plan requirements
 */

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'core' | 'operations' | 'strategy' | 'custom';
  skills: AgentSkill[];
  minPlan: 'free' | 'starter' | 'business' | 'enterprise'; // minimum plan to access this agent
  // beta: marks an agent as still under active testing. UI shows a "BETA"
  // badge and prompts users to share feedback. No billing impact.
  beta?: boolean;
}

export const AGENT_CATALOG: AgentDefinition[] = [
  // ── Core (always included) ──
  {
    id: 'orchestrator', name: 'Orchestrateur', description: 'Coordonne tous les agents et route les requetes', icon: '🧠', category: 'core', minPlan: 'free',
    skills: [
      { id: 'route_request', name: 'Routage intelligent', description: 'Dirige chaque requete vers le bon agent' },
      { id: 'multi_agent', name: 'Multi-agent', description: 'Execute plusieurs agents en parallele' },
    ],
  },
  {
    id: 'knowledge', name: 'Knowledge', description: 'Documents + Q&A unifie — recherche, lecture, correction, analyse, partage', icon: '📚', category: 'core', minPlan: 'free',
    skills: [
      { id: 'rag_search', name: 'Recherche RAG', description: 'Recherche semantique dans vos documents' },
      { id: 'contextual_answer', name: 'Reponse contextuelle', description: 'Repond aux questions avec sources' },
      { id: 'source_citation', name: 'Citations', description: 'Cite les sources de chaque reponse' },
      { id: 'doc_indexing', name: 'Indexation', description: 'Indexe PDF, Word, Excel, CSV' },
      { id: 'doc_summary', name: 'Resume', description: 'Resume automatique de documents' },
      { id: 'doc_read_aloud', name: 'Lecture vocale', description: 'Prepare les documents pour lecture a haute voix' },
      { id: 'doc_correction', name: 'Correction', description: 'Corrige orthographe, grammaire, style' },
      { id: 'doc_analysis', name: 'Analyse', description: 'Analyse approfondie: structure, sentiment, recommandations' },
      { id: 'doc_compare', name: 'Comparaison', description: 'Compare deux documents: similitudes, differences' },
      { id: 'doc_generate', name: 'Generation', description: 'Genere de nouveaux documents: rapports, memos, emails' },
      { id: 'doc_send', name: 'Envoi', description: 'Partage documents par email' },
    ],
  },

  // ── Operations ──
  {
    id: 'reception', name: 'Reception', description: 'Accueil PRO: visiteurs, pre-inscription QR, livraisons, parking, evacuation, analytics', icon: '🚪', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'visitor_checkin', name: 'Check-in visiteurs', description: 'Enregistrement, badges, QR code' },
      { id: 'pre_registration', name: 'Pre-inscription', description: 'QR code, approbation host, NDA' },
      { id: 'employee_presence', name: 'Presence employes', description: 'Pointage code/camera/QR' },
      { id: 'delivery_management', name: 'Livraisons', description: 'Reception colis, notification, tracking' },
      { id: 'parking', name: 'Parking', description: 'Reservation et gestion des places' },
      { id: 'evacuation', name: 'Evacuation urgence', description: 'Headcount temps reel batiment' },
      { id: 'visitor_analytics', name: 'Analytics visiteurs', description: 'Tendances, pics, durees, recurrences' },
      { id: 'appointment_check', name: 'Verification RDV', description: 'Verifie les rendez-vous' },
      { id: 'company_info', name: 'Info entreprise', description: 'Repond aux questions des visiteurs' },
    ],
  },
  {
    id: 'hr', name: 'RH', description: 'RH PRO: conges, recrutement, organigramme, evaluations, offboarding, analytics, enquetes', icon: '👩', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'leave_management', name: 'Gestion conges', description: 'Demande et approbation des conges' },
      { id: 'recruitment', name: 'Recrutement', description: 'Offres, CV scoring IA, entretiens, publication LinkedIn' },
      { id: 'org_chart', name: 'Organigramme', description: 'Hierarchie, departements, reporting lines' },
      { id: 'performance_reviews', name: 'Evaluations', description: 'Reviews, objectifs, feedback, notes' },
      { id: 'offboarding', name: 'Offboarding', description: 'Checklist depart 12 etapes, cross-agent securite' },
      { id: 'hr_analytics', name: 'Analytics RH', description: 'Headcount, anciennete, embauches, departements' },
      { id: 'surveys', name: 'Enquetes', description: 'Satisfaction, eNPS, feedback anonyme' },
      { id: 'onboarding', name: 'Onboarding', description: 'Checklist nouvel employe' },
      { id: 'employee_directory', name: 'Annuaire', description: 'Recherche employes' },
      { id: 'hr_documents', name: 'Documents', description: 'Attestations, certificats, contrats' },
      { id: 'hr_policy', name: 'Politique RH', description: 'Repond aux questions internes RH' },
    ],
  },
  {
    id: 'accounting', name: 'Comptabilite', description: 'Comptabilite PRO: factures, P&L, aging, recurrentes, TVA, tresorerie, depenses analytics, automation', icon: '💰', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'invoice_management', name: 'Factures', description: 'CRUD factures multi-devises + relances + PDF' },
      { id: 'recurring_invoices', name: 'Recurrentes', description: 'Facturation automatique mensuelle/trimestrielle/annuelle' },
      { id: 'profit_loss', name: 'Compte de resultat', description: 'P&L avec marge brute, resultat net, charges' },
      { id: 'aging_report', name: 'Aging report', description: 'Creances par anciennete 0-30/30-60/60-90/90+' },
      { id: 'budget_tracking', name: 'Budget', description: 'Suivi budgetaire par departement' },
      { id: 'cashflow', name: 'Tresorerie', description: 'Cash-flow + previsions 3 mois' },
      { id: 'expense_reports', name: 'Notes de frais', description: 'Soumission, approbation, analytics' },
      { id: 'expense_analytics', name: 'Analytics depenses', description: 'Par categorie, departement, top depenseurs' },
      { id: 'vat_report', name: 'TVA', description: 'Declarations TVA collectee/deductible' },
      { id: 'finance_automation', name: 'Automation', description: 'Impayés → alerte, budgets → check, recurrentes → generation' },
    ],
  },
  {
    id: 'sales', name: 'Commercial', description: 'CRM PRO: leads IA, pipeline, devis, sequences email, performance equipe, win/loss, automation cross-agent', icon: '🤝', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'lead_management', name: 'Leads & Scoring IA', description: 'Creation, qualification, scoring comportemental IA' },
      { id: 'pipeline_tracking', name: 'Pipeline', description: 'Pipeline 7 etapes avec drag-and-drop' },
      { id: 'quote_generation', name: 'Devis', description: 'Creation, envoi, acceptation et conversion en facture' },
      { id: 'client_management', name: 'Clients', description: 'Fiches client avec timeline parcours complet' },
      { id: 'followups', name: 'Relances', description: 'Relances programmees et auto-detection' },
      { id: 'email_sequences', name: 'Sequences email', description: 'Drip campaigns IA multi-etapes' },
      { id: 'team_performance', name: 'Performance equipe', description: 'KPIs par vendeur, leaderboard, quotas' },
      { id: 'win_loss', name: 'Win/Loss', description: 'Analyse victoires/defaites, patterns, recommandations' },
      { id: 'deal_insights', name: 'Deal insights', description: 'Risk scoring, next best action, probabilite par deal' },
      { id: 'sales_automation', name: 'Automation', description: 'Deal gagne → facture, perdu → formation, stale → marketing' },
      { id: 'sales_comms', name: 'Communication', description: 'Emails et WhatsApp de suivi personnalises' },
      { id: 'sales_analytics', name: 'Previsions CA', description: 'Forecast 3 scenarios, tunnel conversion' },
      { id: 'sales_audit', name: 'Audit', description: 'Journal d\'audit compliance avec before/after' },
    ],
  },
  {
    id: 'support', name: 'Support', description: 'Support PRO: tickets SLA, agent performance, NPS, sentiment IA, cross-agent routing, KB, auto-assign', icon: '📞', category: 'operations', minPlan: 'free', beta: true,
    skills: [
      { id: 'ticket_management', name: 'Tickets & SLA', description: 'Creation, suivi, SLA avec deadlines automatiques' },
      { id: 'agent_performance', name: 'Performance agents', description: 'KPIs par agent, CSAT, temps reponse, leaderboard' },
      { id: 'sla_dashboard', name: 'SLA Dashboard', description: 'Breaches temps reel, tickets a risque, tendances' },
      { id: 'nps_survey', name: 'NPS', description: 'Net Promoter Score, promoteurs/detracteurs' },
      { id: 'sentiment_detection', name: 'Sentiment IA', description: 'Detection frustration client, auto-escalade' },
      { id: 'kb_search', name: 'Base de connaissances', description: 'FAQ avec suggestion IA' },
      { id: 'auto_assign', name: 'Auto-assignation', description: 'Round-robin aux agents disponibles' },
      { id: 'escalation', name: 'Escalation', description: 'Escalade vers humain, manager ou technique' },
      { id: 'cross_agent', name: 'Routing cross-agent', description: 'Securite → incident, bug → IT, facturation → compta' },
      { id: 'satisfaction', name: 'CSAT', description: 'Notation et analytics satisfaction' },
    ],
  },
  {
    id: 'it', name: 'IT', description: 'IT PRO: helpdesk SLA, CMDB, monitoring, tech performance, license optimization, cross-agent automation', icon: '🖥', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'it_tickets', name: 'Tickets SLA', description: 'Helpdesk avec SLA, priorite, auto-assign' },
      { id: 'cmdb', name: 'CMDB', description: 'Assets par type/statut, garanties, depreciation' },
      { id: 'monitoring', name: 'Monitoring', description: 'Services uptime, alertes down, latence' },
      { id: 'tech_performance', name: 'Performance', description: 'KPIs par technicien, leaderboard' },
      { id: 'license_optimization', name: 'Licences', description: 'Optimisation cout, sieges inutilises, expirations' },
      { id: 'it_kb', name: 'KB + IA', description: 'Base connaissances + resolution IA' },
      { id: 'cross_agent', name: 'Cross-agent', description: 'Security incidents, HR offboarding, licence → compta' },
    ],
  },

  // ── Strategy ──
  {
    id: 'meeting', name: 'Reunions', description: 'Transcription, resume, actions', icon: '🎤', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'transcription', name: 'Transcription', description: 'Transcription audio/video' },
      { id: 'meeting_summary', name: 'Resume', description: 'Resume automatique' },
      { id: 'action_items', name: 'Actions', description: 'Extraction des action items' },
    ],
  },
  {
    id: 'vision', name: 'Vision', description: 'Reconnaissance faciale', icon: '👁', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'face_detection', name: 'Detection', description: 'Detection de visages' },
      { id: 'face_recognition', name: 'Reconnaissance', description: 'Identification des employes' },
    ],
  },
  {
    id: 'insights', name: 'Insights', description: 'Tendances et alertes', icon: '📊', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'trend_detection', name: 'Tendances', description: 'Detecte les tendances' },
      { id: 'anomaly_detection', name: 'Anomalies', description: 'Detecte les anomalies' },
      { id: 'recommendations', name: 'Recommandations', description: 'Suggestions proactives' },
    ],
  },
  {
    id: 'comms', name: 'Communications', description: 'Emails, Telegram, WhatsApp, Slack, annonces, campagnes multi-canal', icon: '📧', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'email_draft', name: 'Redaction email', description: 'Redige des emails professionnels avec IA' },
      { id: 'email_summary', name: 'Resume emails', description: 'Resume les emails recus' },
      { id: 'announcements', name: 'Annonces internes', description: 'Broadcast multi-canal a toute l\'entreprise' },
      { id: 'telegram', name: 'Telegram', description: 'Messages et notifications Telegram' },
      { id: 'whatsapp', name: 'WhatsApp', description: 'Messagerie WhatsApp Business' },
      { id: 'slack', name: 'Slack', description: 'Notifications et messages Slack' },
      { id: 'campaigns', name: 'Campagnes', description: 'Envoi en masse multi-canal' },
      { id: 'scheduling', name: 'Programmation', description: 'Messages programmes a date/heure' },
      { id: 'contact_groups', name: 'Groupes contacts', description: 'Listes de distribution' },
    ],
  },
  {
    id: 'marketing', name: 'Marketing', description: 'Marketing PRO: posts, ROI analytics, strategie IA, analyse concurrents, campagnes, SEO, automation cross-agent', icon: '📣', category: 'strategy', minPlan: 'free', beta: true,
    skills: [
      { id: 'post_generation', name: 'Posts sociaux', description: 'Multi-plateforme avec A/B variantes' },
      { id: 'roi_analytics', name: 'ROI Analytics', description: 'Cout par lead, ROI par canal/campagne' },
      { id: 'content_strategy', name: 'Strategie IA', description: 'Idees contenu, formats tendance, planning' },
      { id: 'competitor_analysis', name: 'Concurrents', description: 'Analyse contenu concurrent, forces/faiblesses' },
      { id: 'content_calendar', name: 'Calendrier', description: 'Planification et scheduling' },
      { id: 'campaigns', name: 'Campagnes', description: 'Budget, ROI, suivi' },
      { id: 'seo_analysis', name: 'SEO', description: 'Mots-cles, titres, meta' },
      { id: 'automation', name: 'Automation', description: 'Success stories auto, remplissage calendrier IA' },
    ],
  },
  {
    id: 'cybersecurity', name: 'Cybersecurite', description: 'CISO virtuel: menaces, incidents, vulnerabilites, phishing, compliance, SIEM-lite, politiques', icon: '🛡', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'security_score', name: 'Score securite', description: 'Score multi-categories avec tendance et grade' },
      { id: 'incident_response', name: 'Incidents', description: 'Workflow complet: detection → investigation → resolution avec timeline' },
      { id: 'vulnerability_scan', name: 'Vulnerabilites', description: 'Scan CVE, tracking, remediation' },
      { id: 'phishing_simulation', name: 'Phishing', description: 'Campagnes simulation phishing, scores employes' },
      { id: 'compliance_check', name: 'Conformite', description: 'RGPD/ISO27001/SOC2/PCI-DSS/NIST/HIPAA avec controles' },
      { id: 'security_policies', name: 'Politiques', description: 'Generation IA, versioning, attestation' },
      { id: 'threat_feed', name: 'Menaces', description: 'Flux temps reel, IOC, alertes SIEM-lite' },
      { id: 'access_review', name: 'Revue acces', description: 'MFA, dormants, privileges, anomalies' },
      { id: 'security_audit', name: 'Audit IA', description: 'Audit complet avec recommandations priorisees' },
    ],
  },
  {
    id: 'legal', name: 'Juridique', description: 'Legal PRO: risk scoring IA, templates contrats, case timeline, RGPD automation, clause library, echeances', icon: '⚖', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'contract_risk', name: 'Risk scoring IA', description: 'Analyse risques, clauses manquantes, recommandations' },
      { id: 'contract_templates', name: 'Templates IA', description: 'NDA, emploi, service, fournisseur, partenariat, freelance' },
      { id: 'contract_analysis', name: 'Analyse contrats', description: 'Extraction clauses, comparaison versions' },
      { id: 'case_timeline', name: 'Timeline dossier', description: 'Chronologie complete avec documents et echeances' },
      { id: 'case_management', name: 'Dossiers', description: 'Case management avec contrats et notes' },
      { id: 'deadlines', name: 'Echeances', description: 'Alertes automatiques < 7 jours' },
      { id: 'compliance', name: 'Conformite RGPD', description: 'Data breach → notification 72h auto' },
      { id: 'automation', name: 'Automation', description: 'Echeances, expirations contrats, breach → RGPD' },
    ],
  },
  {
    id: 'training', name: 'Formation', description: 'Cours IA, quiz auto, assignation, progression, certificats, leaderboard', icon: '🎓', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'course_creation', name: 'Cours IA', description: 'Generation de cours avec modules par IA' },
      { id: 'quiz_generation', name: 'Quiz IA', description: 'QCM auto-generes avec scoring' },
      { id: 'assignment', name: 'Assignation', description: 'Assigner cours a employes/equipes' },
      { id: 'progress_tracking', name: 'Progression', description: 'Suivi detaille par employe' },
      { id: 'certificates', name: 'Certificats', description: 'Delivrance auto apres reussite' },
      { id: 'leaderboard', name: 'Classement', description: 'Points, badges, gamification' },
      { id: 'recommendations', name: 'Recommandations', description: 'Personnalisees par role/lacunes' },
    ],
  },
  {
    id: 'news', name: 'Veille', description: 'Veille PRO: news, concurrents, sentiment, trending, alertes, digest, bookmarks', icon: '⭐', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'sector_watch', name: 'Veille secteur', description: 'News sectorielles avec sentiment et tags' },
      { id: 'competitor_tracking', name: 'Concurrents', description: 'Suivi, analyse IA, profils concurrents' },
      { id: 'sentiment_analysis', name: 'Sentiment', description: 'Analyse sentiment par topic/entreprise' },
      { id: 'trending_topics', name: 'Tendances', description: 'Topics en hausse/baisse avec momentum' },
      { id: 'news_alerts', name: 'Alertes', description: 'Mots-cles multi-canal (email, Telegram, Slack)' },
      { id: 'digest_generation', name: 'Digest', description: 'Newsletter automatique quotidien/hebdo' },
      { id: 'bookmarks', name: 'Sauvegardes', description: 'Bookmarks articles avec notes' },
    ],
  },
  {
    id: 'coach', name: 'Coach', description: 'Coach PRO: plan carriere IA, mood tracking, burnout detection, 1-on-1 templates, coaching insights', icon: '🧑‍🏫', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'career_plan', name: 'Plan carriere', description: 'Objectifs, competences, jalons personnalises IA' },
      { id: 'mood_tracking', name: 'Mood tracking', description: 'Suivi moral/energie quotidien avec tendances' },
      { id: 'burnout_detection', name: 'Detection burnout', description: 'Employes a risque, facteurs, actions suggerees' },
      { id: 'one_on_one', name: '1-on-1 templates', description: 'Agenda personnalise base sur contexte et mood' },
      { id: 'coaching_insights', name: 'Insights IA', description: 'Conseils bien-etre, performance, engagement' },
      { id: 'team_dynamics', name: 'Dynamique equipe', description: 'Cohesion et interactions' },
      { id: 'wellbeing', name: 'Bien-etre', description: 'Check-up et recommandations' },
    ],
  },
  {
    id: 'datascientist', name: 'Data Scientist', description: 'Analyse cross-modules, correlations, predictions', icon: '🔬', category: 'strategy', minPlan: 'free',
    skills: [
      { id: 'cross_module_analysis', name: 'Analyse cross-modules', description: 'Synthetise les donnees de tous les departements' },
      { id: 'correlations', name: 'Correlations', description: 'Trouve les liens entre les metriques' },
      { id: 'predictions', name: 'Predictions', description: 'Previsions revenue, croissance, risques' },
      { id: 'risk_assessment', name: 'Evaluation risques', description: 'Identifie les risques business' },
      { id: 'strategic_recommendations', name: 'Recommandations', description: 'Conseils strategiques data-driven' },
    ],
  },
  // ── Security ──
  {
    id: 'physical_security', name: 'Securite Physique', description: 'Gestion gardes: rotations, incidents WhatsApp, alertes temps reel, acces, patrouilles, analytics', icon: '🛡️', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'guard_scheduling', name: 'Planning gardes', description: 'Rotations automatiques, shifts, remplacements' },
      { id: 'incident_reporting', name: 'Rapports incidents', description: 'Log incidents via WhatsApp, email ou app avec photos' },
      { id: 'realtime_alerts', name: 'Alertes temps reel', description: 'Notifications immediates pour intrusions, urgences' },
      { id: 'guard_tracking', name: 'Suivi gardes', description: 'GPS temps reel, rondes, checkpoints QR' },
      { id: 'access_management', name: 'Controle acces', description: 'Logs entrees/sorties, badges, visiteurs' },
      { id: 'patrol_routes', name: 'Patrouilles', description: 'Planification itineraires, verification checkpoints' },
      { id: 'shift_handover', name: 'Passation de poste', description: 'Rapport automatique fin de shift avec incidents' },
      { id: 'risk_analysis', name: 'Analyse risques', description: 'Prediction heures/zones a risque basee sur historique' },
      { id: 'security_reports', name: 'Rapports securite', description: 'Rapports quotidiens, hebdo, mensuels automatiques' },
      { id: 'emergency_protocol', name: 'Protocoles urgence', description: 'Declenchement alertes incendie, intrusion, evacuation' },
    ],
  },
  {
    id: 'surveillance', name: 'Surveillance Camera', description: 'Monitoring cameras CCTV, detection activite suspecte, alertes temps reel, rapports 24h', icon: '📹', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'camera_monitoring', name: 'Monitoring cameras', description: 'Surveillance flux IP/CCTV en continu' },
      { id: 'activity_detection', name: 'Detection activite', description: 'Vision IA detecte mouvements suspects, intrusions, bagages abandonnes' },
      { id: 'person_detection', name: 'Detection personnes', description: 'Comptage personnes, zones interdites, attroupements' },
      { id: 'realtime_alerts', name: 'Alertes temps reel', description: 'Notifications WhatsApp/email/SMS quand evenement detecte' },
      { id: 'daily_report', name: 'Rapport 24h', description: 'Resume automatique des 24 dernieres heures avec captures' },
      { id: 'zone_monitoring', name: 'Zones sensibles', description: 'Configuration zones a surveiller avec niveaux de sensibilite' },
      { id: 'recording_management', name: 'Gestion enregistrements', description: 'Recherche, extraction, archivage clips video' },
      { id: 'analytics', name: 'Analytics video', description: 'Patterns de trafic, heures de pointe, heatmaps' },
      { id: 'face_matching', name: 'Reconnaissance faciale', description: 'Matching visages avec base employes/visiteurs' },
      { id: 'night_vision', name: 'Vision nocturne', description: 'Detection amelioree en conditions de faible luminosite' },
    ],
  },

  {
    id: 'workflow', name: 'Workflow Automation', description: 'Automatisation workflows: triggers, actions conditionnelles, approbations, notifications multi-canal, audit trail', icon: '⚡', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'workflow_builder', name: 'Constructeur workflows', description: 'Cree des workflows if/then/else avec triggers et actions' },
      { id: 'trigger_engine', name: 'Moteur de triggers', description: 'Declenche sur evenements: nouveau lead, facture, ticket, heure, webhook' },
      { id: 'approval_chains', name: 'Chaines d\'approbation', description: 'Validation multi-niveaux avec escalade automatique' },
      { id: 'conditional_logic', name: 'Logique conditionnelle', description: 'Branchement si/sinon, filtres, seuils, conditions combinees' },
      { id: 'multi_channel_notify', name: 'Notifications multi-canal', description: 'Email, WhatsApp, Slack, SMS, push — selon le workflow' },
      { id: 'scheduled_tasks', name: 'Taches planifiees', description: 'Cron jobs: rapports quotidiens, relances hebdo, audits mensuels' },
      { id: 'cross_agent_actions', name: 'Actions cross-agent', description: 'Declenche des actions sur d\'autres agents (facture, ticket, email)' },
      { id: 'audit_trail', name: 'Audit trail', description: 'Log complet de chaque execution avec timestamps et resultats' },
      { id: 'template_library', name: 'Templates', description: 'Workflows pre-construits: onboarding, relance, escalade, rapport' },
      { id: 'workflow_analytics', name: 'Analytics workflows', description: 'Taux de succes, temps moyen, goulots, optimisations suggerees' },
    ],
  },

  {
    id: 'website', name: 'Website Builder', description: 'Cree un site web pro depuis vos donnees Orlode avec widget chat IA integre', icon: '🌐', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'website_generate', name: 'Generer un site', description: 'Cree un site complet depuis les donnees de l\'entreprise' },
      { id: 'website_update', name: 'Modifier le site', description: 'Change textes, couleurs, ajoute des pages par chat' },
      { id: 'website_status', name: 'Statut du site', description: 'Verifie si le site est en ligne et ses pages' },
      { id: 'website_embed', name: 'Code widget', description: 'Donne le code pour integrer le chat IA sur un site externe' },
    ],
  },
  {
    id: 'approval', name: 'Approval & Security', description: 'Approbations multi-niveaux, verification agents marketplace, audit securite donnees, compliance RGPD', icon: '✅', category: 'operations', minPlan: 'free',
    skills: [
      { id: 'approval_create', name: 'Creer approbation', description: 'Demande avec chaine multi-niveaux (conges, depenses, achats, contrats)' },
      { id: 'approval_decide', name: 'Approuver/Rejeter', description: 'Decision avec commentaire, escalade auto si timeout' },
      { id: 'approval_pending', name: 'Approbations en attente', description: 'Liste des demandes qui attendent votre validation' },
      { id: 'approval_history', name: 'Historique', description: 'Toutes les decisions passees avec audit trail' },
      { id: 'approval_escalate', name: 'Escalade auto', description: 'Detecte les approbations en retard et escalade au niveau suivant' },
      { id: 'approval_review_agent', name: 'Review agents IA', description: 'Analyse automatique des agents marketplace soumis (score 0-100)' },
      { id: 'approval_analytics', name: 'Analytics approbations', description: 'Taux, delais, goulots par type' },
      { id: 'security_data_audit', name: 'Audit donnees', description: 'Verifie qui a acces a quoi, detecte les anomalies d\'acces' },
      { id: 'security_compliance', name: 'Compliance RGPD', description: 'Verifie conformite donnees personnelles, droit a l\'oubli, consentement' },
      { id: 'security_breach_detect', name: 'Detection fuites', description: 'Detecte les partages de donnees anormaux, exports massifs, acces suspects' },
      { id: 'security_permissions_audit', name: 'Audit permissions', description: 'Verifie que chaque membre a les bonnes permissions, detecte les privileges excessifs' },
    ],
  },
  {
    id: 'wildcard', name: 'Wildcard', description: 'Agent polyvalent — répond à tout', icon: '🔮', category: 'core', minPlan: 'starter',
    skills: [
      { id: 'general', name: 'General', description: 'Repond a tout ce que les autres ne couvrent pas' },
    ],
  },
];

/** Plan limits for agent selection — users pick which agents they want */
export const PLAN_AGENT_LIMITS = {
  free:    { maxAgents: 1,  maxSkills: 10,  price: 0 },
  creator: { maxAgents: 0,  maxSkills: 0,   price: 9.99 },  // own agents only, unlimited
  starter: { maxAgents: 4,  maxSkills: 40,  price: 19.99 },
  pro:     { maxAgents: 8,  maxSkills: 80,  price: 49.99 },
  premium: { maxAgents: 12, maxSkills: 120, price: 99.99 },
} as const;

/** Backward compatibility aliases */
export const PLAN_ALIASES: Record<string, string> = {
  business: 'pro',
  enterprise: 'premium',
};

/** Resolve plan name (handles old names) */
export function resolvePlan(plan: string): string {
  return PLAN_ALIASES[plan] ?? plan;
}

/** Get agents available for a plan — all agents visible to all plans (pick any) */
/** IDs of core agents that every plan gets automatically (not selectable). */
const CORE_AGENT_IDS = new Set(['orchestrator', 'knowledge', 'wildcard']);

export function getAvailableAgents(plan: string): AgentDefinition[] {
  const resolved = resolvePlan(plan);
  if (!(resolved in PLAN_AGENT_LIMITS)) return [];
  // Creator plan: returns empty — they only see their own created agents (handled by marketplace service)
  if (resolved === 'creator') return [];
  // Exclude core agents from the selection UI — they come for free with every plan
  // so users shouldn't "waste" their quota picking them.
  return AGENT_CATALOG.filter(a => !CORE_AGENT_IDS.has(a.id));
}

/** Count total skills for selected agents */
export function countSkills(agentIds: string[]): number {
  return AGENT_CATALOG
    .filter(a => agentIds.includes(a.id))
    .reduce((sum, a) => sum + a.skills.length, 0);
}
