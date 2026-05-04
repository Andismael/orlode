"use strict";
/**
 * Skills Registry — Catalogue complet des 127 skills
 * Chaque skill est activable/désactivable par l'admin de l'entreprise.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILLS_SUMMARY = exports.SKILLS_REGISTRY = void 0;
exports.getSkillsByAgent = getSkillsByAgent;
exports.getSkillsByPlan = getSkillsByPlan;
exports.getSkillById = getSkillById;
exports.SKILLS_REGISTRY = [
    // ── Documents ──────────────────────────────────────────────────────────────
    { id: 'DOC-001', name: 'Ingest a document', description: 'OCR, chunk, embed and index uploaded documents', agent: 'documents', category: 'Knowledge', plan: 'starter', tools: ['ocr', 'chunk', 'embed', 'index'], mcpRequired: [], enabled: true },
    { id: 'DOC-002', name: 'OCR on scanned document', description: 'Extract text from scanned PDFs and images', agent: 'documents', category: 'Knowledge', plan: 'starter', tools: ['ocr'], mcpRequired: [], enabled: true },
    { id: 'DOC-003', name: 'Auto-classification', description: 'Classify documents by category and department', agent: 'documents', category: 'Knowledge', plan: 'starter', tools: ['classify'], mcpRequired: [], enabled: true },
    { id: 'DOC-004', name: 'Entity extraction', description: 'Extract people, dates, amounts, locations', agent: 'documents', category: 'Knowledge', plan: 'business', tools: ['entity'], mcpRequired: [], enabled: true },
    { id: 'DOC-005', name: 'Auto summary', description: 'Generate a concise summary of any document', agent: 'documents', category: 'Knowledge', plan: 'business', tools: ['summarize'], mcpRequired: [], enabled: true },
    { id: 'DOC-006', name: 'Import from Drive', description: 'Sync documents automatically from Google Drive', agent: 'documents', category: 'Knowledge', plan: 'business', tools: ['drive_search'], mcpRequired: ['google_workspace'], enabled: false },
    // ── Q&A ────────────────────────────────────────────────────────────────────
    { id: 'QA-001', name: 'Answer company questions', description: 'RAG-based Q&A over uploaded documents', agent: 'qa', category: 'Knowledge', plan: 'starter', tools: ['vectorSearch', 'rerank'], mcpRequired: [], enabled: true },
    { id: 'QA-002', name: 'Cite sources', description: 'Include document references in answers', agent: 'qa', category: 'Knowledge', plan: 'starter', tools: ['vectorSearch'], mcpRequired: [], enabled: true },
    { id: 'QA-003', name: 'Web search', description: 'Supplement answers with real-time web data', agent: 'qa', category: 'Knowledge', plan: 'business', tools: ['webSearch'], mcpRequired: [], enabled: false },
    { id: 'QA-004', name: 'Comparative analysis', description: 'Compare multiple documents or data sources', agent: 'qa', category: 'Knowledge', plan: 'business', tools: ['vectorSearch', 'webSearch'], mcpRequired: [], enabled: true },
    { id: 'QA-005', name: 'Complex financial Q&A', description: 'Answer financial questions with BigQuery data', agent: 'qa', category: 'Knowledge', plan: 'business', tools: ['vectorSearch'], mcpRequired: ['bigquery'], enabled: false },
    { id: 'QA-006', name: 'Conversation history', description: 'Maintain context across a conversation', agent: 'qa', category: 'Knowledge', plan: 'starter', tools: ['conversation'], mcpRequired: [], enabled: true },
    { id: 'QA-007', name: 'Proactive insights', description: 'Proactively surface relevant information', agent: 'qa', category: 'Knowledge', plan: 'enterprise', tools: ['vectorSearch', 'trendAnalysis'], mcpRequired: [], enabled: false },
    { id: 'QA-008', name: 'Export answer to PDF', description: 'Generate a PDF report from the AI answer', agent: 'qa', category: 'Knowledge', plan: 'business', tools: ['reportGenerate'], mcpRequired: [], enabled: false },
    // ── Meeting ────────────────────────────────────────────────────────────────
    { id: 'MTG-001', name: 'Real-time transcription', description: 'Live speech-to-text transcription', agent: 'meeting', category: 'Meetings', plan: 'business', tools: ['transcribe'], mcpRequired: [], enabled: true },
    { id: 'MTG-002', name: 'Post-meeting summary', description: 'AI-generated meeting summary', agent: 'meeting', category: 'Meetings', plan: 'business', tools: ['summarize'], mcpRequired: [], enabled: true },
    { id: 'MTG-003', name: 'Action item extraction', description: 'Automatically extract tasks and owners', agent: 'meeting', category: 'Meetings', plan: 'business', tools: ['actionItem'], mcpRequired: [], enabled: true },
    { id: 'MTG-004', name: 'Pre-meeting briefing', description: 'Prepare agenda and context before meeting', agent: 'meeting', category: 'Meetings', plan: 'business', tools: ['briefing', 'vectorSearch'], mcpRequired: [], enabled: true },
    { id: 'MTG-005', name: 'Voice intervention', description: 'AI speaks during meetings to answer Q&A', agent: 'meeting', category: 'Meetings', plan: 'enterprise', tools: ['speak', 'vectorSearch'], mcpRequired: [], enabled: false },
    { id: 'MTG-006', name: 'Simultaneous translation', description: 'Real-time translation of meeting speech', agent: 'meeting', category: 'Meetings', plan: 'enterprise', tools: ['translate', 'transcribe'], mcpRequired: [], enabled: false },
    { id: 'MTG-007', name: 'Sentiment detection', description: 'Analyze mood and sentiment during meetings', agent: 'meeting', category: 'Meetings', plan: 'enterprise', tools: ['analyze'], mcpRequired: [], enabled: false },
    { id: 'MTG-008', name: 'Email summary post-meeting', description: 'Auto-send meeting summary by email', agent: 'meeting', category: 'Meetings', plan: 'business', tools: ['summarize'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'MTG-009', name: 'Google Meet integration', description: 'Join and analyze Google Meet sessions', agent: 'meeting', category: 'Meetings', plan: 'enterprise', tools: [], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'MTG-010', name: 'Audio recording', description: 'Record and store meeting audio', agent: 'meeting', category: 'Meetings', plan: 'business', tools: ['transcribe'], mcpRequired: [], enabled: false },
    // ── Vision ─────────────────────────────────────────────────────────────────
    { id: 'VIS-001', name: 'Face detection', description: 'Detect faces in images or video frames', agent: 'vision', category: 'Vision', plan: 'business', tools: ['faceDetect'], mcpRequired: [], enabled: false },
    { id: 'VIS-002', name: 'Face recognition', description: 'Identify known employees by face', agent: 'vision', category: 'Vision', plan: 'business', tools: ['faceRecognize'], mcpRequired: [], enabled: false },
    { id: 'VIS-003', name: 'Register a face', description: 'Enroll a new employee face in the system', agent: 'vision', category: 'Vision', plan: 'business', tools: ['faceRegister'], mcpRequired: [], enabled: false },
    { id: 'VIS-004', name: 'Meeting identification', description: 'Identify meeting participants by face', agent: 'vision', category: 'Vision', plan: 'enterprise', tools: ['faceDetect', 'faceRecognize'], mcpRequired: [], enabled: false },
    { id: 'VIS-005', name: 'Image labeling', description: 'Auto-label and categorize uploaded images', agent: 'vision', category: 'Vision', plan: 'business', tools: ['imageLabel'], mcpRequired: [], enabled: false },
    // ── Insights ───────────────────────────────────────────────────────────────
    { id: 'INS-001', name: 'Trend analysis', description: 'Detect trends in company data', agent: 'insights', category: 'Analytics', plan: 'business', tools: ['trendAnalysis'], mcpRequired: [], enabled: true },
    { id: 'INS-002', name: 'Anomaly detection', description: 'Flag unusual patterns automatically', agent: 'insights', category: 'Analytics', plan: 'business', tools: ['anomalyDetect'], mcpRequired: [], enabled: true },
    { id: 'INS-003', name: 'Proactive alerts', description: 'Push alerts when thresholds are exceeded', agent: 'insights', category: 'Analytics', plan: 'business', tools: ['alert'], mcpRequired: [], enabled: true },
    { id: 'INS-004', name: 'Weekly report', description: 'Auto-generate weekly analytics report', agent: 'insights', category: 'Analytics', plan: 'business', tools: ['reportGenerate'], mcpRequired: [], enabled: true },
    { id: 'INS-005', name: 'Monthly report', description: 'Auto-generate monthly analytics report', agent: 'insights', category: 'Analytics', plan: 'business', tools: ['reportGenerate'], mcpRequired: [], enabled: false },
    { id: 'INS-006', name: 'KPIs dashboard', description: 'Live KPI tracking with Google Sheets sync', agent: 'insights', category: 'Analytics', plan: 'enterprise', tools: ['trendAnalysis'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'INS-007', name: 'Forecasting', description: 'Predict future trends based on historical data', agent: 'insights', category: 'Analytics', plan: 'enterprise', tools: ['trendAnalysis'], mcpRequired: [], enabled: false },
    // ── Comms ──────────────────────────────────────────────────────────────────
    { id: 'COM-001', name: 'Email triage', description: 'Sort and prioritize incoming emails', agent: 'comms', category: 'Communication', plan: 'business', tools: ['emailTriage'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'COM-002', name: 'Draft email reply', description: 'AI-drafted responses to emails', agent: 'comms', category: 'Communication', plan: 'business', tools: ['emailDraft'], mcpRequired: [], enabled: true },
    { id: 'COM-003', name: 'Translate a message', description: 'Translate any text to any language', agent: 'comms', category: 'Communication', plan: 'starter', tools: ['translate'], mcpRequired: [], enabled: true },
    { id: 'COM-004', name: 'Slack notification', description: 'Send automated messages to Slack channels', agent: 'comms', category: 'Communication', plan: 'business', tools: [], mcpRequired: ['slack'], enabled: false },
    { id: 'COM-005', name: 'Daily email digest', description: 'Morning summary of all unread emails', agent: 'comms', category: 'Communication', plan: 'business', tools: ['emailTriage', 'summarize'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'COM-006', name: 'Auto-reply (with approval)', description: 'Draft and queue auto-replies for review', agent: 'comms', category: 'Communication', plan: 'enterprise', tools: ['emailDraft'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'COM-007', name: 'Internal newsletter', description: 'Create and distribute internal newsletters', agent: 'comms', category: 'Communication', plan: 'business', tools: ['emailDraft'], mcpRequired: [], enabled: false },
    { id: 'COM-008', name: 'Push notification', description: 'Send push notifications to mobile users', agent: 'comms', category: 'Communication', plan: 'business', tools: ['notify'], mcpRequired: [], enabled: false },
    // ── IT ─────────────────────────────────────────────────────────────────────
    { id: 'IT-001', name: 'Helpdesk / Troubleshooting', description: 'Step-by-step tech support for common issues', agent: 'it', category: 'IT', plan: 'starter', tools: ['it_createTicket', 'it_searchKnowledgeBase'], mcpRequired: [], enabled: true },
    { id: 'IT-002', name: 'Password reset', description: 'Guide users through password reset procedures', agent: 'it', category: 'IT', plan: 'starter', tools: ['passwordReset'], mcpRequired: [], enabled: true },
    { id: 'IT-003', name: 'Manage access', description: 'Create, modify, or revoke user access', agent: 'it', category: 'IT', plan: 'business', tools: ['it_userAccess'], mcpRequired: [], enabled: true },
    { id: 'IT-004', name: 'Hardware inventory', description: 'Track and query IT assets and equipment', agent: 'it', category: 'IT', plan: 'business', tools: ['it_getInventory'], mcpRequired: [], enabled: true },
    { id: 'IT-005', name: 'License tracking', description: 'Monitor software licenses and renewals', agent: 'it', category: 'IT', plan: 'business', tools: ['it_license'], mcpRequired: [], enabled: false },
    { id: 'IT-006', name: 'System monitoring', description: 'Real-time monitoring of servers and services', agent: 'it', category: 'IT', plan: 'enterprise', tools: ['it_systemStatus'], mcpRequired: [], enabled: true },
    { id: 'IT-007', name: 'IT onboarding', description: 'Setup IT access and equipment for new hires', agent: 'it', category: 'IT', plan: 'business', tools: ['it_userAccess', 'it_getInventory'], mcpRequired: [], enabled: false },
    { id: 'IT-008', name: 'IT offboarding', description: 'Revoke access and recover equipment on exit', agent: 'it', category: 'IT', plan: 'business', tools: ['it_userAccess', 'it_getInventory'], mcpRequired: [], enabled: false },
    { id: 'IT-009', name: 'Remote assistance', description: 'Guided remote troubleshooting session', agent: 'it', category: 'IT', plan: 'enterprise', tools: ['remoteAssist'], mcpRequired: [], enabled: false },
    // ── Cybersecurity ──────────────────────────────────────────────────────────
    { id: 'SEC-001', name: 'Threat monitoring', description: '24/7 detection of intrusion attempts', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_threatMonitor'], mcpRequired: [], enabled: false },
    { id: 'SEC-002', name: 'Incident response', description: 'Classify and respond to security incidents', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_reportIncident'], mcpRequired: [], enabled: true },
    { id: 'SEC-003', name: 'Vulnerability scan', description: 'Scan apps and servers for known CVEs', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_vulnScan'], mcpRequired: [], enabled: false },
    { id: 'SEC-004', name: 'Security audit', description: 'Full security configuration audit', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_securityAudit'], mcpRequired: [], enabled: false },
    { id: 'SEC-005', name: 'Security score', description: 'Overall security score with recommendations', agent: 'cybersecurity', category: 'Security', plan: 'business', tools: ['sec_getSecurityScore'], mcpRequired: [], enabled: true },
    { id: 'SEC-006', name: 'Compliance check', description: 'GDPR, ISO 27001, SOC2 compliance status', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_checkCompliance'], mcpRequired: [], enabled: true },
    { id: 'SEC-007', name: 'Phishing simulation', description: 'Test employee phishing awareness', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_phishingSim'], mcpRequired: [], enabled: false },
    { id: 'SEC-008', name: 'Access review (IAM)', description: 'Detect over-privileged and dormant accounts', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_reviewAccess'], mcpRequired: [], enabled: true },
    { id: 'SEC-009', name: 'DLP (data leak prevention)', description: 'Monitor and prevent sensitive data leaks', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_dlpMonitor'], mcpRequired: [], enabled: false },
    { id: 'SEC-010', name: 'Dark web monitoring', description: 'Watch for company data on the dark web', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_darkWebMonitor'], mcpRequired: [], enabled: false },
    { id: 'SEC-011', name: 'Forensic analysis', description: 'Analyze logs and timeline post-incident', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_forensics'], mcpRequired: [], enabled: false },
    { id: 'SEC-012', name: 'Monthly security report', description: 'Auto-generate comprehensive security report', agent: 'cybersecurity', category: 'Security', plan: 'enterprise', tools: ['sec_securityReport'], mcpRequired: [], enabled: false },
    // ── Marketing ──────────────────────────────────────────────────────────────
    { id: 'MKT-001', name: 'Content calendar', description: 'Weekly/monthly editorial planning', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_getContentCalendar'], mcpRequired: [], enabled: true },
    { id: 'MKT-002', name: 'Write social post', description: 'AI-generated social media posts (as draft)', agent: 'marketing', category: 'Marketing', plan: 'starter', tools: ['mkt_generatePost'], mcpRequired: [], enabled: true },
    { id: 'MKT-003', name: 'Write article/blog', description: 'Blog articles, newsletters, press releases', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_writeArticle'], mcpRequired: [], enabled: true },
    { id: 'MKT-004', name: 'Social media monitoring', description: 'Track brand mentions on social networks', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_socialMonitor'], mcpRequired: [], enabled: false },
    { id: 'MKT-005', name: 'Analytics report', description: 'KPIs: engagement, reach, email rates', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_getAnalyticsReport'], mcpRequired: [], enabled: true },
    { id: 'MKT-006', name: 'Email marketing campaign', description: 'Create and schedule email campaigns', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_writeArticle'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'MKT-007', name: 'SEO analysis', description: 'Keyword research and content optimization', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_seoAnalyzer'], mcpRequired: [], enabled: false },
    { id: 'MKT-008', name: 'Competitor watch', description: 'Monitor competitor marketing activity', agent: 'marketing', category: 'Marketing', plan: 'business', tools: ['mkt_competitorWatch'], mcpRequired: [], enabled: false },
    { id: 'MKT-009', name: 'E-reputation / Reviews', description: 'Monitor and respond to online reviews', agent: 'marketing', category: 'Marketing', plan: 'enterprise', tools: ['mkt_reputationMonitor'], mcpRequired: [], enabled: false },
    { id: 'MKT-010', name: 'Ad copy generation', description: 'Google Ads and Meta Ads copy variants', agent: 'marketing', category: 'Marketing', plan: 'enterprise', tools: ['mkt_writeArticle'], mcpRequired: [], enabled: false },
    { id: 'MKT-011', name: 'Short video script', description: 'Scripts for Reels, TikTok, YouTube Shorts', agent: 'marketing', category: 'Marketing', plan: 'enterprise', tools: ['mkt_writeArticle'], mcpRequired: [], enabled: false },
    // ── Réception ──────────────────────────────────────────────────────────────
    { id: 'REC-001', name: 'Accueillir un visiteur', description: 'Enregistrer l\'arrivée d\'un visiteur et notifier l\'hôte', agent: 'reception', category: 'Reception', plan: 'business', tools: ['visitorRegistry', 'notifyHost'], mcpRequired: [], enabled: true },
    { id: 'REC-002', name: 'Vérifier un RDV', description: 'Vérifier qu\'un visiteur a bien un rendez-vous planifié', agent: 'reception', category: 'Reception', plan: 'business', tools: ['calendarCheck'], mcpRequired: [], enabled: true },
    { id: 'REC-003', name: 'Notifier l\'hôte', description: 'Envoyer une notification à l\'employé attendant son visiteur', agent: 'reception', category: 'Reception', plan: 'business', tools: ['notifyHost'], mcpRequired: [], enabled: true },
    { id: 'REC-004', name: 'Générer badge visiteur', description: 'Créer et imprimer un badge d\'accès temporaire', agent: 'reception', category: 'Reception', plan: 'enterprise', tools: ['badgeGenerator'], mcpRequired: [], enabled: false },
    { id: 'REC-005', name: 'Reconnaître un visiteur régulier', description: 'Identifier les visiteurs fréquents par reconnaissance faciale', agent: 'reception', category: 'Reception', plan: 'enterprise', tools: ['faceDetect', 'faceRecognize'], mcpRequired: [], enabled: false },
    { id: 'REC-006', name: 'Créer un RDV spontané', description: 'Planifier un rendez-vous immédiat dans l\'agenda de l\'employé', agent: 'reception', category: 'Reception', plan: 'business', tools: ['calendarCreate'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'REC-007', name: 'Filtrer les appels entrants', description: 'Qualifier et rediriger les appels selon leur objet', agent: 'reception', category: 'Reception', plan: 'enterprise', tools: ['companyInfo'], mcpRequired: [], enabled: false },
    { id: 'REC-008', name: 'Registre des visiteurs', description: 'Historique complet des visiteurs avec export', agent: 'reception', category: 'Reception', plan: 'business', tools: ['visitorRegistry'], mcpRequired: [], enabled: true },
    // ── RH ─────────────────────────────────────────────────────────────────────
    { id: 'HR-001', name: 'Consulter solde congés', description: 'Afficher le solde de congés disponibles d\'un employé', agent: 'hr', category: 'HR', plan: 'starter', tools: ['hr_leaveBalance'], mcpRequired: [], enabled: true },
    { id: 'HR-002', name: 'Demander des congés', description: 'Soumettre et traiter une demande de congés', agent: 'hr', category: 'HR', plan: 'starter', tools: ['hr_leaveRequest'], mcpRequired: [], enabled: true },
    { id: 'HR-003', name: 'Politique interne (FAQ RH)', description: 'Répondre aux questions sur le règlement intérieur et politiques', agent: 'hr', category: 'HR', plan: 'starter', tools: ['hr_searchPolicy'], mcpRequired: [], enabled: true },
    { id: 'HR-004', name: 'Onboarding nouvel employé', description: 'Générer et suivre la checklist d\'intégration complète', agent: 'hr', category: 'HR', plan: 'business', tools: ['hr_onboardingChecklist'], mcpRequired: [], enabled: true },
    { id: 'HR-005', name: 'Annuaire / Organigramme', description: 'Rechercher un employé, son rôle et son département', agent: 'hr', category: 'HR', plan: 'starter', tools: ['hr_employeeDirectory'], mcpRequired: [], enabled: true },
    { id: 'HR-006', name: 'Pré-screening CV', description: 'Analyser et scorer les CV reçus pour une offre d\'emploi', agent: 'hr', category: 'HR', plan: 'enterprise', tools: ['hr_cvScreening'], mcpRequired: [], enabled: false },
    { id: 'HR-007', name: 'Planifier entretiens', description: 'Coordonner et programmer les entretiens d\'embauche', agent: 'hr', category: 'HR', plan: 'business', tools: ['hr_interviewScheduler'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'HR-008', name: 'Enquête satisfaction employés', description: 'Créer et envoyer des sondages de satisfaction anonymes', agent: 'hr', category: 'HR', plan: 'business', tools: ['hr_survey'], mcpRequired: [], enabled: false },
    { id: 'HR-009', name: 'Rappel entretien annuel', description: 'Alerter managers et employés avant les évaluations annuelles', agent: 'hr', category: 'HR', plan: 'business', tools: ['hr_alert'], mcpRequired: [], enabled: true },
    { id: 'HR-010', name: 'Suivi période d\'essai', description: 'Notifier les échéances de période d\'essai et planifier le bilan', agent: 'hr', category: 'HR', plan: 'business', tools: ['hr_alert', 'hr_searchPolicy'], mcpRequired: [], enabled: true },
    // ── Comptabilité ───────────────────────────────────────────────────────────
    { id: 'ACC-001', name: 'Suivi des factures', description: 'Lister et suivre l\'état des factures clients et fournisseurs', agent: 'accounting', category: 'Finance', plan: 'business', tools: ['acc_invoiceTracker'], mcpRequired: [], enabled: true },
    { id: 'ACC-002', name: 'Alertes factures impayées', description: 'Détecter et alerter sur les factures en retard de paiement', agent: 'accounting', category: 'Finance', plan: 'business', tools: ['acc_paymentReminder'], mcpRequired: [], enabled: true },
    { id: 'ACC-003', name: 'Prévisions trésorerie', description: 'Calculer les flux de trésorerie prévisionnels sur 30/90 jours', agent: 'accounting', category: 'Finance', plan: 'enterprise', tools: ['acc_cashFlow'], mcpRequired: [], enabled: false },
    { id: 'ACC-004', name: 'Vérifier notes de frais', description: 'Analyser et valider les notes de frais soumises par les employés', agent: 'accounting', category: 'Finance', plan: 'business', tools: ['acc_expenseReview'], mcpRequired: [], enabled: true },
    { id: 'ACC-005', name: 'Rapport financier mensuel', description: 'Générer automatiquement le rapport financier du mois', agent: 'accounting', category: 'Finance', plan: 'business', tools: ['acc_financialReport'], mcpRequired: [], enabled: true },
    { id: 'ACC-006', name: 'Suivi budget vs réalisé', description: 'Comparer les dépenses réelles avec le budget prévisionnel', agent: 'accounting', category: 'Finance', plan: 'business', tools: ['acc_budgetTracker'], mcpRequired: [], enabled: true },
    { id: 'ACC-007', name: 'Rappels fiscaux', description: 'Alerter sur les échéances fiscales (TVA, IS, cotisations)', agent: 'accounting', category: 'Finance', plan: 'enterprise', tools: ['acc_taxReminder'], mcpRequired: [], enabled: false },
    { id: 'ACC-008', name: 'Relances automatiques clients', description: 'Générer et envoyer des relances de paiement automatiques', agent: 'accounting', category: 'Finance', plan: 'enterprise', tools: ['acc_paymentReminder'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'ACC-009', name: 'Intégration comptable', description: 'Synchroniser avec Google Sheets / BigQuery pour export comptable', agent: 'accounting', category: 'Finance', plan: 'enterprise', tools: ['acc_financialReport'], mcpRequired: ['google_workspace', 'bigquery'], enabled: false },
    // ── Commercial ─────────────────────────────────────────────────────────────
    { id: 'SAL-001', name: 'Qualifier un lead', description: 'Scorer et évaluer le potentiel d\'un prospect entrant', agent: 'sales', category: 'Sales', plan: 'business', tools: ['sal_leadScoring'], mcpRequired: [], enabled: true },
    { id: 'SAL-002', name: 'Suivi pipeline commercial', description: 'Visualiser et mettre à jour l\'état du pipeline de vente', agent: 'sales', category: 'Sales', plan: 'business', tools: ['sal_pipelineTracker'], mcpRequired: [], enabled: true },
    { id: 'SAL-003', name: 'Générer un devis', description: 'Créer automatiquement un devis personnalisé pour un prospect', agent: 'sales', category: 'Sales', plan: 'business', tools: ['sal_quoteGenerator'], mcpRequired: [], enabled: true },
    { id: 'SAL-004', name: 'Relance automatique prospect', description: 'Programmer et envoyer des séquences de relance commerciale', agent: 'sales', category: 'Sales', plan: 'business', tools: ['sal_followUp'], mcpRequired: ['google_workspace'], enabled: false },
    { id: 'SAL-005', name: 'Enrichir un prospect', description: 'Compléter le profil d\'un prospect avec des données externes', agent: 'sales', category: 'Sales', plan: 'enterprise', tools: ['sal_prospectEnrich'], mcpRequired: [], enabled: false },
    { id: 'SAL-006', name: 'Veille concurrentielle', description: 'Surveiller l\'activité commerciale des concurrents', agent: 'sales', category: 'Sales', plan: 'enterprise', tools: ['sal_competitorResearch'], mcpRequired: [], enabled: false },
    { id: 'SAL-007', name: 'Rapport de performance ventes', description: 'Générer le rapport hebdomadaire/mensuel des performances sales', agent: 'sales', category: 'Sales', plan: 'business', tools: ['sal_salesReport'], mcpRequired: [], enabled: true },
    { id: 'SAL-008', name: 'Prévisions de vente', description: 'Prédire les ventes du prochain trimestre sur base du pipeline', agent: 'sales', category: 'Sales', plan: 'enterprise', tools: ['sal_pipelineTracker'], mcpRequired: [], enabled: false },
    // ── Support Client ─────────────────────────────────────────────────────────
    { id: 'SUP-001', name: 'Répondre aux questions clients', description: 'Répondre aux FAQ et questions courantes via base de connaissance', agent: 'support', category: 'Support', plan: 'starter', tools: ['sup_knowledgeBase'], mcpRequired: [], enabled: true },
    { id: 'SUP-002', name: 'Créer un ticket support', description: 'Ouvrir et qualifier un ticket pour le suivi d\'un problème', agent: 'support', category: 'Support', plan: 'starter', tools: ['sup_ticketCreate'], mcpRequired: [], enabled: true },
    { id: 'SUP-003', name: 'Suivi de commande', description: 'Consulter l\'état d\'une commande ou d\'une livraison', agent: 'support', category: 'Support', plan: 'business', tools: ['sup_orderStatus'], mcpRequired: [], enabled: false },
    { id: 'SUP-004', name: 'Escalade intelligente', description: 'Escalader automatiquement les tickets non résolus vers un humain', agent: 'support', category: 'Support', plan: 'business', tools: ['sup_escalate'], mcpRequired: [], enabled: true },
    { id: 'SUP-005', name: 'Enquête satisfaction client', description: 'Envoyer un CSAT automatique après résolution de ticket', agent: 'support', category: 'Support', plan: 'business', tools: ['sup_satisfactionSurvey'], mcpRequired: [], enabled: false },
    { id: 'SUP-006', name: 'Support multicanal', description: 'Répondre sur chat, email et WhatsApp depuis une interface', agent: 'support', category: 'Support', plan: 'enterprise', tools: ['sup_knowledgeBase'], mcpRequired: ['slack', 'google_workspace'], enabled: false },
    { id: 'SUP-007', name: 'Widget support intégrable', description: 'Widget de chat IA intégrable sur le site web du client', agent: 'support', category: 'Support', plan: 'business', tools: ['sup_knowledgeBase'], mcpRequired: [], enabled: false },
    // ── Juridique ──────────────────────────────────────────────────────────────
    { id: 'LEG-001', name: 'Analyser un contrat', description: 'Analyser un contrat et résumer ses clauses principales', agent: 'legal', category: 'Legal', plan: 'enterprise', tools: ['leg_contractAnalyzer'], mcpRequired: [], enabled: true },
    { id: 'LEG-002', name: 'Détecter clauses risquées', description: 'Identifier les clauses abusives ou à risque dans un contrat', agent: 'legal', category: 'Legal', plan: 'enterprise', tools: ['leg_clauseDetector'], mcpRequired: [], enabled: true },
    { id: 'LEG-003', name: 'Suivi des échéances juridiques', description: 'Alerter sur les échéances contractuelles et légales à venir', agent: 'legal', category: 'Legal', plan: 'business', tools: ['leg_deadlineTracker'], mcpRequired: [], enabled: true },
    { id: 'LEG-004', name: 'Vérification conformité RGPD', description: 'Vérifier la conformité des processus avec le RGPD', agent: 'legal', category: 'Legal', plan: 'enterprise', tools: ['leg_complianceCheck'], mcpRequired: [], enabled: false },
    { id: 'LEG-005', name: 'Comparer deux contrats', description: 'Mettre en évidence les différences entre deux versions de contrat', agent: 'legal', category: 'Legal', plan: 'enterprise', tools: ['leg_contractCompare'], mcpRequired: [], enabled: false },
    { id: 'LEG-006', name: 'Modèle de contrat type', description: 'Générer un modèle de contrat standard (NDA, prestation, etc.)', agent: 'legal', category: 'Legal', plan: 'business', tools: ['leg_templateGenerator'], mcpRequired: [], enabled: true },
    { id: 'LEG-007', name: 'Recherche juridique', description: 'Rechercher dans la base de connaissances juridiques interne', agent: 'legal', category: 'Legal', plan: 'enterprise', tools: ['leg_legalSearch'], mcpRequired: [], enabled: false },
    // ── Formation ──────────────────────────────────────────────────────────────
    { id: 'TRN-001', name: 'Parcours onboarding', description: 'Créer un parcours de formation personnalisé pour un nouveau venu', agent: 'training', category: 'Training', plan: 'business', tools: ['trn_courseBuilder'], mcpRequired: [], enabled: true },
    { id: 'TRN-002', name: 'Générer un quiz', description: 'Créer un quiz de formation à partir d\'un document ou sujet', agent: 'training', category: 'Training', plan: 'starter', tools: ['trn_quizGenerator'], mcpRequired: [], enabled: true },
    { id: 'TRN-003', name: 'Suivi progression formations', description: 'Suivre l\'avancement des employés dans leurs parcours de formation', agent: 'training', category: 'Training', plan: 'business', tools: ['trn_progressTracker'], mcpRequired: [], enabled: true },
    { id: 'TRN-004', name: 'Certification interne', description: 'Délivrer des certificats après validation d\'un module', agent: 'training', category: 'Training', plan: 'business', tools: ['trn_certification'], mcpRequired: [], enabled: false },
    { id: 'TRN-005', name: 'Recommandations personnalisées', description: 'Suggérer des formations selon le rôle et les lacunes détectées', agent: 'training', category: 'Training', plan: 'enterprise', tools: ['trn_trainingRecommend'], mcpRequired: [], enabled: false },
    { id: 'TRN-006', name: 'Micro-learning quotidien', description: 'Envoyer une capsule de formation courte chaque jour', agent: 'training', category: 'Training', plan: 'business', tools: ['trn_courseBuilder'], mcpRequired: [], enabled: false },
    { id: 'TRN-007', name: 'Gamification (badges)', description: 'Attribuer des badges et points à la complétion de formations', agent: 'training', category: 'Training', plan: 'business', tools: ['trn_gamification'], mcpRequired: [], enabled: false },
    // ── Wildcard ───────────────────────────────────────────────────────────────
    { id: 'WLD-001', name: 'Multi-department task', description: 'Tasks requiring multiple agents simultaneously', agent: 'wildcard', category: 'Universal', plan: 'business', tools: ['ALL'], mcpRequired: [], enabled: true },
    { id: 'WLD-002', name: 'General research', description: 'General knowledge and document search', agent: 'wildcard', category: 'Universal', plan: 'starter', tools: ['searchDocuments', 'webSearch'], mcpRequired: [], enabled: true },
    { id: 'WLD-003', name: 'Event planning', description: 'Plan company events (budget, invites, agenda)', agent: 'wildcard', category: 'Universal', plan: 'business', tools: ['calendar', 'email', 'budget'], mcpRequired: [], enabled: true },
    { id: 'WLD-004', name: 'Weekly company summary', description: 'Full recap of everything that happened', agent: 'wildcard', category: 'Universal', plan: 'enterprise', tools: ['ALL'], mcpRequired: [], enabled: false },
    { id: 'WLD-005', name: 'Custom task', description: 'Anything that does not fit any other agent', agent: 'wildcard', category: 'Universal', plan: 'business', tools: ['ALL'], mcpRequired: [], enabled: true },
];
// ── Helpers ───────────────────────────────────────────────────────────────────
function getSkillsByAgent(agent) {
    return exports.SKILLS_REGISTRY.filter((s) => s.agent === agent);
}
function getSkillsByPlan(plan) {
    const planOrder = { starter: 0, business: 1, enterprise: 2 };
    return exports.SKILLS_REGISTRY.filter((s) => planOrder[s.plan] <= planOrder[plan]);
}
function getSkillById(id) {
    return exports.SKILLS_REGISTRY.find((s) => s.id === id);
}
exports.SKILLS_SUMMARY = {
    total: exports.SKILLS_REGISTRY.length,
    byPlan: {
        starter: exports.SKILLS_REGISTRY.filter((s) => s.plan === 'starter').length,
        business: exports.SKILLS_REGISTRY.filter((s) => s.plan === 'business').length,
        enterprise: exports.SKILLS_REGISTRY.filter((s) => s.plan === 'enterprise').length,
    },
    byAgent: Object.fromEntries(Array.from(new Set(exports.SKILLS_REGISTRY.map((s) => s.agent))).map((a) => [
        a,
        exports.SKILLS_REGISTRY.filter((s) => s.agent === a).length,
    ])),
};
//# sourceMappingURL=skillsRegistry.js.map