"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wemasService = exports.WemasService = void 0;
/**
 * WEMAS — Service de gestion des contrats enrichi
 * Signature electronique, portfolios, templates, depot de documents
 * Migre depuis le projet WEMAS standalone (Supabase → Firebase)
 */
const crypto_1 = require("crypto");
const firebase_config_1 = require("../../config/firebase.config");
// Lazy import io to avoid circular dependency
let _io = null;
function getIO() {
    if (!_io) {
        try {
            _io = require('../../app').io;
        }
        catch { /* not available yet */ }
    }
    return _io;
}
const logger_1 = require("../../utils/logger");
// ── Helper ───────────────────────────────────────────────────────────────────
function col(companyId, sub) {
    return `companies/${companyId}/${sub}`;
}
// ── Service ──────────────────────────────────────────────────────────────────
class WemasService {
    // ════════════════════════════════════════════════════════════════════════════
    // CONTRACTS
    // ════════════════════════════════════════════════════════════════════════════
    async createContract(input) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(col(input.companyId, 'contracts')).doc();
        const uniqueLink = (0, crypto_1.randomBytes)(32).toString('hex');
        const now = new Date().toISOString();
        // Build signatories array (primary + additional)
        const signatories = [
            {
                name: input.signatoryName,
                email: input.signatoryEmail,
                role: 'client',
                signatureLink: uniqueLink,
            },
            ...(input.additionalSignatories ?? []).map(s => ({
                name: s.name,
                email: s.email,
                role: s.role ?? 'other',
                signatureLink: (0, crypto_1.randomBytes)(32).toString('hex'),
            })),
        ];
        const contract = {
            id: ref.id,
            companyId: input.companyId,
            uniqueLink,
            signatoryName: input.signatoryName,
            signatoryEmail: input.signatoryEmail,
            signatoryPhone: input.signatoryPhone,
            signatoryAddress: input.signatoryAddress,
            contractContent: input.contractContent,
            contractType: input.contractType,
            mainContractType: input.mainContractType,
            templateId: input.templateId,
            importedFileUrl: input.importedFileUrl,
            importedFileName: input.importedFileName,
            importedFileType: input.importedFileType,
            senderName: input.senderName,
            senderSignatureData: input.senderSignatureData,
            senderSignedAt: input.senderSignatureData ? now : undefined,
            signatories: signatories.length > 1 ? signatories : undefined,
            status: input.status ?? 'pending_signature',
            expiresAt: input.expiresInDays
                ? new Date(Date.now() + input.expiresInDays * 86400000).toISOString()
                : undefined,
            tags: input.tags ?? [],
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        };
        await ref.set(contract);
        logger_1.logger.info('[WEMAS] Contract created', { companyId: input.companyId, contractId: ref.id, uniqueLink, signatoryCount: signatories.length });
        return contract;
    }
    async listContracts(companyId, filters) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            let query = db.collection(col(companyId, 'contracts'));
            if (filters?.status)
                query = query.where('status', '==', filters.status);
            if (filters?.type)
                query = query.where('contractType', '==', filters.type);
            const snap = await query.get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        catch {
            return [];
        }
    }
    async getContract(companyId, contractId) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            const doc = await db.collection(col(companyId, 'contracts')).doc(contractId).get();
            if (!doc.exists)
                return null;
            return { id: doc.id, ...doc.data() };
        }
        catch {
            return null;
        }
    }
    async getContractByUniqueLink(uniqueLink) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            // Try primary uniqueLink first
            let snap = await db.collectionGroup('contracts').where('uniqueLink', '==', uniqueLink).limit(1).get();
            if (!snap.empty)
                return { id: snap.docs[0].id, ...snap.docs[0].data() };
            // Try signatories[].signatureLink (multi-signature)
            // collectionGroup doesn't support array-contains on nested fields,
            // so we do a broader search
            snap = await db.collectionGroup('contracts').where('status', '==', 'pending_signature').get();
            for (const doc of snap.docs) {
                const data = doc.data();
                const signatories = (data.signatories ?? []);
                if (signatories.some(s => s.signatureLink === uniqueLink)) {
                    return { id: doc.id, ...data };
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async updateContract(companyId, contractId, updates) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'contracts')).doc(contractId)
            .update({ ...updates, updatedAt: new Date().toISOString() });
    }
    async signContract(companyId, contractId, signatureData, ip, userAgent, signingLink) {
        const contract = await this.getContract(companyId, contractId);
        if (!contract)
            return { success: false, message: 'Contrat introuvable' };
        if (contract.status !== 'pending_signature')
            return { success: false, message: 'Ce contrat n\'est pas en attente de signature' };
        if (contract.expiresAt && new Date() > new Date(contract.expiresAt)) {
            await this.updateContract(companyId, contractId, { status: 'expired' });
            return { success: false, message: 'Contrat expire' };
        }
        const now = new Date().toISOString();
        // Multi-signature: find which signatory is signing
        if (contract.signatories && contract.signatories.length > 0 && signingLink) {
            const signatories = [...contract.signatories];
            const sigIdx = signatories.findIndex(s => s.signatureLink === signingLink);
            if (sigIdx === -1)
                return { success: false, message: 'Lien de signature invalide' };
            if (signatories[sigIdx].signedAt)
                return { success: false, message: 'Deja signe' };
            signatories[sigIdx] = {
                ...signatories[sigIdx],
                signatureData,
                signedAt: now,
                signatureIp: ip,
                signatureUserAgent: userAgent,
            };
            const allSigned = signatories.every(s => !!s.signedAt);
            await this.updateContract(companyId, contractId, {
                signatories,
                status: allSigned ? 'signed' : 'pending_signature',
                signedAt: allSigned ? now : undefined,
            });
            const io = getIO();
            if (io) {
                io.to(`company:${companyId}`).emit('contract:signed', {
                    contractId, signatoryName: signatories[sigIdx].name, signatoryEmail: signatories[sigIdx].email,
                });
            }
            logger_1.logger.info('[WEMAS] Multi-sig: signatory signed', { companyId, contractId, signatoryEmail: signatories[sigIdx].email, allSigned });
            return { success: true, message: allSigned ? 'Contrat entierement signe !' : `Signature enregistree (${signatories.filter(s => s.signedAt).length}/${signatories.length})` };
        }
        // Single signatory (backward compat)
        await this.updateContract(companyId, contractId, {
            status: 'signed',
            signatureData,
            signedAt: now,
            signatureIp: ip,
            signatureUserAgent: userAgent,
        });
        // Emit real-time notification
        const io = getIO();
        if (io) {
            io.to(`company:${companyId}`).emit('contract:signed', {
                contractId, signatoryName: contract.signatoryName, signatoryEmail: contract.signatoryEmail,
            });
        }
        logger_1.logger.info('[WEMAS] Contract signed', { companyId, contractId });
        return { success: true, message: 'Contrat signe avec succes' };
    }
    async sendForSignature(companyId, contractId) {
        const contract = await this.getContract(companyId, contractId);
        if (!contract)
            throw new Error('Contrat introuvable');
        await this.updateContract(companyId, contractId, { status: 'pending_signature' });
        return contract.uniqueLink;
    }
    async deleteContract(companyId, contractId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'contracts')).doc(contractId).delete();
    }
    async getStats(companyId) {
        const contracts = await this.listContracts(companyId);
        const now = new Date();
        // Auto-expire
        for (const c of contracts) {
            if (c.status === 'pending_signature' && c.expiresAt && new Date(c.expiresAt) < now) {
                await this.updateContract(companyId, c.id, { status: 'expired' }).catch(() => { });
                c.status = 'expired';
            }
        }
        return {
            total: contracts.length,
            draft: contracts.filter(c => c.status === 'draft').length,
            pending: contracts.filter(c => c.status === 'pending_signature').length,
            signed: contracts.filter(c => c.status === 'signed').length,
            expired: contracts.filter(c => c.status === 'expired').length,
        };
    }
    // ════════════════════════════════════════════════════════════════════════════
    // TEMPLATES
    // ════════════════════════════════════════════════════════════════════════════
    // CONTRACT COMMENTS (internal team discussion)
    // ════════════════════════════════════════════════════════════════════════════
    async listComments(companyId, contractId) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            const snap = await db.collection(col(companyId, 'contractComments'))
                .where('contractId', '==', contractId)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        catch {
            return [];
        }
    }
    async addComment(companyId, data) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(col(companyId, 'contractComments')).doc();
        await ref.set({ ...data, createdAt: new Date().toISOString() });
        return { id: ref.id };
    }
    async deleteComment(companyId, commentId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'contractComments')).doc(commentId).delete();
    }
    // ════════════════════════════════════════════════════════════════════════════
    // TEMPLATES
    // ════════════════════════════════════════════════════════════════════════════
    async listTemplates(companyId) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            const snap = await db.collection(col(companyId, 'contractTemplates'))
                .where('isActive', '==', true)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        catch {
            return [];
        }
    }
    async createTemplate(companyId, data) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(col(companyId, 'contractTemplates')).doc();
        const template = {
            id: ref.id,
            companyId,
            ...data,
            createdAt: new Date().toISOString(),
        };
        await ref.set(template);
        return template;
    }
    async updateTemplate(companyId, templateId, updates) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'contractTemplates')).doc(templateId)
            .update({ ...updates, updatedAt: new Date().toISOString() });
    }
    async deleteTemplate(companyId, templateId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'contractTemplates')).doc(templateId).delete();
    }
    // ════════════════════════════════════════════════════════════════════════════
    // PORTFOLIO DOCUMENTS
    // ════════════════════════════════════════════════════════════════════════════
    async listDocuments(companyId, signatoryEmail) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            const snap = await db.collection(col(companyId, 'portfolioDocuments'))
                .where('signatoryEmail', '==', signatoryEmail)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        catch {
            return [];
        }
    }
    async addDocument(companyId, doc) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(col(companyId, 'portfolioDocuments')).doc();
        const document = {
            id: ref.id,
            companyId,
            ...doc,
            createdAt: new Date().toISOString(),
        };
        const toWrite = Object.fromEntries(Object.entries(document).filter(([, v]) => v !== undefined));
        await ref.set(toWrite);
        return document;
    }
    async deleteDocument(companyId, documentId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'portfolioDocuments')).doc(documentId).delete();
    }
    // ════════════════════════════════════════════════════════════════════════════
    // PORTFOLIO NOTES
    // ════════════════════════════════════════════════════════════════════════════
    async listNotes(companyId, signatoryEmail) {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            const snap = await db.collection(col(companyId, 'portfolioNotes'))
                .where('signatoryEmail', '==', signatoryEmail)
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        catch {
            return [];
        }
    }
    async addNote(companyId, data) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(col(companyId, 'portfolioNotes')).doc();
        const now = new Date().toISOString();
        const note = {
            id: ref.id,
            companyId,
            signatoryEmail: data.signatoryEmail,
            content: data.content,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now,
        };
        await ref.set(note);
        return note;
    }
    async updateNote(companyId, noteId, content) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'portfolioNotes')).doc(noteId)
            .update({ content, updatedAt: new Date().toISOString() });
    }
    async deleteNote(companyId, noteId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'portfolioNotes')).doc(noteId).delete();
    }
    // ════════════════════════════════════════════════════════════════════════════
    // DOCUMENT UPLOAD REQUESTS (public links)
    // ════════════════════════════════════════════════════════════════════════════
    async createUploadRequest(companyId, data) {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(col(companyId, 'documentUploadRequests')).doc();
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const request = {
            id: ref.id,
            companyId,
            signatoryEmail: data.signatoryEmail,
            signatoryName: data.signatoryName,
            requestedTypes: data.requestedTypes,
            message: data.message ?? '',
            token,
            expiresAt: data.expiresInDays
                ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
                : undefined,
            createdBy: data.createdBy,
            createdAt: new Date().toISOString(),
        };
        // Strip undefined — Firestore rejects them without ignoreUndefinedProperties setting
        const toWrite = Object.fromEntries(Object.entries(request).filter(([, v]) => v !== undefined));
        await ref.set(toWrite);
        return request;
    }
    async getUploadRequestByToken(token) {
        const db = (0, firebase_config_1.getFirestore)();
        // Try collection group first (fast path)
        try {
            const snap = await db.collectionGroup('documentUploadRequests')
                .where('token', '==', token)
                .limit(1)
                .get();
            if (!snap.empty) {
                return { id: snap.docs[0].id, ...snap.docs[0].data() };
            }
        }
        catch { /* fallthrough */ }
        // Fallback: scan all companies (for when collection-group index is missing
        // or the doc was written by HR agent using its token as doc ID).
        try {
            const companies = await db.collection('companies').select().get();
            for (const c of companies.docs) {
                // a) direct doc lookup by token (HR agent pattern: token == docId)
                const direct = await db.collection(`companies/${c.id}/documentUploadRequests`).doc(token).get();
                if (direct.exists)
                    return { id: direct.id, ...direct.data() };
                // b) query on subcollection
                const sub = await db.collection(`companies/${c.id}/documentUploadRequests`)
                    .where('token', '==', token).limit(1).get();
                if (!sub.empty)
                    return { id: sub.docs[0].id, ...sub.docs[0].data() };
            }
        }
        catch { /* noop */ }
        return null;
    }
    async deleteUploadRequest(companyId, requestId) {
        const db = (0, firebase_config_1.getFirestore)();
        await db.collection(col(companyId, 'documentUploadRequests')).doc(requestId).delete();
    }
    // ════════════════════════════════════════════════════════════════════════════
    // PORTFOLIOS (aggregated view)
    // ════════════════════════════════════════════════════════════════════════════
    async getPortfolios(companyId) {
        const contracts = await this.listContracts(companyId, { status: 'signed' });
        const map = new Map();
        for (const c of contracts) {
            const key = c.signatoryEmail.toLowerCase();
            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    signatoryName: c.signatoryName,
                    signatoryEmail: c.signatoryEmail,
                    signatoryPhone: c.signatoryPhone,
                    signatoryAddress: c.signatoryAddress,
                    contractCount: 1,
                    lastSignedAt: c.signedAt,
                });
            }
            else {
                existing.contractCount++;
                if (c.signedAt && (!existing.lastSignedAt || c.signedAt > existing.lastSignedAt)) {
                    existing.lastSignedAt = c.signedAt;
                }
            }
        }
        return Array.from(map.values()).sort((a, b) => a.signatoryName.localeCompare(b.signatoryName));
    }
}
exports.WemasService = WemasService;
exports.wemasService = new WemasService();
//# sourceMappingURL=wemasService.js.map