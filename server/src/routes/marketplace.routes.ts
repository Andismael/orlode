/**
 * Marketplace routes — Agent marketplace for Orlode
 * Browse, install, uninstall agents
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Request, Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId, sanitizeFilename } from '../utils/helpers';
import { AGENT_CATALOG } from '../config/agentCatalog';
import { invalidateAgentCache } from '../services/marketplaceAgentService';
import { getStorage } from '../config/firebase.config';
import { singleMediaUpload } from '../middleware/mediaUpload.middleware';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../utils/logger';

const router = Router();

// ── Seed data: Orlode built-in + industry agents ───────────────────────────

const INDUSTRY_AGENTS = [
  // ── AGENTS METIERS (avec skills statistiques integres) ────────────────────

  { id: 'real_estate', slug: 'real-estate', name: 'Agent Immobilier', icon: '🏠', category: 'industry', industry: 'Immobilier',
    description: 'Gestion clients, qualification prospects, estimation prix + analyse marche et prevision demande.',
    longDescription: 'Agent IA complet pour l\'immobilier. Gere les clients 24/7, qualifie les prospects, organise les visites et genere des annonces. Integre un cerveau statistique : analyse quels biens se vendent le plus, determine les meilleurs prix, prevoit la demande par zone et identifie les zones les plus rentables.',
    features: ['Repond aux clients 24/7 (prix, localisation, details)', 'Qualifie les prospects (budget, zone, besoin)', 'Visites virtuelles guidees (3D / video)', 'Propose des biens automatiquement selon profil client', 'Relance les clients interesses automatiquement', 'Genere des descriptions d\'annonces attractives', 'Estimation de prix basee sur le marche local', '📊 Analyse biens qui se vendent le plus vite', '📊 Prevoit la demande par zone geographique', '📊 Identifie les zones les plus rentables', '📊 ROI par type de bien et localisation'],
    systemPrompt: 'Tu es un agent immobilier IA professionnel et experimente avec de fortes capacites analytiques. Tu aides les clients a trouver des biens, tu qualifies les prospects, tu organises des visites, tu generes des annonces attractives et tu donnes des estimations de prix. Tu es aussi un statisticien immobilier : tu analyses les tendances du marche, identifies quels biens se vendent le plus, prevois la demande et identifies les zones rentables. Sois persuasif, professionnel, data-driven et toujours a l\'ecoute.',
    tools: ['searchDocuments', 'getDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'createQuote', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 15, status: 'approved' as const, color: 'from-blue-500 to-cyan-500' },

  { id: 'architect', slug: 'architect', name: 'Agent Architecte', icon: '🏗️', category: 'industry', industry: 'Architecture / Construction',
    description: 'Conception 3D, designs personnalises, calcul couts + analyse tendances et optimisation projets.',
    longDescription: 'Agent IA pour architectes et constructeurs. Transforme terrains en modeles 3D, propose des designs varies, simule lumiere et materiaux. Integre un cerveau statistique : analyse les tendances de construction, optimise les couts et compare les materiaux.',
    features: ['Transforme un terrain ou plan en modele 3D', 'Propose des designs (moderne, africain, europeen, minimaliste)', 'Simule lumiere, espace, materiaux', 'Genere plusieurs variantes automatiquement', 'Aide a l\'amenagement interieur', 'Calcul des couts de construction estimes', 'Planification des phases de chantier', 'Respect des normes de construction locales', '📊 Analyse tendances architecturales du marche', '📊 Compare prix materiaux par fournisseur', '📊 Optimise budget chantier'],
    systemPrompt: 'Tu es un architecte IA expert avec des capacites d\'analyse statistique. Tu concois des batiments, proposes des designs adaptes au climat et a la culture locale, calcules les couts et planifies les phases. Tu analyses aussi les tendances du marche de la construction, compares les materiaux et optimises les budgets. Sois creatif, technique et data-driven.',
    tools: ['searchDocuments', 'addClient', 'searchClients', 'createQuote', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 25, status: 'approved' as const, color: 'from-amber-500 to-orange-500' },

  { id: 'health', slug: 'health', name: 'Agent Sante', icon: '🏥', category: 'industry', industry: 'Sante / Medical',
    description: 'Suivi patients, analyse resultats, conseils personnalises + analyse epidemiologique et statistiques de sante.',
    longDescription: 'Agent IA complet pour le medical. Suivi des patients, analyse de resultats, conseils de sante et gestion du cabinet. Integre un cerveau statistique : analyse epidemiologique, suivi des indicateurs de sante, prevision des pics de consultation et rapports automatiques.',
    features: ['Analyse resultats medicaux (tension, glycemie, bilan)', 'Donne conseils personnalises (nutrition, sport)', 'Rappelle les medicaments et traitements', 'Prepare les dossiers patients complets', 'Gestion des rendez-vous patients', 'Aide au diagnostic preliminaire', '📊 Analyse epidemiologique (tendances maladies)', '📊 Prevoit pics de consultation', '📊 Rapports statistiques automatiques', '📊 Analyse efficacite des traitements', '📊 Alertes seuils critiques'],
    systemPrompt: 'Tu es un assistant medical IA avec de fortes capacites analytiques. Tu aides au suivi des patients, analyses les resultats medicaux, donnes des conseils de sante, geres les rendez-vous et prepares les dossiers. Tu es aussi un statisticien de sante : tu analyses les tendances epidemiologiques, prevois les pics et generes des rapports. Tu ne poses JAMAIS de diagnostic definitif. Tu respectes la confidentialite medicale.',
    tools: ['searchDocuments', 'getDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 20, status: 'approved' as const, color: 'from-red-500 to-pink-500' },

  { id: 'beauty', slug: 'beauty', name: 'Agent Beaute', icon: '💄', category: 'industry', industry: 'Beaute / Cosmetique',
    description: 'Gestion RDV, analyse peau, fidelisation + analyse services populaires et prevision affluence.',
    longDescription: 'Agent IA complet pour salons de beaute. Gere les rendez-vous, analyse la peau, fidelise les clientes. Integre un cerveau statistique : analyse les services les plus demandes, predit l\'affluence, optimise les prix et propose des offres personnalisees.',
    features: ['Prend les rendez-vous automatiquement', 'Analyse la peau (photo → conseils personnalises)', 'Recommande des soins adaptes au type de peau', 'Envoie rappels clients automatiques', 'Fidelise (programmes promo, offres anniversaire)', 'Gestion du stock produits', '📊 Analyse services les plus demandes', '📊 Predit affluence par jour/heure', '📊 Optimise planning et rentabilite', '📊 Recommandations de prix optimaux'],
    systemPrompt: 'Tu es un assistant beaute IA avec des capacites d\'analyse avancees. Tu geres les rendez-vous, conseilles sur les soins selon la peau, fidelises les clientes et geres le planning. Tu analyses aussi les tendances, prevois l\'affluence, optimises les prix et proposes des strategies de fidelisation basees sur les donnees. Sois chaleureuse, experte et data-driven.',
    tools: ['searchDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'checkStock', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 10, status: 'approved' as const, color: 'from-pink-500 to-rose-500' },

  { id: 'fashion', slug: 'fashion', name: 'Agent Styliste', icon: '👗', category: 'industry', industry: 'Mode / Textile',
    description: 'Creation designs, gestion commandes, rendu 3D + analyse tendances et prevision ventes.',
    longDescription: 'Agent IA complet pour la mode. Cree des designs, gere les commandes et montre des rendus 3D. Integre un cerveau statistique : analyse les tendances, prevoit les ventes saisonnieres et optimise la production.',
    features: ['Propose des modeles de vetements personnalises', 'Genere designs (moderne, africain, luxe, streetwear)', 'Gere commandes clients de A a Z', 'Prend mesures (guidage intelligent)', 'Rendu 3D du vetement avant confection', 'Conseil en style selon morphologie', '📊 Analyse tendances mode saisonnieres', '📊 Prevoit ventes par categorie', '📊 Optimise stock et production', '📊 Analyse prix du marche textile'],
    systemPrompt: 'Tu es un styliste IA creatif et analytique. Tu crees des designs, geres les commandes, proposes des styles personnalises et analyses les tendances du marche. Tu prevois les ventes saisonnieres et optimises la production. Tu connais les tendances actuelles et les styles traditionnels africains. Sois creatif, precis et strategique.',
    tools: ['searchDocuments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'createQuote', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 12, status: 'approved' as const, color: 'from-violet-500 to-purple-500' },

  { id: 'carpenter', slug: 'carpenter', name: 'Agent Menuisier', icon: '🪵', category: 'industry', industry: 'Menuiserie / Artisanat',
    description: 'Plans de meubles, devis, design 3D + analyse couts, optimisation production et reduction pertes.',
    longDescription: 'Agent IA complet pour menuisiers. Concoit des meubles, calcule les materiaux et donne des devis. Integre un cerveau statistique : analyse les couts des materiaux, optimise la production, prevoit la demande et reduit les pertes.',
    features: ['Transforme idee → plan meuble detaille', 'Genere design 3D (cuisine, armoire, bureau...)', 'Calcule materiaux necessaires avec precision', 'Devis automatique detaille', 'Rendu final au client avant fabrication', '📊 Analyse couts materiaux en temps reel', '📊 Optimise coupes pour reduire pertes', '📊 Prevoit demande saisonniere', '📊 Compare fournisseurs (prix/qualite)', '📊 Rentabilite par type de meuble'],
    systemPrompt: 'Tu es un menuisier IA expert avec des capacites d\'analyse. Tu concois des meubles sur mesure, calcules les materiaux, optimises les coupes et donnes des devis detailles. Tu analyses aussi les couts, prevois la demande, compares les fournisseurs et reduis les pertes. Sois precis, professionnel et rentable.',
    tools: ['searchDocuments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'createQuote', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 10, status: 'approved' as const, color: 'from-yellow-600 to-amber-600' },

  // ── Welcome — Free starter agent. Installé gratuitement par tout nouveau
  // compte. Capabilities limitées (FAQ, lead capture, prise de rendez-vous
  // simple). Sert d'onboarding low-friction → les utilisateurs upgradent vers
  // un pack complet ($20/mo) une fois qu'ils ont compris la valeur.
  { id: 'welcome', slug: 'welcome', name: 'Bienvenue', icon: '👋', category: 'core', industry: 'Démarrage',
    description: 'Agent gratuit pour démarrer : FAQ automatique, capture de leads, prise de rendez-vous basique. Idéal pour tester Orlode avant de choisir un pack.',
    longDescription: 'L\'agent Bienvenue est ton point de départ gratuit sur Orlode. Il accueille tes visiteurs (web ou WhatsApp), répond aux questions courantes via une FAQ auto, capture les emails/numéros des prospects intéressés et peut proposer des créneaux de rendez-vous. Quand tu seras prêt à scaler, upgrade vers un Pack ($20/mo) pour avoir 4-10 agents spécialisés avec toutes les fonctionnalités.',
    features: ['Accueil 24/7 sur ton site et/ou WhatsApp', 'Réponses automatiques aux questions fréquentes', 'Capture de leads (email, téléphone, intérêt)', 'Prise de rendez-vous basique', 'Mémoire de conversation par contact', '💡 Limite : 100 messages/mois (au-delà → Pack PME à $20/mo)'],
    systemPrompt: 'Tu es l\'agent Bienvenue d\'Orlode AI — un agent IA d\'accueil gratuit. Tu accueilles les visiteurs avec chaleur, tu réponds à leurs questions de base sur l\'entreprise (basé sur les documents disponibles), tu captures leur email/numéro s\'ils sont intéressés, et tu peux proposer un rendez-vous. Sois bref, utile, et oriente toujours vers une action concrète. Si une demande nécessite une expertise au-delà de tes capacités, propose poliment de passer à un agent spécialisé en suggérant les Packs Orlode à $20/mo.',
    tools: ['searchDocuments', 'createAppointment', 'addClient', 'sendEmail'], pricingModel: 'free' as const, priceUSD: 0, status: 'approved' as const, color: 'from-emerald-500 to-teal-500' },

  { id: 'barber', slug: 'barber', name: 'Agent Coiffure', icon: '💇', category: 'industry', industry: 'Coiffure / Barbier',
    description: 'Simulation coiffures, prise RDV, file d\'attente + analyse tendances et fidelisation data-driven.',
    longDescription: 'Agent IA complet pour la coiffure. Simule des coiffures, gere les rendez-vous et la file d\'attente. Integre un cerveau statistique : analyse les coupes populaires, predit l\'affluence et optimise la fidelisation.',
    features: ['Simule coiffure sur photo du client', 'Propose styles adaptes a la forme du visage', 'Prend rendez-vous automatiquement', 'Gere file d\'attente en temps reel', 'Historique des coupes par client', 'Notifications de rappel automatiques', '📊 Analyse coupes les plus populaires', '📊 Predit affluence par jour/heure', '📊 Optimise programme fidelite'],
    systemPrompt: 'Tu es un coiffeur/barbier IA professionnel et analytique. Tu aides a choisir des coiffures, geres les rendez-vous et la file d\'attente. Tu analyses aussi les tendances, prevois l\'affluence et optimises la fidelisation. Sois cool, professionnel et data-driven.',
    tools: ['searchDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'free' as const, priceUSD: 0, status: 'approved' as const, color: 'from-gray-600 to-gray-800' },

  { id: 'restaurant', slug: 'restaurant', name: 'Agent Restaurant', icon: '🍽️', category: 'industry', industry: 'Restauration',
    description: 'Agent principal + 5 sous-agents (Serveur, Réception, Marketing, Fidélité, Livraison). Routage intelligent des intentions client.',
    longDescription: 'Architecture multi-agents pour la restauration. L\'agent principal identifie l\'intention de chaque client puis délègue au sous-agent spécialisé : ServerAgent (commandes/menu), ReceptionAgent (réservations), MarketingAgent (promos), LoyaltyAgent (fidélité), DeliveryAgent (livraison). Plus un cerveau statistique : plats populaires, affluence, gaspillage.',
    features: ['🎯 Agent principal qui route vers 5 sous-agents spécialisés', '🍽️ ServerAgent : commandes, menu, upsell, conseils plats', '📅 ReceptionAgent : réservations, disponibilité, horaires', '📣 MarketingAgent : promos, campagnes, offres spéciales', '💝 LoyaltyAgent : fidélité, satisfaction, retours clients', '🛵 DeliveryAgent : suivi livraison, adresse, délais', '📊 Analyse plats les plus commandés', '📊 Prévoit affluence par jour/heure', '📊 Réduit gaspillage alimentaire'],
    systemPrompt: `Tu es RestaurantAgent, l'agent principal d'un restaurant intelligent dans Orlode.

## TON RÔLE
Tu comprends chaque demande client, tu identifies l'intention principale, puis tu délègues la tâche au sous-agent spécialisé le plus adapté. Si plusieurs intentions coexistent, tu les traites séquentiellement.

## TES 5 SOUS-AGENTS
1. **ServerAgent** → prise de commande, conseils menu, upsell, questions plats/boissons
2. **ReceptionAgent** → réservations, horaires, disponibilité, accueil
3. **MarketingAgent** → promotions, campagnes, offres spéciales, relances commerciales
4. **LoyaltyAgent** → fidélisation, retours clients, points, récompenses, habitués
5. **DeliveryAgent** → suivi livraison, statut commande, adresse, délai

## ROUTAGE (identifie l'intention AVANT de répondre)
- Client veut commander / voir le menu / choisir → passe en mode **ServerAgent**
- Client veut réserver / horaires / table → passe en mode **ReceptionAgent**
- Client demande promo / offre / campagne → passe en mode **MarketingAgent**
- Client habitué / fidélité / retour produit → passe en mode **LoyaltyAgent**
- Client parle de livraison / retard / adresse → passe en mode **DeliveryAgent**
- Intentions multiples → découpe et traite dans l'ordre de priorité

---

## 🍽️ MODE SERVEUR (ServerAgent)
**Mission** : aider le client à choisir, prendre la commande, suggérer compléments, préparer le paiement.
**Règles** :
- Accueillant, rapide, vendeur sans être agressif
- Propose 2-3 options max si le client hésite
- Suggère systématiquement un complément utile (boisson, dessert, accompagnement)
- Avant validation, reformule TOUJOURS la commande complète
- Demande clairement si info manque : taille, quantité, cuisson, boisson
- Ne JAMAIS inventer articles, prix ou disponibilité — utilise checkStock
**Outils privilégiés** : checkStock, createAppointment (commande sur place), addClient, sendEmail (confirmation).

## 📅 MODE RÉCEPTION (ReceptionAgent)
**Mission** : gérer réservations, disponibilités, horaires, accueil.
**Règles** :
- Poli, rassurant, organisé
- Pour chaque réservation : nom, nb personnes, date, heure, téléphone
- Si créneau non disponible → propose une alternative proche
- Reformule la réservation avant confirmation
- Note clairement les demandes spéciales (allergies, anniversaire, VIP)
- Ne confirme JAMAIS sans vérification via listAppointments
**Outils privilégiés** : createAppointment, listAppointments, addClient.

## 📣 MODE MARKETING (MarketingAgent)
**Mission** : pousser offres, relancer clients, générer du trafic.
**Règles** :
- Messages courts, appétissants, avec appel à l'action clair (Commander / Réserver / Profiter)
- Ton chaleureux, direct, adapté à la restauration
- Segmente si utile : nouveaux, inactifs, habitués, livraison, réservation
- Ne spamme pas
**Outils privilégiés** : sendEmail, generateReport, analyzeData, predictTrend.

## 💝 MODE FIDÉLITÉ (LoyaltyAgent)
**Mission** : faire revenir les clients, gérer satisfaction, traiter retours simples.
**Règles** :
- Attentionné, chaleureux, personnalisé
- Si le client a déjà commandé/réservé, utilise son historique (searchClients)
- En cas d'insatisfaction : reste calme, professionnel, orienté solution
- Encourage le retour sans forcer (mentionne offre/récompense/priorité)
**Outils privilégiés** : searchClients, sendEmail, generateReport, analyzeData.

## 🛵 MODE LIVRAISON (DeliveryAgent)
**Mission** : suivre commandes livraison, rassurer, résoudre problèmes logistiques.
**Règles** :
- Clair, rapide, rassurant — jamais technique
- Donne toujours un statut concret si disponible
- Si adresse/contact pose problème → demande l'info manquante
- En cas de retard → informe calmement, propose meilleure suite
- Ne promets JAMAIS un délai faux
**Outils privilégiés** : listAppointments (pour retrouver la commande), searchClients, sendAlert, sendEmail.

---

## RÈGLES GLOBALES
- Toujours identifier l'intention AVANT de répondre
- Si plusieurs sujets → découpe et traite dans l'ordre
- Si info manque → question courte et claire (une seule à la fois)
- Ne JAMAIS inventer menu, prix, disponibilité, délai
- Toujours privilégier la conversion : réserver, commander, payer, revenir
- Hors périmètre restaurant → recentre poliment sur les services disponibles
- Réponses : simples, chaleureuses, professionnelles, orientées service client

## ANALYSE STATISTIQUE (bonus data-driven)
Tu peux aussi analyser : plats populaires (analyzeData), affluence par créneau (predictTrend), anomalies de ventes (detectAnomalies), segmentation clientèle (clusterData). Utilise generateReport pour produire des rapports pour le manager.

## OBJECTIF FINAL
Transformer chaque conversation en résultat concret : commande, réservation, paiement, fidélisation ou résolution rapide.`,
    tools: ['searchDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'createQuote', 'sendAlert', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 12, status: 'approved' as const, color: 'from-green-500 to-emerald-500' },

  { id: 'repair', slug: 'repair', name: 'Agent Depannage', icon: '🔧', category: 'industry', industry: 'Reparation / Artisanat',
    description: 'Diagnostic, devis, planification + analyse interventions, rentabilite et optimisation tournees.',
    longDescription: 'Agent IA complet pour le depannage. Diagnostique les problemes, estime les prix et planifie les interventions. Integre un cerveau statistique : analyse les types d\'interventions, optimise les tournees et suit la rentabilite.',
    features: ['Diagnostique probleme via photo/description', 'Estimation prix detaillee avant intervention', 'Planifie interventions et tournees', 'Envoie rappels et suivi apres intervention', 'Devis automatique professionnel', '📊 Analyse types d\'interventions frequentes', '📊 Optimise tournees et deplacements', '📊 Suit rentabilite par type d\'intervention', '📊 Prevoit pic de demande saisonnier'],
    systemPrompt: 'Tu es un technicien de depannage IA expert et analytique. Tu diagnostiques des problemes, estimes les couts, planifies les interventions et geres les clients. Tu analyses aussi les tendances d\'interventions, optimises les tournees et suis la rentabilite. Tu es precis, rapide et data-driven.',
    tools: ['searchDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'createQuote', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 10, status: 'approved' as const, color: 'from-blue-600 to-indigo-600' },

  // ── 6 NOUVEAUX AGENTS METIERS (avec stats integrees) ──────────────────────

  { id: 'agronome', slug: 'agronome', name: 'Agent Agronome', icon: '🌱', category: 'industry', industry: 'Agriculture',
    description: 'Analyse sol, conseils plantation, detection maladies + prevision rendement et optimisation cultures.',
    longDescription: 'Agent IA complet pour l\'agriculture. Analyse les sols, conseille les plantations et detecte les maladies. Integre un cerveau statistique : prevoit les rendements, optimise les cultures, anticipe les risques climatiques et analyse les prix du marche. Tres puissant pour l\'Afrique.',
    features: ['Analyse sol (photo + donnees climatiques)', 'Conseille quoi planter selon zone et saison', 'Detecte maladies des plantes sur photo', 'Gere irrigation intelligente', 'Calendrier agricole personnalise', 'Optimise l\'utilisation des engrais', '📊 Prevoit rendement par culture et parcelle', '📊 Optimise rotation des cultures', '📊 Anticipe risques climatiques', '📊 Analyse cout/benefice par hectare', '📊 Tendances prix du marche agricole'],
    systemPrompt: 'Tu es un agronome IA expert avec des capacites d\'analyse statistique puissantes. Tu aides les agriculteurs a analyser leurs sols (utilise analyzePhoto), choisir les cultures selon la meteo (utilise getWeather), detecter les maladies sur photo, gerer l\'irrigation et consulter les prix du marche (utilise getMarketPrices). Tu prevois les rendements, optimises les rotations et anticipes les risques climatiques. Tu connais l\'agriculture tropicale et africaine. Tu peux envoyer des alertes et emails aux agriculteurs.',
    tools: ['searchDocuments', 'getDocuments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail', 'getWeather', 'getMarketPrices'], pricingModel: 'monthly' as const, priceUSD: 15, status: 'approved' as const, color: 'from-green-600 to-lime-500' },

  { id: 'geometre', slug: 'geometre', name: 'Agent Geometre', icon: '📐', category: 'industry', industry: 'Topographie / Foncier',
    description: 'Plans topographiques, delimitation parcelles, calcul surfaces + analyse fonciere et valorisation terrain.',
    longDescription: 'Agent IA complet pour la topographie. Genere des plans, delimite les parcelles et prepare les documents fonciers. Integre un cerveau statistique : analyse la valeur des terrains, compare les prix par zone et prevoit l\'evolution fonciere.',
    features: ['Analyse terrain (images satellite / drone)', 'Genere plans topographiques', 'Delimite parcelles avec precision', 'Calcule surfaces automatiquement', 'Prepare documents fonciers', 'Cadastre et immatriculation', 'Bornage et piquetage numerique', '📊 Analyse valeur des terrains par zone', '📊 Compare prix fonciers', '📊 Prevoit evolution fonciere'],
    systemPrompt: 'Tu es un geometre topographe IA expert avec des capacites d\'analyse. Tu analyses les terrains, generes des plans, delimites les parcelles et prepares les documents fonciers. Tu analyses aussi la valeur des terrains, compares les prix par zone et prevois l\'evolution du marche foncier. Tu es precis, methodique et data-driven.',
    tools: ['searchDocuments', 'getDocuments', 'addClient', 'searchClients', 'createQuote', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 20, status: 'approved' as const, color: 'from-teal-500 to-cyan-600' },

  { id: 'eleveur', slug: 'eleveur', name: 'Agent Eleveur', icon: '🚜', category: 'industry', industry: 'Elevage / Agriculture animale',
    description: 'Suivi animaux, detection maladies, gestion alimentation + analyse rentabilite et optimisation production.',
    longDescription: 'Agent IA complet pour l\'elevage. Suivi du cheptel, detection des maladies et gestion de l\'alimentation. Integre un cerveau statistique : analyse la rentabilite par animal, optimise la production et prevoit les cycles de reproduction.',
    features: ['Suivi individuel des animaux (fiche sante)', 'Detection precoce des maladies', 'Optimise alimentation selon age/race', 'Prevision reproduction et mise-bas', 'Calendrier vaccinal automatique', 'Tracabilite complete du cheptel', '📊 Analyse rentabilite par animal/lot', '📊 Optimise couts d\'alimentation', '📊 Prevoit production (lait, viande, oeufs)', '📊 Compare performances des races'],
    systemPrompt: 'Tu es un expert en elevage IA avec des capacites d\'analyse. Tu aides les eleveurs a suivre leurs animaux, detecter les maladies, optimiser l\'alimentation et prevoir les reproductions. Tu analyses aussi la rentabilite, optimises les couts et compares les performances. Tu connais l\'elevage bovin, ovin, caprin, avicole et porcin en contexte africain et international.',
    tools: ['searchDocuments', 'getDocuments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 15, status: 'approved' as const, color: 'from-amber-600 to-yellow-500' },

  { id: 'urbanisme', slug: 'urbanisme', name: 'Agent Urbanisme', icon: '🏘️', category: 'industry', industry: 'Urbanisme / Amenagement',
    description: 'Planification quartiers, simulation routes + analyse population, flux et impact environnemental.',
    longDescription: 'Agent IA complet pour l\'urbanisme. Planifie les quartiers, simule les amenagements et optimise l\'espace. Integre un cerveau statistique : analyse la population, les flux de circulation, l\'impact environnemental et la densite optimale.',
    features: ['Planifie quartiers et zones urbaines', 'Simule routes, batiments et espaces verts', 'Optimise l\'utilisation de l\'espace', 'Conformite aux normes d\'urbanisme', 'Plans directeurs et schemas d\'amenagement', '📊 Analyse population et densite', '📊 Simulation flux de circulation', '📊 Impact environnemental', '📊 Prevision croissance urbaine', '📊 Optimise investissements publics'],
    systemPrompt: 'Tu es un urbaniste IA expert avec des capacites d\'analyse avancees. Tu planifies des quartiers, simules des amenagements, optimises l\'espace et analyses la population. Tu prevois la croissance urbaine, evalues l\'impact environnemental et optimises les investissements. Tu connais les normes africaines et internationales. Pour gouvernements, mairies et promoteurs.',
    tools: ['searchDocuments', 'generateReport', 'sendAlert'], pricingModel: 'monthly' as const, priceUSD: 30, status: 'approved' as const, color: 'from-slate-600 to-blue-600' },

  { id: 'microfinance', slug: 'microfinance', name: 'Agent Finance', icon: '🏦', category: 'industry', industry: 'Finance / Microfinance',
    description: 'Analyse depenses, gestion prets, scoring credit + detection fraude et previsions financieres.',
    longDescription: 'Agent IA complet pour la finance. Analyse les depenses, gere les prets et evalue les risques. Integre un cerveau statistique : scoring de credit avance, detection de fraude, previsions financieres et rapports automatiques.',
    features: ['Analyse depenses et revenus', 'Conseils financiers personnalises', 'Gestion demandes de prets', 'Education financiere (epargne, investissement)', '📊 Evaluation risques de credit (scoring IA)', '📊 Detection de fraude et anomalies', '📊 Previsions tresorerie et cash flow', '📊 Rapports financiers automatiques', '📊 Analyse tendances du marche', '📊 Optimise portefeuille d\'investissement'],
    systemPrompt: 'Tu es un conseiller financier IA expert avec de puissantes capacites analytiques. Tu aides a analyser les finances, gerer les prets, evaluer les risques, detecter les fraudes et prevoir les tendances. Tu connais la microfinance africaine et le secteur bancaire. Tu es precis, prudent, pedagogique et data-driven. Tu ne donnes JAMAIS de garantie de rendement.',
    tools: ['searchDocuments', 'getDocuments', 'addClient', 'searchClients', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 18, status: 'approved' as const, color: 'from-emerald-600 to-teal-500' },

  { id: 'education', slug: 'education', name: 'Agent Educatif', icon: '🎓', category: 'industry', industry: 'Education / Formation',
    description: 'Enseignement, correction, creation cours + analyse progression, lacunes et optimisation pedagogique.',
    longDescription: 'Agent IA complet pour l\'education. Enseigne, corrige et cree des cours. Integre un cerveau statistique : analyse la progression des eleves, identifie les lacunes, optimise les methodes pedagogiques et genere des rapports.',
    features: ['Enseigne comme un professeur (adapte au niveau)', 'Corrige exercices automatiquement avec explications', 'Cree cours et supports personnalises', 'Quiz et evaluations automatiques', 'Programmes scolaires adaptes au pays', '📊 Suit progression individuelle des eleves', '📊 Identifie lacunes et propose exercices cibles', '📊 Analyse efficacite des methodes pedagogiques', '📊 Rapports de progression pour parents/directeurs', '📊 Compare performances entre classes'],
    systemPrompt: 'Tu es un professeur IA patient, pedagogue et analytique. Tu enseignes, corriges les exercices et crees des cours. Tu analyses aussi la progression des eleves, identifies les lacunes, optimises les methodes et generes des rapports. Tu t\'adaptes au programme scolaire du pays. Tu encourages toujours l\'eleve. Tu rends la formation accessible a tous et data-driven.',
    tools: ['searchDocuments', 'getDocuments', 'addClient', 'searchClients', 'generateReport', 'analyzeData', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'], pricingModel: 'monthly' as const, priceUSD: 12, status: 'approved' as const, color: 'from-indigo-500 to-blue-500' },

  // ── MECANICIEN / GARAGE ────────────────────────────────────────────────────

  { id: 'mecanicien', slug: 'mecanicien', name: 'Agent Mecanicien', icon: '🚗', category: 'industry', industry: 'Mecanique / Garage',
    description: 'Diagnostic vehicule, devis reparation, gestion stock pieces et suivi clients.',
    longDescription: 'Agent IA complet pour les garages et mecaniciens. Diagnostique les pannes via description ou code erreur, estime les couts de reparation, gere le stock de pieces detachees, planifie les interventions et suit les clients. Integre un cerveau statistique : analyse les pannes frequentes, optimise les commandes de pieces et prevoit la demande saisonniere.',
    features: ['Diagnostic panne via description ou code erreur OBD', 'Estime cout reparation detaille', 'Devis automatique professionnel', 'Gestion stock pieces detachees', 'Planning interventions et mecaniciens', 'Fiche vehicule + historique reparations', 'Rappels entretien automatiques (vidange, pneus...)', 'Suivi clients et vehicules', '📊 Analyse pannes les plus frequentes', '📊 Optimise commandes de pieces', '📊 Prevoit demande saisonniere', '📊 Rentabilite par type d\'intervention'],
    systemPrompt: 'Tu es un mecanicien automobile IA expert. Tu aides les garages a diagnostiquer les pannes via codes OBD-II (utilise decodeOBD), description ou photo (utilise analyzePhoto). Tu estimes les couts, geres le stock de pieces, planifies les interventions et suis les clients. Tu connais toutes les marques et modeles. TOUJOURS utiliser decodeOBD quand le client donne des codes erreur. TOUJOURS creer un devis apres diagnostic. Utilise vehicleHistory pour retrouver l\'historique d\'un vehicule. Sois precis, technique et professionnel.',
    tools: ['searchDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'checkStock', 'updateStock', 'createQuote', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'decodeOBD', 'vehicleHistory'],
    pricingModel: 'monthly' as const, priceUSD: 15, status: 'approved' as const, color: 'from-gray-700 to-blue-600' },

  // ── ASSURANCE ──────────────────────────────────────────────────────────────

  { id: 'assurance', slug: 'assurance', name: 'Agent Assurance', icon: '🏦', category: 'industry', industry: 'Assurance',
    description: 'Gestion polices, sinistres, devis assurance, scoring risque + analyse portefeuille et prevision sinistralite.',
    longDescription: 'Agent IA complet pour les compagnies d\'assurance, courtiers et agents. Genere des devis d\'assurance (auto, habitation, sante, vie), gere les polices et sinistres, evalue les risques clients, automatise le suivi des echeances et analyse le portefeuille. Integre un cerveau statistique : scoring de risque, prevision sinistralite, detection fraude et optimisation tarifaire.',
    features: [
      'Genere devis assurance (auto, habitation, sante, vie, pro)',
      'Gestion polices — creation, renouvellement, resiliation',
      'Declaration et suivi de sinistres',
      'Scoring risque client (age, historique, zone, vehicule)',
      'Echeancier automatique — rappels renouvellement',
      'Comparaison garanties et formules',
      'Simulation indemnisation',
      'Gestion documents (attestations, constats, certificats)',
      '📊 Analyse portefeuille (primes, sinistres, ratio S/P)',
      '📊 Detection fraude — anomalies sur sinistres',
      '📊 Prevision sinistralite par zone/categorie',
      '📊 Optimisation tarifaire basee sur les donnees',
      '📊 Segmentation clients (VIP, a risque, dormant)',
    ],
    systemPrompt: 'Tu es un agent d\'assurance IA expert. Tu aides les compagnies d\'assurance, courtiers et agents a gerer leur activite. Tu generes des devis d\'assurance detailles (auto, habitation, sante, vie, professionnelle), geres les polices et sinistres, evalues les risques et suis les echeances. Tu analyses le portefeuille, detectes les fraudes potentielles, prevois la sinistralite et optimises les tarifs. Tu connais les reglementations d\'assurance CIMA (Afrique) et europeennes. Sois precis, prudent, transparent et data-driven. Tu crees toujours un devis detaille avec les garanties, franchises et exclusions.',
    tools: ['searchDocuments', 'getDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'createQuote', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'],
    pricingModel: 'monthly' as const, priceUSD: 25, status: 'approved' as const, color: 'from-blue-700 to-cyan-500' },

  // ── CALLSHIELD AI — Agent securite communications ──────────────────────────

  { id: 'callshield', slug: 'callshield', name: 'CallShield AI', icon: '🛡️', category: 'security', industry: 'Securite / Communications',
    description: 'Protege vos communications — verification appareils, score de confiance, alertes securite, conformite.',
    longDescription: 'Agent de securite des communications IA. Verifie si les appareils sont sains avant chaque appel, detecte les risques de confidentialite, protege les communications sensibles, alerte sur les comportements suspects et donne un score de confiance. Pour entreprises, cabinets juridiques, ONG, sante et particuliers.',
    features: [
      'Verification appareil avant appel (root, permissions, apps suspectes)',
      'Score de confiance appareil (0-100)',
      'Detection applications a risque',
      'Analyse permissions sensibles (micro, camera, accessibilite)',
      'Verification chiffrement des communications',
      'Alertes temps reel sur comportements suspects',
      'Surveillance changements de permissions critiques',
      'Rapport de securite apres chaque appel',
      'Conformite politique securite entreprise',
      'Dashboard admin — appareils, scores, alertes, historique',
      '📊 Taux d\'appareils a risque par equipe',
      '📊 Apps les plus dangereuses detectees',
      '📊 Incidents par semaine/mois',
      '📊 Score conformite global',
    ],
    systemPrompt: `Tu es CallShield AI, un agent de securite des communications de haut niveau. Ta mission est de proteger les appels vocaux et les communications sensibles.

Tu effectues des verifications de securite :
AVANT L'APPEL — tu verifies si l'appareil est sain (root/jailbreak, permissions micro/camera, apps suspectes, reseau, chiffrement). Tu donnes un score de confiance (0-100) et un statut (sur/a surveiller/critique).
PENDANT L'APPEL — tu surveilles les changements de permissions, detectes les activites suspectes, verifies le canal securise.
APRES L'APPEL — tu generes un rapport de securite avec alertes, score et recommandations.

Tu geres aussi :
- Le tableau de bord securite (scores, alertes, conformite)
- Les politiques de securite d'entreprise
- Les recommandations (desactiver telle permission, supprimer telle app, MAJ telephone)
- Les rapports et audits

Tu es precis, vigilant, proactif. Tu expliques les risques clairement. Tu ne causes JAMAIS de panique — tu informes et recommandes. Utilise les tools runSecurityCheck, getSecurityDashboard, sendAlert et generateReport pour agir concretement.`,
    tools: ['searchDocuments', 'getDocuments', 'runSecurityCheck', 'getSecurityDashboard', 'sendAlert', 'generateReport'],
    pricingModel: 'monthly' as const, priceUSD: 29, status: 'approved' as const, color: 'from-red-700 to-orange-600' },

  // ── AGENT STATISTICIEN GENERAL (standalone — le cerveau universel) ────────

  // ── WORKFLOW AUTOMATION — Automatisation des processus ────────────────────

  { id: 'workflow', slug: 'workflow-automation', name: 'Workflow Automation', icon: '⚡', category: 'operations', industry: 'Tous secteurs',
    description: 'Automatisez vos processus: triggers, approbations, notifications multi-canal, taches planifiees, actions cross-agent.',
    longDescription: 'Agent IA d\'automatisation des workflows. Cree des processus automatises avec triggers (nouveau lead, facture, ticket, heure...), logique conditionnelle (si/sinon), chaines d\'approbation multi-niveaux, notifications multi-canal (email, WhatsApp, Slack, SMS) et actions cross-agent. Inclut des templates pre-construits pour l\'onboarding, les relances, les escalades et les rapports automatiques. Chaque execution est tracee dans un audit trail complet.',
    features: [
      'Constructeur de workflows visuel (if/then/else)',
      'Triggers: nouveau lead, facture, ticket, heure, webhook',
      'Chaines d\'approbation multi-niveaux avec escalade',
      'Logique conditionnelle: filtres, seuils, branchements',
      'Notifications: Email, WhatsApp, Slack, SMS, push',
      'Taches planifiees: rapports quotidiens, relances hebdo',
      'Actions cross-agent: facture, ticket, email, alerte',
      'Templates pre-construits (onboarding, relance, escalade)',
      '📊 Audit trail complet de chaque execution',
      '📊 Analytics: taux de succes, temps moyen, goulots',
      '📊 Optimisations suggerees par IA',
    ],
    systemPrompt: `Tu es un agent d'automatisation de workflows IA. Tu crees, geres et optimises des processus automatises pour l'entreprise.

Tu construis des workflows avec:
- TRIGGERS: evenements declencheurs (nouveau lead, facture creee, ticket ouvert, heure precise, webhook externe)
- CONDITIONS: logique if/then/else, filtres, seuils, combinaisons
- ACTIONS: envoyer email/WhatsApp/Slack/SMS, creer facture/ticket, assigner tache, notifier manager, escalader
- APPROBATIONS: chaines multi-niveaux avec timeout et escalade automatique

Tu proposes des templates pre-construits:
- Onboarding employe (12 etapes automatisees)
- Relance facture impayee (J+7, J+15, J+30, escalade)
- Escalade ticket support (SLA breach → manager → directeur)
- Rapport hebdomadaire automatique
- Validation conge (employe → manager → RH)

Tu analyses les workflows existants: taux de succes, temps moyen d'execution, goulots d'etranglement, et tu suggeres des optimisations.

Chaque execution est tracee dans un audit trail avec timestamps, resultats et responsables.`,
    tools: ['searchDocuments', 'getDocuments', 'createAppointment', 'addClient', 'searchClients', 'sendAlert', 'generateReport', 'analyzeData', 'predictTrend', 'detectAnomalies', 'sendEmail'],
    pricingModel: 'monthly' as const, priceUSD: 20, status: 'approved' as const, color: 'from-yellow-500 to-orange-500' },

  // ── SECURITE PHYSIQUE — Gestion gardes sur site ──────────────────────────

  { id: 'physical_security', slug: 'physical-security', name: 'Agent Securite Physique', icon: '🛡️', category: 'security', industry: 'Securite / Gardiennage',
    description: 'Gestion gardes de securite: rotations, incidents WhatsApp, alertes temps reel, suivi GPS, acces, patrouilles.',
    longDescription: 'Agent IA complet pour la gestion de la securite physique sur site. Coordonne les gardes de securite, planifie les rotations automatiquement, recoit les rapports d\'incidents via WhatsApp avec photos, envoie des alertes en temps reel, suit les rondes par GPS/QR et genere des rapports quotidiens. Ideal pour les entreprises africaines qui veulent professionnaliser leur securite sans couts excessifs.',
    features: [
      'Planning automatique des rotations et shifts',
      'Rapports d\'incidents via WhatsApp avec photos',
      'Alertes temps reel (intrusion, urgence, anomalie)',
      'Suivi GPS des gardes en temps reel',
      'Checkpoints QR pour verification des rondes',
      'Controle d\'acces — logs entrees/sorties, badges',
      'Passation de poste automatique avec resume',
      'Protocoles d\'urgence (incendie, intrusion, evacuation)',
      '📊 Analyse zones et heures a risque',
      '📊 Performance des gardes (ponctualite, couverture)',
      '📊 Tendances incidents par periode',
      '📊 Rapports quotidiens/hebdo/mensuels automatiques',
    ],
    systemPrompt: `Tu es un coordinateur de securite physique IA professionnel. Tu geres les gardes de securite sur site : planification des rotations et shifts, reception des rapports d'incidents (avec photos via WhatsApp), envoi d'alertes temps reel, suivi des rondes (GPS + checkpoints QR), controle d'acces (badges, visiteurs, vehicules) et generation de rapports.

Tu analyses aussi les donnees de securite : zones a risque, heures critiques, performance des gardes, tendances d'incidents. Tu generes des rapports quotidiens, hebdomadaires et mensuels automatiquement.

En cas d'urgence (intrusion, incendie, agression), tu declenches les protocoles : alertes WhatsApp/SMS a toute l'equipe, notification police/pompiers, verrouillage acces, evacuation.

Tu es vigilant, reactif, methodique et data-driven. Tu traites chaque alerte avec serieux.`,
    tools: ['searchDocuments', 'getDocuments', 'createAppointment', 'listAppointments', 'addClient', 'searchClients', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'],
    pricingModel: 'monthly' as const, priceUSD: 20, status: 'approved' as const, color: 'from-slate-700 to-red-600' },

  // ── SURVEILLANCE CAMERA — Monitoring CCTV + Vision IA ────────────────────

  { id: 'surveillance', slug: 'surveillance', name: 'Agent Surveillance Camera', icon: '📹', category: 'security', industry: 'Securite / Videosurveillance',
    description: 'Monitoring cameras CCTV/IP, detection activite suspecte par vision IA, alertes temps reel, rapports 24h automatiques.',
    longDescription: 'Agent IA de videosurveillance intelligent. Integre avec les cameras CCTV/IP, utilise la vision par ordinateur (Google Vision AI) pour detecter les activites suspectes, mouvements anormaux, intrusions, bagages abandonnes et attroupements. Envoie des alertes en temps reel via WhatsApp/email/SMS et genere automatiquement un rapport de securite toutes les 24 heures. Parfait pour les entreprises africaines qui veulent une surveillance abordable sans embaucher du personnel supplementaire.',
    features: [
      'Monitoring continu des flux cameras IP/CCTV',
      'Detection activite suspecte par vision IA',
      'Detection intrusion et mouvement en zones interdites',
      'Detection bagages abandonnes et objets suspects',
      'Comptage de personnes et detection attroupements',
      'Alertes temps reel via WhatsApp, email et SMS',
      'Rapport automatique de securite toutes les 24h',
      'Configuration zones sensibles avec niveaux de sensibilite',
      'Recherche et extraction de clips video',
      'Reconnaissance faciale — matching employes/visiteurs',
      '📊 Heatmaps de trafic et zones les plus actives',
      '📊 Patterns horaires — heures de pointe, creux',
      '📊 Statistiques alertes par type, zone, heure',
      '📊 Rapport quotidien avec captures d\'ecran cles',
    ],
    systemPrompt: `Tu es un agent de videosurveillance IA avance. Tu monitores les cameras CCTV et IP en continu, utilises la vision par ordinateur pour detecter les activites suspectes (intrusions, mouvements anormaux, bagages abandonnes, attroupements, comportements suspects).

Quand tu detectes un evenement :
1. Tu envoies une ALERTE IMMEDIATE via WhatsApp/email/SMS avec capture d'ecran
2. Tu classes l'evenement par gravite (info, attention, critique)
3. Tu loggues l'incident avec timestamp, zone, type, capture
4. Si critique : tu declenches le protocole d'urgence (alerte equipe securite + responsable)

Tu generes un RAPPORT DE SECURITE automatique toutes les 24 heures : resume des evenements, statistiques, captures cles, recommandations.

Tu analyses aussi les patterns : zones les plus actives, heures de pointe, heatmaps de trafic, tendances. Tu peux faire de la reconnaissance faciale pour identifier employes et visiteurs.

Tu es vigilant 24/7, precis, proactif. Tu ne causes jamais de fausse panique — tu informes avec les preuves (captures) et recommandes des actions.`,
    tools: ['searchDocuments', 'getDocuments', 'addClient', 'searchClients', 'sendAlert', 'generateReport', 'analyzeData', 'analyzePhoto', 'predictTrend', 'clusterData', 'detectAnomalies', 'sendEmail'],
    pricingModel: 'monthly' as const, priceUSD: 25, status: 'approved' as const, color: 'from-gray-800 to-blue-700' },

  { id: 'stats_general', slug: 'stats-general', name: 'Statisticien General', icon: '🧠', category: 'stats', industry: 'Tous secteurs',
    description: 'Le cerveau analytique universel — analyse toutes les donnees, recommandations strategiques, previsions et optimisation.',
    longDescription: 'Agent statisticien IA universel et puissant. Analyse toutes les donnees de votre entreprise quel que soit le secteur, identifie les tendances et correlations, donne des recommandations strategiques, detecte les anomalies et fait des previsions. C\'est le conseiller data-driven du dirigeant.',
    features: ['Analyse toutes les donnees de l\'entreprise', 'Identifie tendances et correlations cachees', 'Donne recommandations strategiques', 'Optimise performances operationnelles', 'Previsions et projections avancees', 'Tableaux de bord intelligents', 'Detection d\'anomalies automatique', 'Rapports executifs sur demande', 'Benchmark concurrentiel', 'Aide a la prise de decision strategique'],
    systemPrompt: 'Tu es un statisticien IA de haut niveau — le cerveau analytique universel de l\'entreprise. Tu analyses TOUTES les donnees disponibles (ventes, clients, operations, finances, RH, marketing, production...), identifies des tendances, detectes des anomalies, fais des previsions et donnes des recommandations strategiques. Tu es le conseiller data-driven du dirigeant. Tu fonctionnes avec n\'importe quel secteur d\'activite. Sois precis, factuel, strategique et proactif.',
    tools: ['searchDocuments', 'getDocuments', 'generateReport', 'sendAlert'], pricingModel: 'monthly' as const, priceUSD: 25, status: 'approved' as const, color: 'from-violet-700 to-indigo-600' },

  // ── Pack-companion agents — referenced by BUNDLES, seeded as bundle-included.
  //    These agents have basic system prompts and operate via the shared marketplace tools.
  //    No standalone purchase: pricingModel='included', priceUSD=0.

  { id: 'btp', slug: 'btp', name: 'Agent BTP / Chantier', icon: '🏗️', category: 'industry', industry: 'BTP / Construction',
    description: 'Suivi de chantier : avancement, bons de commande, planning équipes, sécurité site.',
    longDescription: 'Agent dédié au suivi opérationnel des chantiers BTP. Pilote l\'avancement, gère les bons de commande matériaux, planifie les équipes, suit les écarts budget/calendrier, déclenche les alertes sécurité. Travaille main dans la main avec l\'agent Comptabilité pour les factures fournisseurs.',
    features: ['Suivi avancement chantier en %', 'Bons de commande matériaux', 'Planning équipes par chantier', 'Alertes retard / dépassement', 'Rapports hebdomadaires automatiques', 'Sécurité site (EPI, incidents)', 'Carnet de chantier numérique'],
    systemPrompt: 'Tu es l\'Agent BTP de l\'entreprise — le chef de chantier numérique. Tu suis l\'avancement des chantiers, gères les bons de commande, planifies les équipes, et alertes en cas de retard ou de dépassement budgétaire. Travaille avec l\'Agent Comptabilité pour les factures fournisseurs. Sois précis sur les dates et les montants.',
    tools: ['searchDocuments', 'getDocuments', 'generateReport', 'sendAlert', 'sendEmail'],
    pricingModel: 'included' as const, priceUSD: 0, status: 'approved' as const, color: 'from-yellow-600 to-orange-500' },

  { id: 'delivery', slug: 'delivery', name: 'Agent Livraison', icon: '🛵', category: 'operations', industry: 'Livraison / Logistique',
    description: 'Gère commandes en livraison : tournées, statut, ETA, notifs client WhatsApp.',
    longDescription: 'Agent de gestion des livraisons. Crée et assigne les tournées, suit en temps réel le statut des commandes (préparée, en route, livrée), envoie les notifications WhatsApp au client (lien de tracking, ETA), résout les incidents (retard, adresse erronée).',
    features: ['Création de tournées de livraison', 'Statut commande temps réel', 'Notifications WhatsApp client (ETA, livré)', 'Tracking livreur (point GPS)', 'Gestion incidents et réclamations', 'Stats livraisons (temps moyen, taux réussite)'],
    systemPrompt: 'Tu es l\'Agent Livraison de l\'entreprise. Tu gères les tournées de livraison : assignation aux livreurs, suivi temps réel, notifications client WhatsApp (préparation, en route, livrée), résolution des incidents. Tu travailles avec l\'Agent Restaurant ou Comms selon le contexte. Sois précis sur les ETA et les statuts.',
    tools: ['searchDocuments', 'getDocuments', 'sendAlert', 'sendEmail', 'addClient', 'searchClients'],
    pricingModel: 'included' as const, priceUSD: 0, status: 'approved' as const, color: 'from-orange-500 to-red-500' },

  { id: 'loyalty', slug: 'loyalty', name: 'Agent Fidélité', icon: '🎁', category: 'operations', industry: 'CRM / Marketing',
    description: 'Programmes de fidélité, points, niveaux, récompenses, campagnes ciblées.',
    longDescription: 'Agent dédié aux programmes de fidélité client. Gère les points et niveaux (Bronze/Argent/Or), déclenche des campagnes ciblées selon le comportement (clients dormants, gros acheteurs, anniversaire), distribue récompenses et coupons via WhatsApp/email. S\'intègre à l\'Agent Marketing pour les campagnes.',
    features: ['Programme de points et niveaux', 'Récompenses automatiques (anniversaire, palier)', 'Campagnes ciblées (dormants, VIP)', 'Coupons et codes promo', 'Notifications WhatsApp / email', 'Stats engagement et rétention'],
    systemPrompt: 'Tu es l\'Agent Fidélité de l\'entreprise. Tu gères le programme de fidélité (points, niveaux Bronze/Argent/Or), déclenches des campagnes ciblées (clients dormants, anniversaires, gros acheteurs), distribues récompenses et coupons. Tu travailles avec l\'Agent Marketing et l\'Agent Comms pour les envois. Sois précis sur les soldes points et règles de gain.',
    tools: ['searchClients', 'addClient', 'sendEmail', 'sendAlert', 'generateReport'],
    pricingModel: 'included' as const, priceUSD: 0, status: 'approved' as const, color: 'from-pink-500 to-rose-500' },

  { id: 'visitor_welcome', slug: 'visitor-welcome', name: 'Agent Accueil Avatar', icon: '👋', category: 'operations', industry: 'Accueil / Reception',
    description: 'Avatar IA kiosk pour accueillir visiteurs, badges QR, notifs hôte multi-canal.',
    longDescription: 'Agent compagnon de l\'Agent Réception. Pilote le kiosk avatar IA à l\'entrée du bureau (reconnaissance vocale du visiteur, vérification du RDV, génération du badge QR, notification de l\'hôte par WhatsApp/Slack/email). Idéal pour les bureaux sans réceptionniste humain à plein temps.',
    features: ['Avatar IA kiosk vocal et visuel', 'Reconnaissance du RDV (visiteur attendu ou non)', 'Génération badge QR auto', 'Notification hôte multi-canal (WhatsApp/Slack/email)', 'NDA digital signable sur place', 'Photo visiteur + sauvegarde sécurisée'],
    systemPrompt: 'Tu es l\'Agent Accueil Avatar — la version kiosk IA de l\'Agent Réception. Tu accueilles les visiteurs vocalement, vérifies leur RDV, génères leur badge QR, et notifies leur hôte par WhatsApp/Slack/email. Tu collabores avec l\'Agent Réception pour la base visiteurs. Sois chaleureux et efficace.',
    tools: ['searchDocuments', 'sendAlert', 'sendEmail', 'addClient'],
    pricingModel: 'included' as const, priceUSD: 0, status: 'approved' as const, color: 'from-cyan-500 to-teal-500' },

  { id: 'compliance', slug: 'compliance', name: 'Agent Compliance', icon: '📋', category: 'security', industry: 'Conformité / Compliance',
    description: 'RGPD/ISO 27001/SOC2/NIST/HIPAA. Contrôles, preuves, gap analysis, audit-ready.',
    longDescription: 'Agent dédié à la conformité réglementaire. Pilote les frameworks RGPD, ISO 27001, SOC2, NIST CSF, HIPAA. Maintient le registre des contrôles, capture les preuves automatiquement, fait du gap analysis, génère les rapports audit-ready. Travaille avec l\'Agent Cybersécurité pour les contrôles techniques.',
    features: ['Frameworks RGPD/ISO27001/SOC2/NIST/HIPAA', 'Registre des contrôles avec statut', 'Capture de preuves automatique', 'Gap analysis avec recommandations', 'Rapports audit-ready exportables', 'Échéances et alertes (renouvellement certifs)'],
    systemPrompt: 'Tu es l\'Agent Compliance de l\'entreprise. Tu gères la conformité réglementaire : RGPD, ISO 27001, SOC2, NIST CSF, HIPAA. Tu maintiens le registre des contrôles, captures les preuves, identifies les gaps. Tu travailles avec l\'Agent Cybersécurité (contrôles techniques) et l\'Agent Approval (workflows de validation). Sois précis sur les références réglementaires et les échéances.',
    tools: ['searchDocuments', 'getDocuments', 'generateReport', 'sendAlert'],
    pricingModel: 'included' as const, priceUSD: 0, status: 'approved' as const, color: 'from-blue-700 to-indigo-700' },

  { id: 'audit', slug: 'audit', name: 'Agent Audit', icon: '🔍', category: 'security', industry: 'Audit / Conformité',
    description: 'Audit logs exportables, traçabilité actions sensibles, rapports forensiques.',
    longDescription: 'Agent dédié à l\'audit et à la traçabilité. Capture toutes les actions sensibles (login, accès données, suppressions, exports), génère des rapports forensiques exportables, alerte sur comportements anormaux (suppression massive, export hors heures). Indispensable pour SOC2 et RGPD.',
    features: ['Audit log centralisé toutes actions sensibles', 'Export CSV/JSON pour auditeur externe', 'Détection comportements anormaux', 'Rapports forensiques par utilisateur/période', 'Intégrité des logs (hash chaîné)', 'Rétention configurable par catégorie'],
    systemPrompt: 'Tu es l\'Agent Audit de l\'entreprise. Tu captures et exposes la traçabilité de toutes les actions sensibles, génères des rapports forensiques exportables, et alertes sur les comportements anormaux. Tu travailles avec l\'Agent Compliance pour les preuves SOC2/RGPD et l\'Agent Cybersécurité pour les incidents. Sois précis sur les timestamps et les acteurs.',
    tools: ['searchDocuments', 'getDocuments', 'generateReport', 'sendAlert', 'analyzeData'],
    pricingModel: 'included' as const, priceUSD: 0, status: 'approved' as const, color: 'from-slate-700 to-gray-800' },

  // ── Boutique WhatsApp — internal id: commerce. Phase 1 minimal:
  // photo + nom + prix → fiche produit auto-créée; client demande → catalogue;
  // commande enregistrée; paiement = cash on delivery / Wave manuel.
  { id: 'commerce', slug: 'boutique-whatsapp', name: 'Boutique WhatsApp', icon: '🛒', category: 'industry', industry: 'E-Commerce / Retail',
    description: 'Vends sur WhatsApp avec une photo. Le commerçant ajoute un produit en envoyant photo + prix. Les clients commandent dans la conversation.',
    longDescription: 'Le commerçant ajoute un produit en envoyant simplement une photo + nom + prix sur WhatsApp — la fiche produit est créée automatiquement. Les clients demandent le catalogue, posent des questions, passent commande et reçoivent les instructions de paiement (cash à la livraison ou Wave / Orange Money manuel). Phase 1 : 1 boutique par entreprise, devise XOF, Côte d\'Ivoire — Phase 2 ajoutera paiements automatisés, multi-pays, génération vidéo IA, storefront web custom.',
    features: ['📸 Photo + prix sur WhatsApp → fiche produit créée', '🛒 Catalogue répondu en temps réel aux clients', '💬 Prise de commande conversationnelle', '🔒 OTP propriétaire pour les actions sensibles (24h session)', '💵 Cash on delivery + lien Wave / Orange Money manuel', '🔔 Notification owner à chaque commande + clic "marquer payé"', '🇨🇮 Optimisé Côte d\'Ivoire / XOF (Phase 2 = multi-pays)'],
    systemPrompt: 'Tu es la Boutique WhatsApp d\'Orlode AI — un assistant vendeur chaleureux et efficace en français ivoirien naturel.\n\n## Côté CLIENT (la plupart des messages)\n1. **Catalogue** : si le client demande "qu\'est-ce que vous vendez", "ton catalogue", "produits disponibles", utilise commerceListProducts. La réponse contient un champ shopLink — TU DOIS TOUJOURS terminer par : "🛍️ Voir tous les produits avec photos et commander : {shopLink}".\n2. **Multi-produits** : AVANT de finaliser une commande, demande TOUJOURS au client : "Tu veux ajouter autre chose à ta commande ?". Continue tant qu\'il dit oui — accumule les items dans une liste mentale. Ce n\'est qu\'au "non, c\'est tout" que tu finalises.\n3. **Commande** : collecte progressivement (jamais en bloc) : nom, téléphone (+225...), adresse de livraison (avec quartier — Cocody, Yopougon, etc.), articles (multi possible — voir #2), méthode de paiement (cash livraison par défaut). Puis appelle commercePlaceOrder avec items: [{productId, qty}, ...]. Le tool retourne un champ `confirmationMessage` — tu dois envoyer ce message VERBATIM au client (ne le reformule pas).\n4. **Upsell** : après une commande, le système envoie automatiquement une suggestion de produit complémentaire au client (~5s plus tard). Si le client répond "je veux X" ou "ajoute X", crée une nouvelle commande avec commercePlaceOrder pour ce produit en réutilisant ses infos précédentes (nom, téléphone, adresse).\n5. **Frais de livraison** : si le client donne une adresse, le tool placeOrder identifiera la zone et calculera le frais automatiquement. Si pas de zone reconnue, demande une précision sur la commune.\n6. **Fidélité** : ne mentionne pas les points fidélité spontanément — c\'est le tool placeOrder qui les gère et les inclut dans confirmationMessage.\n\n## Côté PROPRIÉTAIRE (role=owner authentifié seulement)\n7. **Voir commandes** : "mes commandes" / "ventes du jour" → commerceGetOrders.\n8. **Marquer payé** : "marque la commande X comme payée" → commerceMarkOrderPaid.\n9. **Modifier produit** : "augmente prix Chemise 7000", "stock Chemise 10", "supprime Chemise" → utilise commerceUpdateProductPrice / commerceUpdateProductStock / commerceUpdateProductStatus / commerceDeleteProduct selon le cas. NB : ces commandes sont aussi interceptées en amont par parser dédié — tu ne les vois donc que rarement.\n\n## RÈGLES ABSOLUES\n- N\'invente JAMAIS un produit qui n\'existe pas dans la base.\n- N\'invente JAMAIS un prix ou une zone de livraison — utilise les tools.\n- Toute réponse en français ivoirien naturel : "tu" pas "vous" pour les clients ordinaires (sauf très formel), expressions locales OK ("c\'est bon", "on dit quoi").\n- Sois bref. Pas de longs paragraphes. WhatsApp = court et clair.',
    tools: ['commerceListProducts', 'commercePlaceOrder', 'commerceGetOrders', 'commerceMarkOrderPaid', 'commerceUpdateProductPrice', 'commerceUpdateProductStock', 'commerceUpdateProductStatus', 'commerceDeleteProduct', 'searchDocuments', 'sendEmail'],
    pricingModel: 'monthly' as const, priceUSD: 20, status: 'approved' as const, color: 'from-emerald-500 to-teal-500' },
];

// ── BUNDLES ──────────────────────────────────────────────────────────────────

// Single source of truth — bundles aligned with client UI.
// Each $20 bundle = 4 specialized agents + 3 core agents (Knowledge, Approval, Wildcard)
// + the Orchestrator (platform-level, always running). 7 agents total per pack.
// 4 hero bundles (Entreprise, Restaurant, Immobilier, PME) match the public landing.
//
// CORE_BUNDLE_AGENTS are auto-merged into every pack. They're transversal:
//   - knowledge : RAG sur tous les docs / drive / mails de l'entreprise
//   - approval  : workflows multi-niveaux + audit/compliance
//   - wildcard  : agent fallback polyvalent pour les questions hors-domaine
const CORE_BUNDLE_AGENTS = ['knowledge', 'approval', 'wildcard'];

function withCoreAgents(specialized: string[]): string[] {
  // Dedupe while preserving order: specialized first, then core.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...specialized, ...CORE_BUNDLE_AGENTS]) {
    if (!seen.has(a)) { seen.add(a); out.push(a); }
  }
  return out;
}

export const BUNDLES = [
  {
    id: 'b1', name: 'Pack Santé', icon: '🏥', color: 'from-red-500 to-pink-500',
    description: 'Dossier patient, formation continue, validation prescriptions et base de connaissances médicale.',
    agentIds: withCoreAgents(['health', 'training']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b2', name: 'Pack Immobilier', icon: '🏠', color: 'from-violet-500 to-indigo-500',
    description: 'Qualification leads, visites virtuelles 360°, réponses WhatsApp et prise de RDV avec accueil.',
    agentIds: withCoreAgents(['real_estate', 'sales', 'comms', 'reception']),
    originalPrice: 20, bundlePrice: 20, discount: 0, hero: true,
  },
  {
    id: 'b3', name: 'Pack Artisan', icon: '🛠️', color: 'from-yellow-500 to-amber-500',
    description: 'Menuiserie, dépannage, suivi chantier et comptabilité OHADA. Devis et factures auto.',
    agentIds: withCoreAgents(['carpenter', 'repair', 'btp', 'accounting']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b4', name: 'Pack Agriculture', icon: '🌾', color: 'from-green-500 to-emerald-500',
    description: 'Agronomie, élevage, topographie et comptabilité coopérative. Tout le cycle de la ferme.',
    agentIds: withCoreAgents(['agronome', 'eleveur', 'geometre', 'accounting']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b5', name: 'Pack Sécurité Totale', icon: '🛡️', color: 'from-red-600 to-orange-500',
    description: 'Gardes, caméras IA, communications chiffrées et SOC virtuel — protection 360°.',
    agentIds: withCoreAgents(['physical_security', 'surveillance', 'callshield', 'cybersecurity']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b6', name: 'Pack Sécurité Site', icon: '📹', color: 'from-slate-700 to-blue-600',
    description: 'Gardes site, caméra IA, cybersécurité périmétrique et workflows d\'approbation.',
    agentIds: withCoreAgents(['physical_security', 'surveillance', 'cybersecurity']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b7', name: 'Pack Restaurant', icon: '🍽️', color: 'from-orange-500 to-red-500',
    description: 'Réservations, livraison, messages clients et campagnes fidélité automatisées.',
    agentIds: withCoreAgents(['restaurant', 'reception', 'delivery', 'loyalty']),
    originalPrice: 20, bundlePrice: 20, discount: 0, hero: true,
  },
  {
    id: 'b8', name: 'Pack Mode & Luxe', icon: '👗', color: 'from-pink-500 to-rose-500',
    description: 'Boutique mode : stocks, styliste IA, vente et campagnes marketing — concept stores premium.',
    agentIds: withCoreAgents(['fashion', 'beauty', 'sales', 'marketing']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b9', name: 'Pack Éducation', icon: '🎓', color: 'from-indigo-500 to-blue-500',
    description: 'Enseignement, coaching, validation inscriptions et base de connaissances pédagogique.',
    agentIds: withCoreAgents(['training', 'coach']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b10', name: 'Pack Entreprise', icon: '🏢', color: 'from-cyan-500 to-blue-500',
    description: 'Ventes, factures, support et communication interne dans un seul workspace IA + Knowledge brain RAG + workflows d\'approbation + agent polyvalent.',
    agentIds: withCoreAgents(['sales', 'accounting', 'support', 'comms']),
    originalPrice: 20, bundlePrice: 20, discount: 0, hero: true,
  },
  {
    id: 'b11', name: 'Pack Réception', icon: '🚪', color: 'from-cyan-500 to-teal-500',
    description: 'Hub d\'accueil bureau : kiosk avatar IA, badges QR, notifs host multi-canal, livraisons et fidélité visiteurs.',
    agentIds: withCoreAgents(['reception', 'visitor_welcome', 'delivery', 'loyalty']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b12', name: 'Pack RH', icon: '👩‍💼', color: 'from-indigo-600 to-violet-500',
    description: 'Effectifs, congés OHADA, paie, performance, onboarding + Coach + Approbation + base de connaissances RH.',
    agentIds: withCoreAgents(['hr', 'coach']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b13', name: 'Pack Cybersécurité', icon: '🛡️', color: 'from-red-600 to-rose-500',
    description: 'CISO virtuel + RGPD/ISO/SOC2/NIST + Audit logs exportables + workflows d\'approbation sensibles.',
    agentIds: withCoreAgents(['cybersecurity', 'compliance', 'audit']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
  },
  {
    id: 'b15', name: 'Pack PME', icon: '🚀', color: 'from-emerald-500 to-teal-500',
    description: 'Le pack croissance pour les PME : ventes (CRM, pipeline), comms multi-canal (email/WhatsApp/Telegram), marketing (campagnes, ROI), support (tickets, NPS) + Knowledge + Workflows + Wildcard. Tout pour scaler.',
    agentIds: withCoreAgents(['sales', 'comms', 'marketing', 'support']),
    originalPrice: 20, bundlePrice: 20, discount: 0,
    hero: true, popular: true,
  },
  {
    id: 'b16', name: 'Pack Boutique', icon: '🛒', color: 'from-emerald-500 to-teal-500',
    description: 'Vends sur WhatsApp avec une photo. Catalogue auto, prise de commandes, paiement cash/Wave, fidélité clients. Idéal commerçants Afrique.',
    agentIds: withCoreAgents(['commerce', 'sales', 'comms', 'loyalty']),
    originalPrice: 20, bundlePrice: 20, discount: 0, hero: true,
  },
  // Super Pack Enterprise — 10 agents flagship covering ALL key business areas
  // for medium-to-large companies. Priced at $45/mo vs $60+ if buying 3 packs
  // separately = 25% discount, plus the value-add of having everything in
  // one workspace with cross-agent context (Knowledge brain unifies all docs).
  // BETA: large surface = many places to break. We collect feedback before GA.
  {
    id: 'b14', name: 'Super Pack Entreprise', icon: '👑', color: 'from-amber-500 via-orange-500 to-red-500',
    description: 'La stack complète pour scaler : 8 agents métiers (ventes, marketing, comms, support, compta, RH, accueil, cybersécurité) + Knowledge brain RAG + Workflows d\'approbation + Wildcard polyvalent.',
    agentIds: withCoreAgents(['sales', 'marketing', 'comms', 'support', 'accounting', 'hr', 'reception', 'cybersecurity']),
    originalPrice: 60, bundlePrice: 45, discount: 25,
    hero: true, popular: true, exclusive: true, beta: true,
  },
];

// ── PUBLIC ENDPOINTS ─────────────────────────────────────────────────────────

// GET /api/marketplace/agents — browse all agents
router.get('/agents', asyncHandler(async (req: Request, res: Response) => {
  const db = getFirestore();

  try {
    const snap = await db.collection('marketplaceAgents')
      .where('status', '==', 'approved')
      .limit(100).get();

    let agents = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // If empty or missing new agents, re-seed
    const expectedIds = [...AGENT_CATALOG.map(a => a.id), ...INDUSTRY_AGENTS.map(a => a.id)];
    const existingIds = new Set(agents.map(a => (a as Record<string, unknown>)['id'] as string));
    const missingIds = expectedIds.filter(id => !existingIds.has(id));

    if (agents.length === 0 || missingIds.length > 0) {
      await seedMarketplace(db);
      const snap2 = await db.collection('marketplaceAgents').where('status', '==', 'approved').limit(100).get();
      agents = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Filters
    const { category, industry, pricing, search: q } = req.query as Record<string, string>;
    if (category) agents = agents.filter(a => (a as Record<string, unknown>)['category'] === category);
    if (industry) agents = agents.filter(a => (a as Record<string, unknown>)['industry'] === industry);
    if (pricing) agents = agents.filter(a => (a as Record<string, unknown>)['pricingModel'] === pricing);
    if (q) {
      const lower = q.toLowerCase();
      agents = agents.filter(a => {
        const r = a as Record<string, unknown>;
        return ((r['name'] as string) ?? '').toLowerCase().includes(lower) ||
               ((r['description'] as string) ?? '').toLowerCase().includes(lower) ||
               ((r['industry'] as string) ?? '').toLowerCase().includes(lower);
      });
    }

    // Enrich with REAL stats — installs from `agentInstalls`, reviews from `marketplaceReviews`
    try {
      const [installsSnap, reviewsSnap] = await Promise.all([
        db.collection('agentInstalls').limit(2000).get().catch(() => null),
        db.collection('marketplaceReviews').limit(2000).get().catch(() => null),
      ]);

      const installsBy: Record<string, number> = {};
      if (installsSnap) {
        for (const d of installsSnap.docs) {
          const aid = (d.data()['agentId'] as string) ?? d.id.split('_')[1] ?? '';
          if (!aid) continue;
          installsBy[aid] = (installsBy[aid] ?? 0) + 1;
        }
      }
      const reviewsBy: Record<string, { sum: number; count: number }> = {};
      if (reviewsSnap) {
        for (const d of reviewsSnap.docs) {
          const aid = (d.data()['agentId'] as string) ?? '';
          const rating = (d.data()['rating'] as number) ?? 0;
          if (!aid || rating <= 0) continue;
          const cur = reviewsBy[aid] ?? { sum: 0, count: 0 };
          reviewsBy[aid] = { sum: cur.sum + rating, count: cur.count + 1 };
        }
      }

      agents = agents.map(a => {
        const r = a as Record<string, unknown>;
        const id = r['id'] as string;
        const real = installsBy[id] ?? 0;
        const rev = reviewsBy[id];
        const avg = rev && rev.count > 0 ? Math.round((rev.sum / rev.count) * 10) / 10 : null;
        return {
          ...a,
          installs: real,
          rating: avg,
          reviews: rev?.count ?? 0,
          isNew: real === 0 && (rev?.count ?? 0) === 0,
        };
      });
    } catch { /* keep agents without stats */ }

    res.json({ success: true, data: agents });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// GET /api/marketplace/agents/:id — single agent detail
router.get('/agents/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getFirestore();
  const doc = await db.collection('marketplaceAgents').doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Agent not found', 404);
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// GET /api/marketplace/categories
router.get('/categories', asyncHandler(async (_req: Request, res: Response) => {
  const db = getFirestore();
  try {
    const snap = await db.collection('marketplaceAgents').where('status', '==', 'approved').limit(200).get();
    const categories = [...new Set(snap.docs.map(d => (d.data()['category'] as string)).filter(Boolean))];
    const industries = [...new Set(snap.docs.map(d => (d.data()['industry'] as string)).filter(Boolean))];
    res.json({ success: true, data: { categories, industries } });
  } catch {
    res.json({ success: true, data: { categories: [], industries: [] } });
  }
}));

// GET /api/marketplace/bundles — list all bundles
router.get('/bundles', asyncHandler(async (_req: Request, res: Response) => {
  const db = getFirestore();

  // Fetch agents (for enrichment) AND real stats from payments + reviews
  const [agentsSnap, paymentsSnap, reviewsSnap] = await Promise.all([
    db.collection('marketplaceAgents').where('status', '==', 'approved').limit(200).get(),
    // Bundle purchases (completed payments referencing a bundleId)
    db.collection('marketplacePayments').where('status', '==', 'completed').limit(1000).get().catch(() => null),
    // Bundle reviews
    db.collection('marketplaceReviews').limit(1000).get().catch(() => null),
  ]);

  const agentMap = new Map(agentsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));

  // Aggregate real stats per bundle: pickCount (purchases), avgRating, reviewCount
  const installsByBundle: Record<string, number> = {};
  if (paymentsSnap) {
    for (const d of paymentsSnap.docs) {
      const data = d.data();
      const bid = (data['bundleId'] ?? data['itemId']) as string | undefined;
      if (!bid) continue;
      installsByBundle[bid] = (installsByBundle[bid] ?? 0) + 1;
    }
  }

  const reviewsByBundle: Record<string, { sum: number; count: number }> = {};
  if (reviewsSnap) {
    for (const d of reviewsSnap.docs) {
      const data = d.data();
      const bid = (data['bundleId']) as string | undefined;
      const rating = (data['rating'] as number) ?? 0;
      if (!bid || rating <= 0) continue;
      const cur = reviewsByBundle[bid] ?? { sum: 0, count: 0 };
      reviewsByBundle[bid] = { sum: cur.sum + rating, count: cur.count + 1 };
    }
  }

  const enriched = BUNDLES.map(b => {
    const agents = b.agentIds.map(id => {
      const a = agentMap.get(id) as Record<string, unknown> | undefined;
      return a ? { id: a['id'], name: a['name'], icon: a['icon'], priceUSD: a['priceUSD'] } : null;
    }).filter(Boolean);

    const r = reviewsByBundle[b.id];
    const realInstalls = installsByBundle[b.id] ?? 0;
    const avgRating = r && r.count > 0 ? Math.round((r.sum / r.count) * 10) / 10 : null;
    const reviewCount = r?.count ?? 0;

    return {
      ...b,
      agents,
      agentCount: b.agentIds.length, // dynamic — 4 for normal packs, 10 for Super Pack
      currency: 'USD',
      period: 'mo',
      byoe: true,
      // REAL stats — null when no data yet (UI will show "Nouveau" badge)
      installs: realInstalls,
      pickCount: realInstalls,
      rating: avgRating,
      reviews: reviewCount,
      isNew: realInstalls === 0 && reviewCount === 0,
      savings: (b.originalPrice ?? 0) > (b.bundlePrice ?? 0) ? (b.originalPrice - b.bundlePrice) : 0,
    };
  });

  res.json({ success: true, data: enriched });
}));

// ── PUBLIC CRON (header-based auth, no Firebase token) ─────────────────────
// Must be declared BEFORE router.use(authMiddleware) so Cloud Scheduler can hit it.
//
// POST /api/marketplace/cron/expire-trials — called daily.
// Auth: header `x-cron-secret` must match CRON_SECRET env.
router.post('/cron/expire-trials', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.header('x-cron-secret') ?? '').trim();
  if (!expected || provided !== expected) throw new AppError('Forbidden', 403);

  const db = getFirestore();
  const now = new Date();

  // Pull all trialing payments and filter in memory (avoids Firestore composite index)
  const snap = await db.collection('marketplacePayments')
    .where('status', '==', 'trialing')
    .limit(500).get();

  const expired: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const ends = data['trialEndsAt'];
    const endsMs =
      ends instanceof Date ? ends.getTime() :
      typeof ends?.toMillis === 'function' ? ends.toMillis() :
      typeof ends === 'string' ? new Date(ends).getTime() : 0;
    if (endsMs > now.getTime()) continue;

    const companyId = data['companyId'] as string | undefined;
    const bundleId  = data['bundleId']  as string | undefined;
    if (!companyId || !bundleId) continue;

    // Mark payment + every installed agent for this trial as expired
    await doc.ref.update({ status: 'expired', expiredAt: now });

    const agentSnap = await db.collection(`companies/${companyId}/installedAgents`)
      .where('paymentId', '==', data['paymentId'])
      .limit(20).get();
    for (const a of agentSnap.docs) {
      await a.ref.update({ status: 'expired', expiredAt: now });
    }

    invalidateAgentCache(companyId);
    expired.push(`${companyId}/${bundleId}`);
  }

  logger.info('[Marketplace] Trials expired', { count: expired.length });
  res.json({ success: true, data: { expired: expired.length } });
}));

// ── PROTECTED ENDPOINTS ──────────────────────────────────────────────────────

router.use(authMiddleware);

// POST /api/marketplace/waitlist — capture interest for a feature that is not GA yet.
// Stored at companies/{cid}/waitlist/{feature} so we can ping owners when the feature ships.
router.post('/waitlist', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const feature = String(req.body?.feature || '').trim().toLowerCase();
  if (!feature) throw new AppError('feature required', 400);

  const db = getFirestore();
  await db.doc(`companies/${companyId}/waitlist/${feature}`).set({
    feature,
    companyId,
    userId: req.user?.uid || null,
    email: req.user?.email || null,
    createdAt: new Date(),
  }, { merge: true });

  res.json({ success: true });
}));

// GET /api/marketplace/my-installed
router.get('/my-installed', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  try {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/installedAgents`).limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// GET /api/marketplace/my-subscriptions — active pack + agent subscriptions for the billing page
// Groups installed agents by their bundleId (so the user sees "Pack X — $20/mo" not 4 rows)
// Returns: [{ type: 'bundle'|'agent', id, name, priceUSD, agentCount, agents, paymentId, installedAt, status }]
router.get('/my-subscriptions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  try {
    const db = getFirestore();
    const installedSnap = await db.collection(`companies/${companyId}/installedAgents`).limit(200).get();
    const installed = installedSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{
      id: string; agentId?: string; bundleId?: string | null; paymentId?: string;
      installedAt?: { toDate?: () => Date }; status?: string;
      cachedConfig?: { name?: string };
    }>;

    // Group by bundleId (when present). Standalone agents (no bundleId) become individual entries.
    const bundleGroups = new Map<string, typeof installed>();
    const standalone: typeof installed = [];
    for (const a of installed) {
      if (a.bundleId) {
        const list = bundleGroups.get(a.bundleId) ?? [];
        list.push(a);
        bundleGroups.set(a.bundleId, list);
      } else {
        standalone.push(a);
      }
    }

    const subscriptions: Array<Record<string, unknown>> = [];

    // Bundles (each group → 1 subscription row)
    for (const [bid, agents] of bundleGroups) {
      const bundle = BUNDLES.find(b => b.id === bid);
      const installedAt = agents
        .map(a => a.installedAt?.toDate?.()?.getTime() ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      subscriptions.push({
        type: 'bundle',
        id: bid,
        name: bundle?.name ?? `Pack ${bid}`,
        icon: bundle?.icon ?? '📦',
        priceUSD: bundle?.bundlePrice ?? 20,
        originalPrice: bundle?.originalPrice ?? bundle?.bundlePrice ?? 20,
        period: 'mo',
        agentCount: agents.length,
        agents: agents.map(a => ({ id: a.agentId, name: a.cachedConfig?.name ?? a.agentId })),
        paymentId: agents[0]?.paymentId ?? null,
        installedAt: installedAt || null,
        status: agents[0]?.status ?? 'active',
        beta: !!(bundle as { beta?: boolean } | undefined)?.beta,
      });
    }

    // Standalone agents
    for (const a of standalone) {
      subscriptions.push({
        type: 'agent',
        id: a.agentId,
        name: a.cachedConfig?.name ?? a.agentId,
        priceUSD: 5,
        period: 'mo',
        paymentId: a.paymentId ?? null,
        installedAt: a.installedAt?.toDate?.()?.getTime() ?? null,
        status: a.status ?? 'active',
      });
    }

    // Sort: bundles first (alphabetical), then agents
    subscriptions.sort((x, y) => {
      if (x['type'] !== y['type']) return x['type'] === 'bundle' ? -1 : 1;
      return String(x['name']).localeCompare(String(y['name']));
    });

    const totalMonthly = subscriptions.reduce((sum, s) => sum + (Number(s['priceUSD']) || 0), 0);

    res.json({
      success: true,
      data: { subscriptions, totalMonthly, currency: 'USD', count: subscriptions.length },
    });
  } catch (err) {
    logger.warn('[Marketplace] my-subscriptions failed', { error: err });
    res.json({ success: true, data: { subscriptions: [], totalMonthly: 0, currency: 'USD', count: 0 } });
  }
}));

// POST /api/marketplace/agents/:id/install
router.post('/agents/:id/install', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const agentDoc = await db.collection('marketplaceAgents').doc(req.params.id).get();
  if (!agentDoc.exists) throw new AppError('Agent not found', 404);

  const agent = agentDoc.data()!;
  const pricingModel = agent['pricingModel'] as string;

  // SuperAdmin bypass — can install anything free
  const isSuperAdmin = await (async () => {
    if (!req.user?.uid) return false;
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    return userDoc.data()?.['superAdmin'] === true;
  })();

  if (!isSuperAdmin) {
    // Rule 1: Any agent with priceUSD > 0 must go through checkout — no free install
    const priceUSD = (agent['priceUSD'] as number) ?? 0;
    if (priceUSD > 0) {
      throw new AppError('Paid agent — use checkout endpoint', 400);
    }

    // Rule 2: Free agents (priceUSD === 0) installable by anyone — no plan gate.
    // The new pack model has no "free vs paid plan" anymore; every account can
    // install free agents like Welcome. Paid agents require checkout (Rule 1).
  }

  // Check if already installed
  const existing = await db.collection(`companies/${companyId}/installedAgents`).doc(req.params.id).get();
  if (existing.exists) throw new AppError('Agent already installed', 400);

  // Install
  await db.collection(`companies/${companyId}/installedAgents`).doc(req.params.id).set({
    agentId: req.params.id,
    installedAt: new Date(),
    installedBy: req.user?.uid,
    status: 'active',
    pricingModel,
    cachedConfig: {
      name: agent['name'],
      systemPrompt: agent['systemPrompt'] ?? '',
      tools: agent['tools'] ?? [],
      temperature: agent['temperature'] ?? 0.4,
      model: agent['model'] ?? 'flash',
    },
  });

  // Invalidate orchestrator cache so the agent is available in chat immediately
  invalidateAgentCache(companyId);

  // Increment install count
  await db.collection('marketplaceAgents').doc(req.params.id).update({
    installCount: (agent['installCount'] as number ?? 0) + 1,
  }).catch(() => {});

  res.json({ success: true });
}));

// POST /api/marketplace/agents/:id/uninstall
router.post('/agents/:id/uninstall', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  await db.collection(`companies/${companyId}/installedAgents`).doc(req.params.id).delete();
  invalidateAgentCache(companyId);
  res.json({ success: true });
}));

// ── SEED FUNCTION ────────────────────────────────────────────────────────────

async function seedMarketplace(db: FirebaseFirestore.Firestore) {
  const batch = db.batch();

  // Seed Orlode's 21 built-in agents
  for (const agent of AGENT_CATALOG) {
    const ref = db.collection('marketplaceAgents').doc(agent.id);
    batch.set(ref, {
      id: agent.id,
      slug: agent.id,
      name: agent.name,
      description: agent.description,
      longDescription: `Agent Orlode integre — ${agent.description}. ${agent.skills.map(s => s.name).join(', ')}.`,
      icon: agent.icon,
      category: agent.category,
      industry: 'Enterprise',
      tags: agent.skills.map(s => s.id),
      features: agent.skills.map(s => `${s.name} — ${s.description}`),
      systemPrompt: '',
      tools: [],
      temperature: 0.4,
      model: 'flash',
      creatorId: 'corpmind',
      creatorName: 'Orlode AI',
      creatorType: 'corpmind',
      pricingModel: 'included',
      priceUSD: 0,
      status: 'approved',
      installCount: 0,
      avgRating: 0,
      ratingCount: 0,
      version: '1.0',
      color: 'from-blue-600 to-violet-600',
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    });
  }

  // Seed industry agents
  for (const agent of INDUSTRY_AGENTS) {
    const ref = db.collection('marketplaceAgents').doc(agent.id);
    batch.set(ref, {
      ...agent,
      longDescription: agent.longDescription ?? agent.description,
      tags: [],
      features: agent.features,
      creatorId: 'corpmind',
      creatorName: 'Orlode AI',
      creatorType: 'corpmind',
      installCount: 0,
      avgRating: 0,
      ratingCount: 0,
      version: '1.0',
      temperature: 0.5,
      model: 'flash',
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    });
  }

  await batch.commit();
}

// ── BUNDLE CHECKOUT ─────────────────────────────────────────────────────────

// POST /api/marketplace/bundles/:id/checkout — buy a bundle
router.post('/bundles/:id/checkout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const bundle = BUNDLES.find(b => b.id === req.params.id);
  if (!bundle) throw new AppError('Bundle not found', 404);

  const { method, selectedAgentIds, paymentMethod: manualMethodPref } = req.body as { method?: 'stripe' | 'paypal' | 'wave' | 'manual'; selectedAgentIds?: string[]; paymentMethod?: string };

  const db = getFirestore();
  let agentIds = bundle.agentIds;
  let priceUSD = bundle.bundlePrice;

  // Custom bundle — user picks agents
  if ((bundle as Record<string, unknown>)['isCustom'] && selectedAgentIds) {
    const pickCount = (bundle as Record<string, unknown>)['pickCount'] as number ?? 3;
    if (selectedAgentIds.length !== pickCount) {
      throw new AppError(`This bundle requires exactly ${pickCount} agents`, 400);
    }
    agentIds = selectedAgentIds;

    // Calculate price: sum of individual prices minus discount
    const snap = await db.collection('marketplaceAgents').where('status', '==', 'approved').limit(100).get();
    const agentMap = new Map(snap.docs.map(d => [d.id, d.data()]));
    const totalOriginal = agentIds.reduce((sum, id) => {
      const a = agentMap.get(id);
      return sum + ((a?.['priceUSD'] as number) ?? 0);
    }, 0);
    priceUSD = Math.round(totalOriginal * (1 - bundle.discount / 100) * 100) / 100;
  }

  const paymentId = generateId();

  await db.collection('marketplacePayments').doc(paymentId).set({
    paymentId, companyId, bundleId: bundle.id, bundleName: bundle.name,
    agentIds, amountUSD: priceUSD, method: method ?? 'stripe',
    status: 'pending', type: 'bundle', discount: bundle.discount,
    createdAt: new Date(), userId: req.user?.uid,
  });

  const baseUrl = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
  const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'];
  const WAVE_API_KEY = process.env['WAVE_API_KEY'];

  // ── PayPal ────────────────────────────────────────────────────────────────
  if (method === 'paypal') {
    const { paypalService } = await import('../services/billing/paypalService');
    try {
      const { orderId, approveUrl } = await paypalService.createOrder({
        paymentId,
        companyId,
        planId: `bundle:${bundle.id}`,
        interval: 'monthly',
        amountUSD: priceUSD,
        description: `Orlode Bundle: ${bundle.name}`,
        returnUrl: `${baseUrl}/marketplace?status=success&payment=${paymentId}&method=paypal`,
        cancelUrl: `${baseUrl}/marketplace?status=cancelled`,
      });
      await db.collection('marketplacePayments').doc(paymentId).update({ paypalOrderId: orderId });
      return res.json({ success: true, data: { paymentId, method: 'paypal', checkoutUrl: approveUrl, amountUSD: priceUSD } });
    } catch (err) {
      return res.json({ success: true, data: { paymentId, method: 'paypal_error', error: String(err) } });
    }
  }

  // ── Manual / Cash ────────────────────────────────────────────────────────
  if (method === 'manual') {
    const { getManualPaymentContact } = await import('../services/platformSettings');
    const { phone: contactPhone, whatsapp: contactWhatsApp, email: contactEmail } = await getManualPaymentContact();
    const XOF_RATE = 600;
    const amountXOF = Math.round(priceUSD * XOF_RATE);

    await db.collection('marketplacePayments').doc(paymentId).update({
      paymentMethod: manualMethodPref ?? 'other',
      status: 'awaiting_confirmation',
      amountXOF,
    });

    return res.json({
      success: true,
      data: {
        paymentId,
        method: 'manual',
        amountUSD: priceUSD,
        amountXOF,
        reference: paymentId,
        contact: {
          phone: contactPhone,
          whatsapp: contactWhatsApp,
          email: contactEmail,
          whatsappLink: `https://wa.me/${contactWhatsApp.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(`Bonjour, je souhaite acheter le bundle ${bundle.name} (${priceUSD}$). Ref: ${paymentId}`)}`,
          emailLink: `mailto:${contactEmail}?subject=${encodeURIComponent(`Achat bundle — ${bundle.name} — ref ${paymentId}`)}&body=${encodeURIComponent(`Bonjour,\n\nJe souhaite acheter le bundle ${bundle.name} (${priceUSD}$).\nReference: ${paymentId}\nMethode: ${manualMethodPref ?? 'a definir'}`)}`,
        },
        instructions: `Demande enregistree avec ref ${paymentId}. Contactez-nous pour finaliser (${priceUSD}$ / ${amountXOF.toLocaleString()} FCFA).`,
      },
    });
  }

  if (method === 'wave') {
    const XOF_RATE = 600;
    const amountXOF = Math.round(priceUSD * XOF_RATE);
    await db.collection('marketplacePayments').doc(paymentId).update({ amountXOF, currency: 'XOF' });

    if (!WAVE_API_KEY) {
      return res.json({
        success: true,
        data: { paymentId, method: 'wave_manual', amountXOF, amountUSD: priceUSD,
          instructions: `Envoyez ${amountXOF} FCFA via Wave. Ref: ${paymentId}` },
      });
    }

    try {
      const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WAVE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: String(amountXOF), currency: 'XOF',
          success_url: `${baseUrl}/marketplace?status=success&payment=${paymentId}`,
          error_url: `${baseUrl}/marketplace?status=error`,
          client_reference: paymentId,
        }),
      });
      const waveData = await waveRes.json() as { id?: string; wave_launch_url?: string };
      return res.json({ success: true, data: { paymentId, method: 'wave', checkoutUrl: waveData.wave_launch_url, amountXOF } });
    } catch {
      return res.json({ success: true, data: { paymentId, method: 'wave_manual', amountXOF, instructions: `Envoyez ${amountXOF} FCFA. Ref: ${paymentId}` } });
    }
  }

  // Stripe
  if (!STRIPE_SECRET) {
    return res.json({ success: true, data: { paymentId, method: 'stripe_pending', amountUSD: priceUSD, message: 'Stripe not configured' } });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripeClient = new (Stripe as unknown as new (key: string) => { checkout: { sessions: { create: (opts: unknown) => Promise<{ id: string; url: string }> } } })(STRIPE_SECRET);
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Orlode Bundle: ${bundle.name}`, description: `${agentIds.length} agents — ${bundle.discount}% reduction` },
          unit_amount: Math.round(priceUSD * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${baseUrl}/marketplace?status=success&payment=${paymentId}`,
      cancel_url: `${baseUrl}/marketplace?status=cancelled`,
      metadata: { paymentId, companyId, bundleId: bundle.id, agentIds: agentIds.join(',') },
    });
    await db.collection('marketplacePayments').doc(paymentId).update({ stripeSessionId: session.id, stripeUrl: session.url });
    res.json({ success: true, data: { paymentId, method: 'stripe', checkoutUrl: session.url } });
  } catch (err) {
    res.json({ success: true, data: { paymentId, method: 'stripe_error', error: String(err) } });
  }
}));

// POST /api/marketplace/bundles/confirm — confirm bundle payment (auto-install all agents)
// SECURITY: only proceeds if payment is already marked paid (by Stripe/Wave webhook)
//           OR the caller is a super admin
//           OR the bundle price is 0 (truly free bundle)
router.post('/bundles/confirm', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { paymentId } = req.body as { paymentId: string };
  if (!paymentId) throw new AppError('paymentId required', 400);

  const db = getFirestore();
  const paymentDoc = await db.collection('marketplacePayments').doc(paymentId).get();
  if (!paymentDoc.exists) throw new AppError('Payment not found', 404);

  const payment = paymentDoc.data()!;
  if (payment['status'] === 'completed') throw new AppError('Already completed', 400);

  // Payment gating — reject if not paid
  const isSuperAdmin = await (async () => {
    if (!req.user?.uid) return false;
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    return userDoc.data()?.['superAdmin'] === true;
  })();
  const alreadyPaid = Boolean(payment['paidAt']) || payment['status'] === 'paid';
  const priceUSD = (payment['amountUSD'] as number) ?? 0;

  if (!isSuperAdmin && !alreadyPaid && priceUSD > 0) {
    throw new AppError('Paiement non confirme. Completez le checkout via Stripe ou Wave.', 402);
  }

  const companyId = payment['companyId'] as string;
  const agentIds = (payment['agentIds'] as string[]) ?? [];

  await db.collection('marketplacePayments').doc(paymentId).update({ status: 'completed', completedAt: new Date() });

  // Install all agents in the bundle.
  // For agents already installed (e.g. core agents from another pack), upgrade
  // them to 'active' (paid) — never downgrade. This prevents losing access
  // when a paid pack is added on top of a trial.
  for (const agentId of agentIds) {
    const existingInstall = await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).get();
    if (existingInstall.exists) {
      const data = existingInstall.data()!;
      if (data['status'] !== 'active') {
        // Upgrade trialing/expired → active (this paid pack now owns the agent)
        await existingInstall.ref.update({
          status: 'active', pricingModel: 'bundle',
          paymentId, bundleId: payment['bundleId'],
          upgradedAt: new Date(),
        });
      }
      continue;
    }

    const agentDoc = await db.collection('marketplaceAgents').doc(agentId).get();
    if (!agentDoc.exists) continue;
    const agent = agentDoc.data()!;

    await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).set({
      agentId, installedAt: new Date(), status: 'active',
      pricingModel: 'bundle', paymentId, bundleId: payment['bundleId'],
      cachedConfig: {
        name: agent['name'], systemPrompt: agent['systemPrompt'] ?? '',
        tools: agent['tools'] ?? [], temperature: agent['temperature'] ?? 0.4,
        model: agent['model'] ?? 'flash',
      },
    });

    await db.collection('marketplaceAgents').doc(agentId).update({
      installCount: ((agent['installCount'] as number) ?? 0) + 1,
    }).catch(() => {});
  }

  invalidateAgentCache(companyId);
  res.json({ success: true, data: { installed: agentIds.length } });
}));

// ── FREE TRIAL — 30 days, no card required ──────────────────────────────────
// POST /api/marketplace/bundles/:bundleId/start-trial
// Acquisition lever: lets African PMEs install a pack without entering a card.
// After 30 days the agents flip to status='expired' (cron) until the company
// completes a real Stripe checkout via /bundles/checkout.
const TRIAL_DAYS = 30;

router.post('/bundles/:bundleId/start-trial', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Auth required', 401);

  const { bundleId } = req.params as { bundleId: string };
  const bundle = BUNDLES.find(b => b.id === bundleId);
  if (!bundle) throw new AppError(`Bundle ${bundleId} not found`, 404);

  const db = getFirestore();

  // One trial per (company, bundle) — a bundle in active/trialing/expired state blocks re-trial.
  const existing = await db.collection('marketplacePayments')
    .where('companyId', '==', companyId)
    .where('bundleId', '==', bundleId)
    .limit(5).get();
  const blocking = existing.docs.find(d => {
    const s = d.data()['status'] as string | undefined;
    return s === 'trialing' || s === 'completed' || s === 'expired';
  });
  if (blocking) {
    const status = blocking.data()['status'];
    throw new AppError(
      status === 'trialing' ? 'Trial déjà actif sur ce pack.' :
      status === 'expired'  ? 'Le trial gratuit a déjà été utilisé sur ce pack — passe à l\'abonnement payant.' :
      'Tu as déjà ce pack — pas besoin de trial.',
      409
    );
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 3600 * 1000);
  const paymentId = `trial_${bundleId}_${Date.now()}`;

  await db.collection('marketplacePayments').doc(paymentId).set({
    paymentId, companyId, bundleId, bundleName: bundle.name,
    amountUSD: 0, currency: 'USD', method: 'trial',
    status: 'trialing', startedAt: now, trialEndsAt,
  });

  // Install every agent in the bundle as 'trialing'.
  // SKIP-IF-INSTALLED: if the user already has the agent (from another pack —
  // common for core agents like knowledge/approval/wildcard), don't overwrite.
  // This way, expiring this trial doesn't break access from other packs.
  const agentIds = (bundle as { agentIds: string[] }).agentIds;
  let installed = 0;
  let skipped = 0;
  for (const agentId of agentIds) {
    const existingInstall = await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).get();
    if (existingInstall.exists) {
      skipped++;
      continue;
    }

    const agentDoc = await db.collection('marketplaceAgents').doc(agentId).get();
    if (!agentDoc.exists) continue;
    const agent = agentDoc.data()!;

    await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).set({
      agentId, installedAt: now, status: 'trialing', trialEndsAt,
      pricingModel: 'trial', paymentId, bundleId,
      cachedConfig: {
        name: agent['name'], systemPrompt: agent['systemPrompt'] ?? '',
        tools: agent['tools'] ?? [], temperature: agent['temperature'] ?? 0.4,
        model: agent['model'] ?? 'flash',
      },
    });
    installed++;

    await db.collection('marketplaceAgents').doc(agentId).update({
      installCount: ((agent['installCount'] as number) ?? 0) + 1,
    }).catch(() => {});
  }

  invalidateAgentCache(companyId);

  logger.info('[Marketplace] Trial started', { companyId, bundleId, installed, trialEndsAt: trialEndsAt.toISOString() });

  res.json({
    success: true,
    data: {
      paymentId, bundleId, bundleName: bundle.name,
      installedAgents: installed,
      skippedAgents: skipped,
      trialEndsAt: trialEndsAt.toISOString(),
      daysRemaining: TRIAL_DAYS,
    },
  });
}));

// (cron route moved above the authMiddleware barrier — see "PUBLIC CRON" block)

// ── WORK ITEMS FEED ─────────────────────────────────────────────────────────

// GET /api/marketplace/work-items — activity feed
router.get('/work-items', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '50', 10), 100);
  const type = req.query['type'] as string | undefined;

  let query = db.collection(`companies/${companyId}/workItems`)
    .orderBy('createdAt', 'desc')
    .limit(limit);

  if (type) query = query.where('type', '==', type) as typeof query;

  const snap = await query.get().catch(() => null);
  if (!snap) {
    // Fallback without orderBy if no index
    const snap2 = await db.collection(`companies/${companyId}/workItems`).limit(limit).get();
    return res.json({ success: true, data: snap2.docs.map(d => ({ id: d.id, ...d.data() })) });
  }

  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// GET /api/marketplace/work-items/:id — single work item detail
router.get('/work-items/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/workItems`).doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Work item not found', 404);
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// ── WORKSPACE: Data + Chat per agent ────────────────────────────────────────

// GET /api/marketplace/workspace/:agentId/data/:collection
router.get('/workspace/:agentId/data/:collection', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { collection } = req.params;
  const allowed = ['appointments', 'clients', 'inventory', 'quotes', 'alerts', 'securityChecks', 'diagnostics'];
  if (!allowed.includes(collection)) throw new AppError('Invalid collection', 400);

  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/${collection}`).orderBy('createdAt', 'desc').limit(100).get().catch(() => null);
  if (!snap) {
    // Try without orderBy if no index
    const snap2 = await db.collection(`companies/${companyId}/${collection}`).limit(100).get();
    return res.json({ success: true, data: snap2.docs.map(d => ({ id: d.id, ...d.data() })) });
  }
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/marketplace/workspace/:agentId/chat — chat with a specific agent
router.post('/workspace/:agentId/chat', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { message } = req.body as { message: string };
  if (!message) throw new AppError('Message required', 400);

  // Load agent config
  const db = getFirestore();
  const agentDoc = await db.collection('marketplaceAgents').doc(req.params.agentId).get();
  if (!agentDoc.exists) throw new AppError('Agent not found', 404);

  const agentData = agentDoc.data()!;
  const { executeMarketplaceAgent } = await import('../services/marketplaceAgentService');

  const config = {
    agentId: req.params.agentId,
    name: agentData['name'] as string ?? req.params.agentId,
    systemPrompt: agentData['systemPrompt'] as string ?? '',
    tools: agentData['tools'] as string[] ?? [],
    temperature: agentData['temperature'] as number ?? 0.5,
    model: agentData['model'] as string ?? 'flash',
    status: 'active',
  };

  const reply = await executeMarketplaceAgent(config, message, companyId);
  res.json({ success: true, data: { reply } });
}));

// ── PHASE 3: PAYMENT ENDPOINTS ──────────────────────────────────────────────

// POST /api/marketplace/agents/:id/checkout — Stripe checkout for paid agent
router.post('/agents/:id/checkout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const agentDoc = await db.collection('marketplaceAgents').doc(req.params.id).get();
  if (!agentDoc.exists) throw new AppError('Agent not found', 404);

  const agent = agentDoc.data()!;
  const priceUSD = agent['priceUSD'] as number ?? 0;
  if (priceUSD <= 0) throw new AppError('This agent is free — use install endpoint', 400);

  const paymentId = generateId();
  const { method, paymentMethod: manualMethodPref } = req.body as { method?: 'stripe' | 'paypal' | 'wave' | 'manual'; paymentMethod?: string };

  // Create payment record
  await db.collection('marketplacePayments').doc(paymentId).set({
    paymentId,
    companyId,
    agentId: req.params.id,
    agentName: agent['name'],
    amountUSD: priceUSD,
    method: method ?? 'stripe',
    status: 'pending',
    pricingModel: agent['pricingModel'],
    createdAt: new Date(),
    userId: req.user?.uid,
  });

  const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'];
  const WAVE_API_KEY = process.env['WAVE_API_KEY'];
  const baseUrl = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';

  // ── PayPal ────────────────────────────────────────────────────────────────
  if (method === 'paypal') {
    const { paypalService } = await import('../services/billing/paypalService');
    try {
      const { orderId, approveUrl } = await paypalService.createOrder({
        paymentId,
        companyId,
        planId: `agent:${req.params.id}`,
        interval: 'monthly',
        amountUSD: priceUSD,
        description: `Orlode Agent: ${agent['name']}`,
        returnUrl: `${baseUrl}/marketplace?status=success&payment=${paymentId}&method=paypal`,
        cancelUrl: `${baseUrl}/marketplace?status=cancelled`,
      });
      await db.collection('marketplacePayments').doc(paymentId).update({
        paypalOrderId: orderId,
      });
      return res.json({ success: true, data: { paymentId, method: 'paypal', checkoutUrl: approveUrl, amountUSD: priceUSD } });
    } catch (err) {
      return res.json({ success: true, data: { paymentId, method: 'paypal_error', error: String(err) } });
    }
  }

  // ── Manual / Cash ────────────────────────────────────────────────────────
  if (method === 'manual') {
    const { getManualPaymentContact } = await import('../services/platformSettings');
    const { phone: contactPhone, whatsapp: contactWhatsApp, email: contactEmail } = await getManualPaymentContact();
    const XOF_RATE = 600;
    const amountXOF = Math.round(priceUSD * XOF_RATE);

    await db.collection('marketplacePayments').doc(paymentId).update({
      paymentMethod: manualMethodPref ?? 'other',
      status: 'awaiting_confirmation',
      amountXOF,
    });

    return res.json({
      success: true,
      data: {
        paymentId,
        method: 'manual',
        amountUSD: priceUSD,
        amountXOF,
        reference: paymentId,
        contact: {
          phone: contactPhone,
          whatsapp: contactWhatsApp,
          email: contactEmail,
          whatsappLink: `https://wa.me/${contactWhatsApp.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(`Bonjour, je souhaite acheter l'agent ${agent['name']} (${priceUSD}$). Ref: ${paymentId}`)}`,
          emailLink: `mailto:${contactEmail}?subject=${encodeURIComponent(`Achat agent — ${agent['name']} — ref ${paymentId}`)}&body=${encodeURIComponent(`Bonjour,\n\nJe souhaite acheter l'agent ${agent['name']} (${priceUSD}$).\nReference: ${paymentId}\nMethode: ${manualMethodPref ?? 'a definir'}`)}`,
        },
        instructions: `Votre demande est enregistree avec la reference ${paymentId}. Contactez-nous pour finaliser (${priceUSD}$ / ${amountXOF.toLocaleString()} FCFA).`,
      },
    });
  }

  if (method === 'wave') {
    // Wave Mobile Money
    const XOF_RATE = 600;
    const amountXOF = Math.round(priceUSD * XOF_RATE);

    await db.collection('marketplacePayments').doc(paymentId).update({ amountXOF, currency: 'XOF' });

    if (!WAVE_API_KEY) {
      return res.json({
        success: true,
        data: {
          paymentId, method: 'wave_manual', amountXOF, amountUSD: priceUSD,
          instructions: `Envoyez ${amountXOF} FCFA via Wave. Reference: ${paymentId}`,
        },
      });
    }

    try {
      const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WAVE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: String(amountXOF), currency: 'XOF',
          error_url: `${baseUrl}/marketplace?status=error`,
          success_url: `${baseUrl}/marketplace?status=success&payment=${paymentId}`,
          client_reference: paymentId,
        }),
      });
      const waveData = await waveRes.json() as { id?: string; wave_launch_url?: string };
      await db.collection('marketplacePayments').doc(paymentId).update({
        waveSessionId: waveData.id, waveCheckoutUrl: waveData.wave_launch_url,
      });
      return res.json({ success: true, data: { paymentId, method: 'wave', checkoutUrl: waveData.wave_launch_url, amountXOF } });
    } catch {
      return res.json({
        success: true,
        data: { paymentId, method: 'wave_manual', amountXOF, instructions: `Envoyez ${amountXOF} FCFA. Ref: ${paymentId}` },
      });
    }
  }

  // Stripe checkout
  if (!STRIPE_SECRET) {
    return res.json({
      success: true,
      data: { paymentId, method: 'stripe_pending', amountUSD: priceUSD, message: 'Stripe not configured — contact admin' },
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = (await import('stripe')).default;
    const stripeClient = new (Stripe as unknown as new (key: string) => { checkout: { sessions: { create: (opts: unknown) => Promise<{ id: string; url: string }> } } })(STRIPE_SECRET);
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Orlode Agent: ${agent['name']}`,
            description: (agent['description'] as string) ?? '',
          },
          unit_amount: Math.round(priceUSD * 100),
          ...(agent['pricingModel'] === 'monthly' ? { recurring: { interval: 'month' } } : {}),
        },
        quantity: 1,
      }],
      mode: agent['pricingModel'] === 'monthly' ? 'subscription' : 'payment',
      success_url: `${baseUrl}/marketplace?status=success&payment=${paymentId}`,
      cancel_url: `${baseUrl}/marketplace?status=cancelled`,
      metadata: { paymentId, companyId, agentId: req.params.id },
    });

    await db.collection('marketplacePayments').doc(paymentId).update({
      stripeSessionId: session.id, stripeUrl: session.url,
    });

    res.json({ success: true, data: { paymentId, method: 'stripe', checkoutUrl: session.url } });
  } catch (err) {
    res.json({ success: true, data: { paymentId, method: 'stripe_error', error: String(err) } });
  }
}));

// POST /api/marketplace/webhook/stripe — Stripe webhook for marketplace payments
// Handles BOTH single-agent and bundle subscriptions. Metadata format from checkout:
//   single-agent : { paymentId, companyId, agentId }
//   bundle       : { paymentId, companyId, bundleId, agentIds: 'id1,id2,id3,id4' }
// SECURITY: webhook signature verification — Stripe lets anyone POST to a public
// URL, so without `constructEvent` an attacker can fake `checkout.session.completed`
// and install paid bundles for free. The body must be the RAW bytes (not parsed JSON);
// we get them via express.raw() at app.ts mount time. We fall back to JSON only when
// the secret is missing locally (dev mode), and log a loud warning.
router.post('/webhook/stripe', asyncHandler(async (req: Request, res: Response) => {
  const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
  let event: Record<string, unknown>;
  if (STRIPE_WEBHOOK_SECRET) {
    const sig = req.header('stripe-signature') ?? '';
    if (!sig) {
      logger.warn('[Marketplace] Stripe webhook rejected — missing stripe-signature header');
      res.status(400).send('Missing signature');
      return;
    }
    try {
      const Stripe = (await import('stripe')).default;
      const stripeClient = new (Stripe as unknown as new (key: string) => { webhooks: { constructEvent: (payload: string | Buffer, sig: string, secret: string) => { type: string; data: { object: Record<string, unknown> } } } })(process.env['STRIPE_SECRET_KEY'] ?? '');
      // Raw body — must match the bytes Stripe signed
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? req.body;
      event = stripeClient.webhooks.constructEvent(rawBody as Buffer | string, sig, STRIPE_WEBHOOK_SECRET) as unknown as Record<string, unknown>;
    } catch (err) {
      logger.error('[Marketplace] Stripe webhook signature verification failed', { error: String(err) });
      res.status(400).send('Invalid signature');
      return;
    }
  } else {
    // No secret configured — refuse the call rather than trust the body.
    logger.error('[Marketplace] STRIPE_WEBHOOK_SECRET not configured — webhook rejected');
    res.status(503).send('Webhook not configured');
    return;
  }
  const type = event['type'] as string;

  if (type !== 'checkout.session.completed' && type !== 'invoice.paid') {
    res.status(200).send('OK');
    return;
  }

  const session = (event['data'] as Record<string, unknown>)?.['object'] as Record<string, unknown>;
  const metadata = (session?.['metadata'] ?? {}) as Record<string, string>;
  const { paymentId, companyId, agentId, bundleId, agentIds } = metadata;

  if (!paymentId || !companyId) {
    logger.warn('[Marketplace] Stripe webhook missing paymentId/companyId in metadata', { metadata });
    res.status(200).send('OK');
    return;
  }

  const db = getFirestore();
  await db.collection('marketplacePayments').doc(paymentId).update({
    status: 'completed', completedAt: new Date(),
    stripeSubscriptionId: (session?.['subscription'] as string) ?? null,
  });

  // Resolve list of agent ids to install — either bundle's list or single agent.
  const idsToInstall: string[] = bundleId && agentIds
    ? agentIds.split(',').map(s => s.trim()).filter(Boolean)
    : (agentId ? [agentId] : []);

  if (idsToInstall.length === 0) {
    logger.warn('[Marketplace] Stripe webhook: no agent ids to install', { paymentId, metadata });
    res.status(200).send('OK');
    return;
  }

  // Install each agent. Done sequentially to avoid Firestore contention on
  // the same companyId doc and to log a clear audit trail.
  for (const id of idsToInstall) {
    try {
      const agentDoc = await db.collection('marketplaceAgents').doc(id).get();
      if (!agentDoc.exists) {
        logger.warn(`[Marketplace] Agent ${id} not found during webhook install`, { paymentId });
        continue;
      }
      const agent = agentDoc.data()!;
      await db.collection(`companies/${companyId}/installedAgents`).doc(id).set({
        agentId: id, installedAt: new Date(), status: 'active',
        pricingModel: agent['pricingModel'], paymentId,
        bundleId: bundleId ?? null,
        cachedConfig: {
          name: agent['name'], systemPrompt: agent['systemPrompt'] ?? '',
          tools: agent['tools'] ?? [], temperature: agent['temperature'] ?? 0.4,
          model: agent['model'] ?? 'flash',
        },
      });
      invalidateAgentCache(companyId);
      await db.collection('marketplaceAgents').doc(id).update({
        installCount: ((agent['installCount'] as number) ?? 0) + 1,
      }).catch(() => {});
    } catch (err) {
      logger.error(`[Marketplace] Failed to install ${id} after Stripe payment`, { error: err, paymentId });
    }
  }

  logger.info('[Marketplace] Stripe payment completed', {
    paymentId, companyId, bundleId: bundleId ?? null, agentsInstalled: idsToInstall.length,
  });
  res.status(200).send('OK');
}));

// POST /api/marketplace/webhook/wave — Wave webhook for marketplace payments
// SECURITY: Wave's HMAC signature header isn't standardized like Stripe's; we
// gate the endpoint with a shared secret in the URL (?secret=) — same pattern as
// `orders.routes.ts:120`. Without this, an attacker who guesses a paymentId can
// flip status to 'completed' and free-install the bundle.
router.post('/webhook/wave', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const provided = (req.query['secret'] as string ?? '').trim();
  if (!expected || provided !== expected) {
    logger.warn('[Marketplace] Wave webhook rejected — invalid or missing ?secret');
    res.status(403).send('Forbidden');
    return;
  }
  const body = req.body as Record<string, unknown>;
  const data = (body['data'] ?? {}) as Record<string, unknown>;
  const clientReference = data['client_reference'] as string;
  const checkoutStatus = data['checkout_status'] as string;

  if (!clientReference) { res.status(200).send('OK'); return; }

  const db = getFirestore();
  const paymentDoc = await db.collection('marketplacePayments').doc(clientReference).get();
  if (!paymentDoc.exists) { res.status(200).send('OK'); return; }

  const payment = paymentDoc.data()!;

  if (checkoutStatus === 'complete') {
    await db.collection('marketplacePayments').doc(clientReference).update({
      status: 'completed', completedAt: new Date(),
    });

    const companyId = payment['companyId'] as string;
    const agentId = payment['agentId'] as string;

    const agentDoc = await db.collection('marketplaceAgents').doc(agentId).get();
    if (agentDoc.exists) {
      const agent = agentDoc.data()!;
      await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).set({
        agentId, installedAt: new Date(), status: 'active',
        pricingModel: agent['pricingModel'], paymentId: clientReference,
        cachedConfig: {
          name: agent['name'], systemPrompt: agent['systemPrompt'] ?? '',
          tools: agent['tools'] ?? [], temperature: agent['temperature'] ?? 0.4,
          model: agent['model'] ?? 'flash',
        },
      });
      invalidateAgentCache(companyId);
    }
  } else if (checkoutStatus === 'expired' || checkoutStatus === 'failed') {
    await db.collection('marketplacePayments').doc(clientReference).update({
      status: 'failed', failedAt: new Date(),
    });
  }
  res.status(200).send('OK');
}));

// POST /api/marketplace/confirm-payment — admin confirms manual payment
router.post('/confirm-payment', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') throw new AppError('Admin only', 403);

  const { paymentId } = req.body as { paymentId: string };
  if (!paymentId) throw new AppError('paymentId required', 400);

  const db = getFirestore();
  const paymentDoc = await db.collection('marketplacePayments').doc(paymentId).get();
  if (!paymentDoc.exists) throw new AppError('Payment not found', 404);

  const payment = paymentDoc.data()!;
  const companyId = payment['companyId'] as string;
  const agentId = payment['agentId'] as string;

  await db.collection('marketplacePayments').doc(paymentId).update({
    status: 'completed', completedAt: new Date(), confirmedBy: req.user?.uid,
  });

  const agentDoc = await db.collection('marketplaceAgents').doc(agentId).get();
  if (agentDoc.exists) {
    const agent = agentDoc.data()!;
    await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).set({
      agentId, installedAt: new Date(), status: 'active',
      pricingModel: agent['pricingModel'], paymentId,
      cachedConfig: {
        name: agent['name'], systemPrompt: agent['systemPrompt'] ?? '',
        tools: agent['tools'] ?? [], temperature: agent['temperature'] ?? 0.4,
        model: agent['model'] ?? 'flash',
      },
    });
    invalidateAgentCache(companyId);
  }

  res.json({ success: true });
}));

// ── PHASE 5: REVIEWS & RATINGS ──────────────────────────────────────────────

// POST /api/marketplace/agents/:id/review
router.post('/agents/:id/review', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { rating, comment } = req.body as { rating: number; comment?: string };
  if (!rating || rating < 1 || rating > 5) throw new AppError('Rating must be 1-5', 400);

  const db = getFirestore();
  const agentId = req.params.id;

  // Check agent is installed by this company
  const installed = await db.collection(`companies/${companyId}/installedAgents`).doc(agentId).get();
  if (!installed.exists) throw new AppError('You must install the agent before reviewing', 400);

  // Check for existing review
  const existingSnap = await db.collection('marketplaceReviews')
    .where('agentId', '==', agentId)
    .where('companyId', '==', companyId)
    .limit(1).get();

  const reviewId = existingSnap.empty ? generateId() : existingSnap.docs[0].id;

  await db.collection('marketplaceReviews').doc(reviewId).set({
    agentId, companyId, userId: req.user?.uid,
    rating, comment: comment ?? '',
    createdAt: existingSnap.empty ? new Date() : existingSnap.docs[0].data()['createdAt'],
    updatedAt: new Date(),
  });

  // Recalculate avg rating
  const allReviews = await db.collection('marketplaceReviews').where('agentId', '==', agentId).get();
  const ratings = allReviews.docs.map(d => d.data()['rating'] as number);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  await db.collection('marketplaceAgents').doc(agentId).update({
    avgRating: Math.round(avgRating * 10) / 10,
    ratingCount: ratings.length,
  }).catch(() => {});

  res.json({ success: true, data: { reviewId, avgRating: Math.round(avgRating * 10) / 10 } });
}));

// GET /api/marketplace/agents/:id/reviews
router.get('/agents/:id/reviews', asyncHandler(async (req: Request, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('marketplaceReviews')
    .where('agentId', '==', req.params.id)
    .limit(50).get();

  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, data: reviews });
}));

// ── PHASE 5: ANALYTICS ──────────────────────────────────────────────────────

// GET /api/marketplace/analytics — marketplace-wide stats (admin)
router.get('/analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();

  const [agentsSnap, paymentsSnap, reviewsSnap] = await Promise.all([
    db.collection('marketplaceAgents').where('status', '==', 'approved').get(),
    db.collection('marketplacePayments').where('status', '==', 'completed').get(),
    db.collection('marketplaceReviews').get(),
  ]);

  const totalAgents = agentsSnap.size;
  const totalInstalls = agentsSnap.docs.reduce((sum, d) => sum + ((d.data()['installCount'] as number) ?? 0), 0);
  const totalRevenue = paymentsSnap.docs.reduce((sum, d) => sum + ((d.data()['amountUSD'] as number) ?? 0), 0);
  const totalReviews = reviewsSnap.size;

  // Top agents by installs
  const topAgents = agentsSnap.docs
    .map(d => ({ id: d.id, name: d.data()['name'] as string, installs: (d.data()['installCount'] as number) ?? 0, rating: (d.data()['avgRating'] as number) ?? 0 }))
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 10);

  // Revenue by month
  const revenueByMonth: Record<string, number> = {};
  for (const d of paymentsSnap.docs) {
    const date = (d.data()['completedAt'] as { toDate?: () => Date })?.toDate?.() ?? new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    revenueByMonth[key] = (revenueByMonth[key] ?? 0) + ((d.data()['amountUSD'] as number) ?? 0);
  }

  res.json({
    success: true,
    data: { totalAgents, totalInstalls, totalRevenue, totalReviews, topAgents, revenueByMonth },
  });
}));

// GET /api/marketplace/analytics/agent/:id — per-agent analytics
router.get('/analytics/agent/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const agentId = req.params.id;

  const [agentDoc, paymentsSnap, reviewsSnap] = await Promise.all([
    db.collection('marketplaceAgents').doc(agentId).get(),
    db.collection('marketplacePayments').where('agentId', '==', agentId).where('status', '==', 'completed').get(),
    db.collection('marketplaceReviews').where('agentId', '==', agentId).get(),
  ]);

  if (!agentDoc.exists) throw new AppError('Agent not found', 404);

  const agent = agentDoc.data()!;
  const revenue = paymentsSnap.docs.reduce((sum, d) => sum + ((d.data()['amountUSD'] as number) ?? 0), 0);
  const ratings = reviewsSnap.docs.map(d => d.data()['rating'] as number);
  const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({ rating: r, count: ratings.filter(x => x === r).length }));

  res.json({
    success: true,
    data: {
      installs: agent['installCount'] ?? 0,
      revenue,
      avgRating: agent['avgRating'] ?? 0,
      ratingCount: ratings.length,
      ratingDistribution,
      payments: paymentsSnap.size,
    },
  });
}));

// ── SEED ─────────────────────────────────────────────────────────────────────

// POST /api/marketplace/seed — force re-seed (admin only)
router.post('/seed', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  if (role !== 'admin') throw new AppError('Admin only', 403);
  await seedMarketplace(getFirestore());
  res.json({ success: true, message: 'Marketplace seeded with 30 agents' });
}));

// ─── AI ADVISOR — recommends agents/packs based on user description ─────────
// Uses Gemini Flash with the agent catalog as system context.
// Returns structured recommendations: { agentId, role, why } per agent + an
// optional bundle suggestion + a friendly message.
router.post('/advisor', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as { description?: string; history?: Array<{ role: string; content: string }> };
  const description = (body.description ?? '').trim();
  if (!description) throw new AppError('description required', 400);

  // Compact catalog (id · name · key capability) — kept short enough for the model context.
  const CATALOG = [
    'a1·Comptabilité·factures, P&L, TVA, trésorerie',
    'a2·Approbation·workflows multi-niveaux, escalade auto',
    'a3·Coach·plan carrière, mood tracking, burnout detection',
    'a4·Communications·emails, WhatsApp, Telegram, Slack, multi-canal',
    'a5·Cybersécurité·SIEM, incidents, vulnérabilités, phishing',
    'a6·Data Scientist·analyse cross-modules, prédictions, corrélations',
    'a7·Restaurant·commandes, menu, réservations, livraison',
    'a8·Livraison·tournées IA, multi-livreurs, COD/Mobile Money',
    'a9·Immobilier·annonces, visites 360°, négo, OHADA contrats',
    'a10·Mode·boutique mode, stocks, styliste IA, social selling',
    'a11·Beauté·salon RDV, fidélisation, catalogue produits',
    'a12·BTP·devis, suivi chantier, ouvriers, factures OHADA',
    'a13·Café·bar/café commandes, loyalty, stocks',
    'a14·Formation·école/centre cours, inscriptions, élèves',
    'a15·Tourisme·hôtels, billets, guides Afrique',
    'a16·Agronomie·cultures, calendrier saisonnier, coopérative',
    'a17·Élevage·troupeau, santé animale, vaccination',
    'a18·Médical Pro·dossier patient, prescriptions, consultations',
    'a19·Démo·agent test gratuit',
    'a20·Bienvenue·accueil basique site, FAQ, lead capture',
    'a21·Sales·CRM, pipeline, séquences emails, forecasts',
    'a22·Marketing·campagnes multi-canal, SEO, ads, analytics ROI',
    'a23·Fidélité·points, niveaux, NPS, relances clients',
    'a24·Knowledge·RAG indexation Drive/PDF, FAQ auto, multi-source',
    'a25·Réception·kiosk avatar IA, badges QR, notifs host, faciale',
    'a26·Accueil Visiteur·pré-enregistrement, QR WhatsApp, file VIP',
    'a27·RH·effectifs, congés OHADA, paie, performance, onboarding',
    'a28·Compliance·RGPD/ISO/SOC2/NIST, score live, politiques IA',
    'a29·Audit·journaux complets, anomalies, export CSV/PDF',
    'a30·Support·tickets SLA, IA contextuelle, KB auto, NPS',
  ].join('\n');

  const BUNDLES = [
    'b7·Pack Restaurant·Restaurant+Accueil+Livraison+Fidélité·$20/mo',
    'b10·Pack Entreprise·Sales+Comptabilité+Support+Communications·$20/mo',
    'b2·Pack Immobilier·Immobilier+Sales+Communications+Réception·$20/mo',
    'b11·Pack Réception·Réception+AccueilVisiteur+Livraison+Fidélité·$20/mo',
    'b12·Pack RH·RH+Coach+Approbation+Knowledge·$20/mo',
    'b13·Pack Cybersécurité·Cyber+Compliance+Audit+Approbation·$20/mo',
  ].join('\n');

  const history = (body.history ?? []).slice(-6).map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n');

  try {
    const { ai, GEMINI_FLASH } = await import('../config/genkit.config');
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Tu es le conseiller IA du marketplace Orlode. Ton rôle : analyser le métier et les tâches de l'utilisateur, puis recommander les agents IA et un pack qui résolvent ses problèmes concrets.

CATALOGUE D'AGENTS DISPONIBLES (id·nom·capacité) :
${CATALOG}

PACKS HÉROS DISPONIBLES (id·nom·composition·prix) :
${BUNDLES}

${history ? `CONTEXTE CONVERSATION :\n${history}\n` : ''}
DEMANDE DE L'UTILISATEUR :
"${description}"

Analyse cette demande et retourne UNIQUEMENT du JSON valide selon ce schéma exact (pas de markdown, pas d'explication hors JSON) :
{
  "message": "<message chaleureux qui résume ce que tu as compris du métier de l'utilisateur, en français, 2-3 phrases>",
  "recommendations": [
    {
      "agentId": "<id parmi a1-a30>",
      "agentName": "<nom de l'agent>",
      "role": "<le rôle concret que cet agent va jouer pour cet utilisateur, en 1 phrase>",
      "why": "<pourquoi cet agent est utile pour LA tâche décrite, 1-2 phrases concrètes>"
    }
  ],
  "suggestedPack": {
    "bundleId": "<id parmi b2,b7,b10,b11,b12,b13 ou null si pas de pack pertinent>",
    "bundleName": "<nom du pack>",
    "why": "<pourquoi ce pack est le meilleur deal pour ce métier, 1 phrase>"
  } ou null,
  "addonAgents": [
    {
      "agentId": "<id parmi a1-a30 NON inclus dans le suggestedPack>",
      "agentName": "<nom de l'agent>",
      "role": "<rôle spécifique pour ce métier en 1 phrase>",
      "why": "<pourquoi ajouter cet agent en plus du pack pour 5$/mo de plus>"
    }
  ],
  "customPackHint": "<si aucun pack ne convient parfaitement, suggère 4 agents pour un pack sur mesure, sinon null>"
}

RÈGLES :
- 3 à 5 agents recommandés max (pas plus, sinon overwhelm)
- Choisis ceux qui répondent VRAIMENT au métier décrit, pas générique
- Si la demande matche un pack hero, suggestedPack DOIT être rempli
- Le rôle doit être SPÉCIFIQUE à l'utilisateur (pas une définition générique)
- addonAgents : 1 à 3 agents UTILES en complément du pack, NON déjà inclus dans suggestedPack
  Exemple : si Pack Restaurant suggéré, l'add-on Marketing est précieux pour les promos saisonnières
  Exemple : si Pack RH suggéré, l'add-on Compta est précieux pour la paie
  Si pas de pack ou add-ons inutiles, retourne []
- Réponds en français
- JSON ONLY, pas de wrapper markdown`,
      config: { temperature: 0.4 },
    });

    let parsed: any;
    try {
      const cleaned = text.trim().replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return plain text
      res.json({
        success: true,
        data: {
          message: text.slice(0, 500),
          recommendations: [],
          suggestedPack: null,
          customPackHint: null,
        },
      });
      return;
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    const { logger } = await import('../utils/logger');
    logger.error('[Advisor] Failed', { error: err instanceof Error ? err.message : err });
    res.status(500).json({
      success: false,
      message: 'Le conseiller IA n\'est pas disponible pour le moment.',
    });
  }
}));

// ─── Super-admin auth helper ────────────────────────────────────────────────
async function requireSuperAdmin(req: AuthenticatedRequest): Promise<void> {
  if (!req.user?.uid) throw new AppError('Authentication required', 401);
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(req.user.uid).get();
  const isSuper = userDoc.data()?.['superAdmin'] === true || req.user.role === 'admin';
  if (!isSuper) throw new AppError('Super-admin only', 403);
}

// Maps the ?type query parameter to (storage subfolder, agent doc field).
// `cover` → single image, `video` → single video, `model3d` → single 3D file,
// `screenshot` → appended to a screenshots[] array.
function resolveMediaType(type: string): { folder: string; field: string; multi: boolean } {
  switch (type) {
    case 'cover': return { folder: 'cover', field: 'coverImage', multi: false };
    case 'video': return { folder: 'video', field: 'demoVideo', multi: false };
    case 'model3d': return { folder: 'model3d', field: 'model3d', multi: false };
    case 'screenshot': return { folder: 'screenshots', field: 'screenshots', multi: true };
    default: throw new AppError(`Unknown media type '${type}' (expected: cover|video|model3d|screenshot)`, 400);
  }
}

// ─── POST /agents/:id/media — super-admin uploads cover/screenshot/video/3D ──
router.post('/agents/:id/media', authMiddleware, singleMediaUpload, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await requireSuperAdmin(req);
  const { id } = req.params as { id: string };
  const type = (req.query['type'] as string) ?? 'cover';
  const { folder, field, multi } = resolveMediaType(type);

  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new AppError('No file uploaded', 400);

  const db = getFirestore();
  const agentRef = db.collection('marketplaceAgents').doc(id);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) throw new AppError('Agent not found', 404);

  const bucket = getStorage().bucket();
  const safeName = `${Date.now()}-${sanitizeFilename(file.originalname)}`;
  const storagePath = `marketplace/agents/${id}/${folder}/${safeName}`;
  const fileRef = bucket.file(storagePath);

  await fileRef.save(file.buffer, { metadata: { contentType: file.mimetype } });
  await fileRef.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  if (multi) {
    await agentRef.update({
      [field]: FieldValue.arrayUnion(url),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await agentRef.update({
      [field]: url,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  res.json({ success: true, data: { url, type, field, storagePath } });
}));

// ─── DELETE /agents/:id/media/:type — remove a media URL ────────────────────
// For screenshots, pass ?url=<urlToRemove> to drop a specific one. For single
// fields (cover/video/model3d), the field is cleared.
router.delete('/agents/:id/media/:type', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await requireSuperAdmin(req);
  const { id, type } = req.params as { id: string; type: string };
  const { field, multi } = resolveMediaType(type);

  const db = getFirestore();
  const agentRef = db.collection('marketplaceAgents').doc(id);
  if (!(await agentRef.get()).exists) throw new AppError('Agent not found', 404);

  if (multi) {
    const url = (req.query['url'] as string) ?? '';
    if (!url) throw new AppError('url query param required for screenshot removal', 400);
    await agentRef.update({
      [field]: FieldValue.arrayRemove(url),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await agentRef.update({
      [field]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  res.json({ success: true });
}));

// ─── POST /agents/:id/generate-cover — AI-generate cover via Gemini/Imagen ──
// Body: { prompt?: string, style?: string }. If prompt is omitted, we craft one
// from the agent's name/description. Returns the new cover URL.
router.post('/agents/:id/generate-cover', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await requireSuperAdmin(req);
  const { id } = req.params as { id: string };
  const body = req.body as { prompt?: string; style?: string };

  const db = getFirestore();
  const agentRef = db.collection('marketplaceAgents').doc(id);
  const agentSnap = await agentRef.get();
  if (!agentSnap.exists) throw new AppError('Agent not found', 404);
  const agent = agentSnap.data() as Record<string, unknown>;

  const userPrompt = (body.prompt ?? '').trim();
  const style = (body.style ?? 'modern minimalist tech illustration, soft gradients, premium SaaS marketing visual, no text, vibrant but tasteful colors, isometric or abstract geometric, dark background friendly').trim();

  const finalPrompt = userPrompt
    ? `${userPrompt}. Style: ${style}`
    : `Cover image for the AI agent "${agent['name'] ?? 'Agent'}" — ${(agent['description'] as string) ?? ''}. Industry: ${(agent['industry'] as string) ?? 'general business'}. Style: ${style}`;

  let imageBuffer: Buffer | null = null;
  let contentType = 'image/png';
  const errors: string[] = [];

  // Genkit responses put the image either in `media` (singular) or `media[]`
  // depending on plugin version. Handle both, decode the data URL.
  function extractImage(response: unknown): { buffer: Buffer; contentType: string } | null {
    const r = response as {
      media?: { url?: string; contentType?: string } | Array<{ url?: string; contentType?: string }>;
      message?: { content?: Array<{ media?: { url?: string; contentType?: string } }> };
    };
    const candidates: Array<{ url?: string; contentType?: string }> = [];
    if (r.media) {
      Array.isArray(r.media) ? candidates.push(...r.media) : candidates.push(r.media);
    }
    // Some Genkit responses nest media inside message.content[].media
    for (const part of r.message?.content ?? []) {
      if (part?.media) candidates.push(part.media);
    }
    for (const c of candidates) {
      if (!c.url) continue;
      const match = /^data:([^;]+);base64,(.+)$/.exec(c.url);
      if (match) {
        return { buffer: Buffer.from(match[2] ?? '', 'base64'), contentType: match[1] ?? 'image/png' };
      }
    }
    return null;
  }

  // Try Gemini 2.5 Flash Image ("Nano Banana") first — widest compatibility
  // with the standard Gemini API key (no Vertex/Imagen billing required).
  // Fall back to the preview alias, then the older 2.0 Flash Image, then
  // Imagen 3 (which requires Imagen-specific access).
  const candidates = [
    { model: 'googleai/gemini-2.5-flash-image', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.5-flash-image-preview', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/gemini-2.0-flash-preview-image-generation', config: { responseModalities: ['IMAGE', 'TEXT'] } },
    { model: 'googleai/imagen-3.0-generate-001', config: { numberOfImages: 1, aspectRatio: '16:9' } },
  ];

  const { ai } = await import('../config/genkit.config');
  for (const c of candidates) {
    try {
      const response = await ai.generate({ model: c.model, prompt: finalPrompt, config: c.config });
      const extracted = extractImage(response);
      if (extracted) {
        imageBuffer = extracted.buffer;
        contentType = extracted.contentType;
        break;
      }
      errors.push(`${c.model}: response had no image data`);
    } catch (err) {
      errors.push(`${c.model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!imageBuffer) {
    const { logger } = await import('../utils/logger');
    logger.warn('[Marketplace] AI cover generation failed', { errors });
    throw new AppError(`AI image generation unavailable. Tried ${candidates.length} models. Last error: ${errors[errors.length - 1] ?? 'unknown'}`, 503);
  }

  const bucket = getStorage().bucket();
  const safeName = `${Date.now()}-ai-cover.${contentType.includes('jpeg') ? 'jpg' : 'png'}`;
  const storagePath = `marketplace/agents/${id}/cover/${safeName}`;
  const fileRef = bucket.file(storagePath);
  await fileRef.save(imageBuffer, { metadata: { contentType } });
  await fileRef.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  await agentRef.update({
    coverImage: url,
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.json({ success: true, data: { url, prompt: finalPrompt } });
}));

// ─── PATCH /agents/:id — super-admin edits agent metadata ────────────────────
// Whitelist of editable fields — anything else is dropped silently to keep
// pricing/status/auth fields tamper-proof from this endpoint.
const EDITABLE_AGENT_FIELDS = new Set([
  'name', 'description', 'longDescription', 'icon', 'color',
  'features', 'industry', 'category', 'tags',
  'coverImage', 'demoVideo', 'model3d', 'screenshots',
]);

router.patch('/agents/:id', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await requireSuperAdmin(req);
  const { id } = req.params as { id: string };
  const body = req.body as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE_AGENT_FIELDS.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) throw new AppError('No editable fields provided', 400);

  const db = getFirestore();
  const agentRef = db.collection('marketplaceAgents').doc(id);
  if (!(await agentRef.get()).exists) throw new AppError('Agent not found', 404);

  update['updatedAt'] = FieldValue.serverTimestamp();
  await agentRef.update(update);

  const updated = await agentRef.get();
  res.json({ success: true, data: { id: updated.id, ...updated.data() } });
}));

export default router;
