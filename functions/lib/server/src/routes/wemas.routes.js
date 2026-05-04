"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicContractRouter = void 0;
/**
 * WEMAS Routes — Contract management, signatures, portfolios, templates
 * Migrated from WEMAS standalone + enriched for Orlode
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const wemasService_1 = require("../services/wemas/wemasService");
const firebase_config_1 = require("../config/firebase.config");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── Contracts ────────────────────────────────────────────────────────────────
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { status, type } = req.query;
    const contracts = await wemasService_1.wemasService.listContracts(companyId, { status: status, type: type });
    res.json({ success: true, data: contracts });
}));
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const stats = await wemasService_1.wemasService.getStats(companyId);
    res.json({ success: true, data: stats });
}));
router.get('/portfolios', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const portfolios = await wemasService_1.wemasService.getPortfolios(companyId);
    res.json({ success: true, data: portfolios });
}));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const contract = await wemasService_1.wemasService.getContract(companyId, req.params['id']);
    if (!contract)
        throw new error_middleware_1.AppError('Contrat introuvable', 404);
    res.json({ success: true, data: contract });
}));
router.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { signatoryName, signatoryEmail } = req.body;
    if (!signatoryName || !signatoryEmail)
        throw new error_middleware_1.AppError('signatoryName and signatoryEmail required', 400);
    const contract = await wemasService_1.wemasService.createContract({ companyId, createdBy: req.user?.uid, ...req.body });
    res.status(201).json({ success: true, data: contract });
}));
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.updateContract(companyId, req.params['id'], req.body);
    res.json({ success: true });
}));
router.post('/:id/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const uniqueLink = await wemasService_1.wemasService.sendForSignature(companyId, req.params['id']);
    res.json({ success: true, data: { uniqueLink } });
}));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.deleteContract(companyId, req.params['id']);
    res.json({ success: true });
}));
// ── AI Contract Generation ───────────────────────────────────────────────────
const CONTRACT_TEMPLATES = {
    prestation_services: (name, org) => `CONTRAT DE PRESTATION DE SERVICES

Entre les soussignes :

${org}, ci-apres denomme "le Prestataire",
d'une part,

Et

${name}, ci-apres denomme "le Client",
d'autre part,

Il a ete convenu et arrete ce qui suit :

ARTICLE 1 — OBJET DU CONTRAT
Le Prestataire s'engage a fournir au Client les services suivants :
[Description detaillee des services a fournir]

ARTICLE 2 — DUREE
Le present contrat est conclu pour une duree de [duree] a compter de sa signature par les deux parties.

ARTICLE 3 — REMUNERATION
En contrepartie des services fournis, le Client versera au Prestataire la somme de [montant] euros HT.
Le paiement sera effectue selon les modalites suivantes : [modalites de paiement].

ARTICLE 4 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage a :
- Executer les services avec diligence et professionnalisme
- Respecter les delais convenus
- Informer le Client de toute difficulte rencontree
- Assurer la confidentialite des informations transmises

ARTICLE 5 — OBLIGATIONS DU CLIENT
Le Client s'engage a :
- Fournir au Prestataire toutes les informations necessaires
- Regler les factures dans les delais convenus
- Faciliter l'execution des services

ARTICLE 6 — CONFIDENTIALITE
Les parties s'engagent a maintenir strictement confidentiel l'ensemble des informations echangees dans le cadre du present contrat, pendant toute la duree du contrat et pendant une periode de [duree] ans apres son expiration.

ARTICLE 7 — PROPRIETE INTELLECTUELLE
Les livrables produits dans le cadre de la presente prestation deviennent la propriete du Client apres paiement integral de la remuneration.

ARTICLE 8 — RESILIATION
Chaque partie pourra resilier le present contrat en cas de manquement grave de l'autre partie a ses obligations, apres mise en demeure restee infructueuse pendant un delai de [delai] jours.

ARTICLE 9 — FORCE MAJEURE
Aucune des parties ne sera tenue responsable d'un retard ou d'une inexecution due a un cas de force majeure tel que defini par la jurisprudence.

ARTICLE 10 — LOI APPLICABLE ET JURIDICTION
Le present contrat est soumis au droit francais. Tout litige sera soumis a la competence exclusive des tribunaux de [ville].

Fait en deux exemplaires originaux.

A [ville], le [date]

Pour ${org} :                          Pour ${name} :
Signature :                            Signature :`,
    partenariat: (name, org) => `ACCORD DE PARTENARIAT

Entre :
${org}, ci-apres denomme "Partenaire A",
Et :
${name}, ci-apres denomme "Partenaire B",

ARTICLE 1 — OBJET
Les parties conviennent d'etablir un partenariat dans le but de [objectif du partenariat].

ARTICLE 2 — DUREE
Le present accord est conclu pour une duree de [duree], renouvelable par tacite reconduction.

ARTICLE 3 — ENGAGEMENTS DES PARTIES
Partenaire A s'engage a : [engagements]
Partenaire B s'engage a : [engagements]

ARTICLE 4 — REPARTITION DES REVENUS
Les revenus generes seront repartis comme suit : [repartition].

ARTICLE 5 — CONFIDENTIALITE
Les parties s'engagent a ne pas divulguer les informations confidentielles echangees.

ARTICLE 6 — RESILIATION
Le present accord peut etre resilie par l'une ou l'autre des parties moyennant un preavis de [delai] jours.

ARTICLE 7 — LOI APPLICABLE
Le present accord est regi par le droit francais.

Fait a [ville], le [date]

${org}                                 ${name}
Signature :                            Signature :`,
    nda: (name, org) => `ACCORD DE CONFIDENTIALITE (NDA)

Entre :
${org}, ci-apres "la Partie Divulgatrice",
Et :
${name}, ci-apres "la Partie Receptrice",

ARTICLE 1 — OBJET
Le present accord a pour objet de definir les conditions dans lesquelles la Partie Receptrice s'engage a preserver la confidentialite des informations qui lui seront communiquees.

ARTICLE 2 — INFORMATIONS CONFIDENTIELLES
Sont considerees comme confidentielles toutes les informations, sous quelque forme que ce soit, communiquees par la Partie Divulgatrice.

ARTICLE 3 — OBLIGATIONS
La Partie Receptrice s'engage a :
- Ne pas divulguer les informations confidentielles a des tiers
- Ne les utiliser que dans le cadre de [projet]
- Prendre toutes les mesures necessaires pour proteger ces informations
- Restituer ou detruire les informations a premiere demande

ARTICLE 4 — DUREE
Le present accord est conclu pour une duree de [duree] ans a compter de sa signature.

ARTICLE 5 — SANCTIONS
Toute violation du present accord pourra donner lieu a des dommages et interets.

ARTICLE 6 — LOI APPLICABLE
Le present accord est regi par le droit francais.

Fait a [ville], le [date]

${org}                                 ${name}
Signature :                            Signature :`,
    cdi: (name, org) => `CONTRAT DE TRAVAIL A DUREE INDETERMINEE

Entre :
${org}, ci-apres denomme "l'Employeur",
Et :
${name}, ci-apres denomme "le Salarie",

ARTICLE 1 — ENGAGEMENT
L'Employeur engage le Salarie en qualite de [poste] a compter du [date].

ARTICLE 2 — FONCTIONS
Le Salarie exercera les fonctions de [description du poste]. Il sera place sous l'autorite de [responsable hierarchique].

ARTICLE 3 — LIEU DE TRAVAIL
Le lieu de travail est fixe a [adresse].

ARTICLE 4 — DUREE DU TRAVAIL
La duree hebdomadaire de travail est fixee a [heures] heures.

ARTICLE 5 — REMUNERATION
Le Salarie percevra une remuneration mensuelle brute de [montant] euros.

ARTICLE 6 — PERIODE D'ESSAI
Le present contrat est conclu avec une periode d'essai de [duree] mois, renouvelable une fois.

ARTICLE 7 — CONGES PAYES
Le Salarie beneficiera de [nombre] jours ouvrables de conges payes par an.

ARTICLE 8 — CONFIDENTIALITE
Le Salarie s'engage a ne pas divulguer les informations confidentielles dont il aura connaissance.

ARTICLE 9 — CLAUSE DE NON-CONCURRENCE
[Si applicable] Le Salarie s'engage a ne pas exercer d'activite concurrente pendant une duree de [duree] apres la fin du contrat.

ARTICLE 10 — RESILIATION
Le present contrat peut etre resilie par l'une ou l'autre des parties dans le respect des dispositions legales.

ARTICLE 11 — CONVENTION COLLECTIVE
Le present contrat est soumis a la convention collective [nom].

Fait a [ville], le [date], en deux exemplaires.

L'Employeur ${org}                     Le Salarie ${name}
Signature :                            Signature :`,
    cdd: (name, org) => `CONTRAT DE TRAVAIL A DUREE DETERMINEE

Entre :
${org}, ci-apres "l'Employeur",
Et :
${name}, ci-apres "le Salarie",

ARTICLE 1 — MOTIF DU RECOURS AU CDD
Le present contrat est conclu pour le motif suivant : [motif — remplacement, accroissement temporaire d'activite, etc.]

ARTICLE 2 — ENGAGEMENT ET DUREE
Le Salarie est engage du [date debut] au [date fin] en qualite de [poste].

ARTICLE 3 — REMUNERATION
Remuneration mensuelle brute : [montant] euros.

ARTICLE 4 — PERIODE D'ESSAI
Periode d'essai de [duree] jours.

ARTICLE 5 — LIEU ET HORAIRES
Lieu : [adresse]. Horaires : [heures] heures hebdomadaires.

ARTICLE 6 — INDEMNITE DE FIN DE CONTRAT
A l'issue du contrat, le Salarie percevra une indemnite de precarite de 10% de la remuneration brute totale.

ARTICLE 7 — DISPOSITIONS GENERALES
Le present contrat est soumis au droit du travail et a la convention collective [nom].

Fait a [ville], le [date]

${org}                                 ${name}
Signature :                            Signature :`,
    stage: (name, org) => `CONVENTION DE STAGE

Entre :
${org}, ci-apres "l'Organisme d'accueil",
Et :
${name}, ci-apres "le Stagiaire",
Et :
[Etablissement d'enseignement], ci-apres "l'Etablissement",

ARTICLE 1 — OBJET
Le present stage a pour objet [objectif du stage] et s'inscrit dans le cadre de la formation [formation].

ARTICLE 2 — DUREE
Du [date debut] au [date fin], soit [nombre] semaines.

ARTICLE 3 — GRATIFICATION
Le Stagiaire percevra une gratification mensuelle de [montant] euros.

ARTICLE 4 — HORAIRES
[Heures] heures par semaine, du lundi au vendredi.

ARTICLE 5 — TUTEUR
Le Stagiaire sera encadre par [nom du tuteur], [fonction].

ARTICLE 6 — CONFIDENTIALITE
Le Stagiaire s'engage a respecter la confidentialite des informations.

ARTICLE 7 — RESPONSABILITE
L'Organisme d'accueil s'engage a respecter la reglementation en vigueur.

Fait a [ville], le [date]

${org}                ${name}                [Etablissement]
Signature :           Signature :            Signature :`,
    freelance: (name, org) => `CONTRAT DE MISSION FREELANCE

Entre :
${org}, ci-apres "le Client",
Et :
${name}, travailleur independant, ci-apres "le Prestataire",

ARTICLE 1 — OBJET
Le Prestataire s'engage a realiser la mission suivante : [description].

ARTICLE 2 — DUREE
La mission se deroule du [date debut] au [date fin].

ARTICLE 3 — HONORAIRES
Le Client versera au Prestataire la somme de [montant] euros HT. Paiement a [delai] jours.

ARTICLE 4 — INDEPENDANCE
Le Prestataire exerce sa mission en toute independance. Il n'existe aucun lien de subordination.

ARTICLE 5 — LIVRABLES
Le Prestataire remettra les livrables suivants : [liste].

ARTICLE 6 — PROPRIETE INTELLECTUELLE
Les livrables deviennent propriete du Client apres paiement integral.

ARTICLE 7 — CONFIDENTIALITE
Le Prestataire s'engage a la confidentialite des informations echangees.

ARTICLE 8 — RESILIATION
Resiliation possible avec un preavis de [delai] jours.

Fait a [ville], le [date]

${org}                                 ${name}
Signature :                            Signature :`,
    licence: (name, org) => `CONTRAT DE LICENCE D'EXPLOITATION

Entre :
${org}, ci-apres "le Concedant",
Et :
${name}, ci-apres "le Licencie",

ARTICLE 1 — OBJET
Le Concedant accorde au Licencie une licence d'exploitation de [objet].

ARTICLE 2 — TERRITOIRE
La licence est valable sur le territoire de [pays/region].

ARTICLE 3 — DUREE
La licence est accordee pour une duree de [duree] a compter de la signature.

ARTICLE 4 — REDEVANCES
Le Licencie versera une redevance de [pourcentage]% des revenus nets, payable [frequence].

ARTICLE 5 — EXCLUSIVITE
La presente licence est [exclusive / non-exclusive].

ARTICLE 6 — OBLIGATIONS DU LICENCIE
Le Licencie s'engage a exploiter la licence de maniere diligente et conforme.

ARTICLE 7 — RESILIATION
En cas de non-respect des obligations, la licence pourra etre resiliee de plein droit.

Fait a [ville], le [date]

${org}                                 ${name}
Signature :                            Signature :`,
};
router.post('/generate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { signatoryName, contractType, mainContractType } = req.body;
    if (!signatoryName)
        throw new error_middleware_1.AppError('signatoryName required', 400);
    const orgName = '[Organisation]';
    const type = contractType ?? 'prestation_services';
    // Try AI generation first
    try {
        const { ai, GEMINI_FLASH } = await Promise.resolve().then(() => __importStar(require('../config/genkit.config')));
        const result = await ai.generate({
            model: GEMINI_FLASH,
            prompt: `Tu es un juriste expert. Genere un contrat professionnel complet en francais.
Type: ${mainContractType ?? 'prestation'} — ${type}
Signataire: ${signatoryName}
Organisation: ${orgName}
Regles: Contrat formel avec articles numerotes (objet, duree, remuneration, confidentialite, resiliation, juridiction). Utiliser ${signatoryName} et ${orgName}. Ne retourne QUE le texte du contrat.`,
            config: { temperature: 0.3 },
        });
        const content = result.text?.trim();
        if (content && content.length > 100) {
            res.json({ success: true, data: { content, source: 'ai' } });
            return;
        }
    }
    catch {
        // AI failed, fall through to template
    }
    // Fallback: pre-generated template
    const templateFn = CONTRACT_TEMPLATES[type] ?? CONTRACT_TEMPLATES['prestation_services'];
    const content = templateFn(signatoryName, orgName);
    res.json({ success: true, data: { content, source: 'template' } });
}));
// ── Contract Comments ────────────────────────────────────────────────────────
router.get('/comments/:contractId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    res.json({ success: true, data: await wemasService_1.wemasService.listComments(companyId, req.params['contractId']) });
}));
router.post('/comments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const result = await wemasService_1.wemasService.addComment(companyId, {
        ...req.body,
        authorName: req.body.authorName || req.user?.email || '',
        authorEmail: req.user?.email || '',
    });
    res.status(201).json({ success: true, data: result });
}));
router.delete('/comments/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.deleteComment(companyId, req.params['id']);
    res.json({ success: true });
}));
// ── Templates ────────────────────────────────────────────────────────────────
router.get('/templates/list', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    res.json({ success: true, data: await wemasService_1.wemasService.listTemplates(companyId) });
}));
router.post('/templates', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const template = await wemasService_1.wemasService.createTemplate(companyId, req.body);
    res.status(201).json({ success: true, data: template });
}));
router.patch('/templates/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.updateTemplate(companyId, req.params['id'], req.body);
    res.json({ success: true });
}));
router.delete('/templates/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.deleteTemplate(companyId, req.params['id']);
    res.json({ success: true });
}));
// ── Portfolio Documents ──────────────────────────────────────────────────────
router.get('/documents/:email', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    res.json({ success: true, data: await wemasService_1.wemasService.listDocuments(companyId, req.params['email']) });
}));
router.post('/documents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await wemasService_1.wemasService.addDocument(companyId, { ...req.body, uploadedBy: req.user?.uid });
    res.status(201).json({ success: true, data: doc });
}));
router.delete('/documents/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.deleteDocument(companyId, req.params['id']);
    res.json({ success: true });
}));
// ── Portfolio Notes ──────────────────────────────────────────────────────────
router.get('/notes/:email', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    res.json({ success: true, data: await wemasService_1.wemasService.listNotes(companyId, req.params['email']) });
}));
router.post('/notes', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const note = await wemasService_1.wemasService.addNote(companyId, { ...req.body, createdBy: req.user?.uid });
    res.status(201).json({ success: true, data: note });
}));
router.patch('/notes/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.updateNote(companyId, req.params['id'], req.body.content);
    res.json({ success: true });
}));
router.delete('/notes/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.deleteNote(companyId, req.params['id']);
    res.json({ success: true });
}));
// ── Upload Requests ──────────────────────────────────────────────────────────
router.post('/upload-requests', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const request = await wemasService_1.wemasService.createUploadRequest(companyId, { ...req.body, createdBy: req.user?.uid });
    res.status(201).json({ success: true, data: request });
}));
router.delete('/upload-requests/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await wemasService_1.wemasService.deleteUploadRequest(companyId, req.params['id']);
    res.json({ success: true });
}));
exports.default = router;
// ── Public routes (no auth — for signing + document upload) ──────────────────
exports.publicContractRouter = (0, express_1.Router)();
exports.publicContractRouter.get('/contract/:uniqueLink', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const contract = await wemasService_1.wemasService.getContractByUniqueLink(req.params['uniqueLink']);
    if (!contract)
        throw new error_middleware_1.AppError('Contrat introuvable', 404);
    res.json({ success: true, data: contract });
}));
exports.publicContractRouter.post('/contract/:uniqueLink/sign', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const signingLink = req.params['uniqueLink'];
    const contract = await wemasService_1.wemasService.getContractByUniqueLink(signingLink);
    if (!contract)
        throw new error_middleware_1.AppError('Contrat introuvable', 404);
    const { signatureData } = req.body;
    if (!signatureData)
        throw new error_middleware_1.AppError('signatureData is required', 400);
    const result = await wemasService_1.wemasService.signContract(contract.companyId, contract.id, signatureData, req.ip ?? undefined, req.headers['user-agent'] ?? undefined, signingLink);
    res.json({ success: result.success, data: result });
}));
exports.publicContractRouter.get('/upload/:token', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const request = await wemasService_1.wemasService.getUploadRequestByToken(req.params['token']);
    if (!request)
        throw new error_middleware_1.AppError('Lien introuvable', 404);
    if (request.expiresAt && new Date(request.expiresAt) < new Date())
        throw new error_middleware_1.AppError('Lien expire', 410);
    res.json({ success: true, data: request });
}));
// GET /api/public/host-notifications/:id/status — kiosk polls this to see if the host replied
exports.publicContractRouter.get('/host-notifications/:id/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params['id'];
    if (!id)
        throw new error_middleware_1.AppError('ID requis', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collectionGroup('hostNotifications').where('id', '==', id).limit(1).get().catch(() => null);
    if (!snap || snap.empty) {
        // fallback: scan by doc ID
        const docs = await db.collectionGroup('hostNotifications').get().catch(() => null);
        const match = docs?.docs.find(d => d.id === id);
        if (!match) {
            res.status(404).json({ success: false, message: 'not found' });
            return;
        }
        const data = match.data();
        res.json({
            success: true,
            status: data['status'] ?? 'pending',
            replyAction: data['replyAction'] ?? null,
            repliedAt: data['repliedAt'] ?? null,
            hostName: data['hostName'] ?? null,
            hostPresent: data['hostPresent'] ?? false,
        });
        return;
    }
    const data = snap.docs[0].data();
    res.json({
        success: true,
        status: data['status'] ?? 'pending',
        replyAction: data['replyAction'] ?? null,
        repliedAt: data['repliedAt'] ?? null,
        hostName: data['hostName'] ?? null,
        hostPresent: data['hostPresent'] ?? false,
    });
}));
// GET /api/public/host-reply/:token?action=accept|wait|reject — employee replies to visitor notification
exports.publicContractRouter.get('/host-reply/:token', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const token = req.params['token'];
    const action = req.query['action'] ?? '';
    if (!['accept', 'wait', 'reject'].includes(action)) {
        res.status(400).send('<h2>Action invalide</h2>');
        return;
    }
    const db = (0, firebase_config_1.getFirestore)();
    // Find notification by replyToken (scan all companies — rare and small)
    const snap = await db.collectionGroup('hostNotifications').where('replyToken', '==', token).limit(1).get()
        .catch(() => null);
    if (!snap || snap.empty) {
        res.status(404).send('<h2>Lien introuvable ou expiré</h2>');
        return;
    }
    const doc = snap.docs[0];
    const data = doc.data();
    const statusMap = {
        accept: 'accepted', wait: 'asked_to_wait', reject: 'rejected',
    };
    await doc.ref.update({
        status: statusMap[action],
        repliedAt: new Date(),
        replyAction: action,
    });
    const hostName = data['hostName'] ?? 'L\'hôte';
    const visitorName = data['visitorName'] ?? 'Le visiteur';
    const messages = {
        accept: { title: 'Réponse envoyée ✅', body: `${hostName}, merci. ${visitorName} va être prévenu(e) que vous arrivez.`, color: '#16a34a' },
        wait: { title: 'Réponse envoyée ⏳', body: `${visitorName} va être invité(e) à patienter.`, color: '#eab308' },
        reject: { title: 'Réponse envoyée ❌', body: `${visitorName} va être informé(e) que vous n'êtes pas disponible.`, color: '#dc2626' },
    };
    const m = messages[action];
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Réponse enregistrée</title></head>
<body style="font-family:system-ui;max-width:520px;margin:80px auto;padding:40px;text-align:center;background:#f9fafb">
  <div style="background:white;border-radius:20px;padding:40px;box-shadow:0 2px 20px rgba(0,0,0,0.05)">
    <div style="width:72px;height:72px;border-radius:50%;background:${m.color};margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:32px;color:white">${action === 'accept' ? '✓' : action === 'wait' ? '⏳' : '✕'}</div>
    <h1 style="font-size:20px;margin:0 0 12px">${m.title}</h1>
    <p style="color:#6b7280;line-height:1.6;margin:0">${m.body}</p>
  </div>
</body></html>`);
}));
// POST /api/public/upload-document — submit a portfolio document via magic link
exports.publicContractRouter.post('/upload-document', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const token = body['token'];
    if (!token)
        throw new error_middleware_1.AppError('Token requis', 400);
    const request = await wemasService_1.wemasService.getUploadRequestByToken(token);
    if (!request)
        throw new error_middleware_1.AppError('Lien introuvable', 404);
    if (request.expiresAt && new Date(request.expiresAt) < new Date())
        throw new error_middleware_1.AppError('Lien expire', 410);
    const doc = await wemasService_1.wemasService.addDocument(request.companyId, {
        signatoryEmail: request.signatoryEmail,
        signatoryName: request.signatoryName,
        documentType: body['documentType'] ?? 'autre',
        label: body['label'] ?? 'Document',
        fileUrl: body['fileUrl'] ?? '',
        fileName: body['fileName'] ?? 'document',
        fileSize: body['fileSize'] ?? 0,
        uploadedBy: `upload-link:${token.slice(0, 8)}`,
    });
    res.status(201).json({ success: true, data: doc });
}));
//# sourceMappingURL=wemas.routes.js.map