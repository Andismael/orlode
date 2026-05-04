/**
 * WEMAS — Service de gestion des contrats enrichi
 * Signature electronique, portfolios, templates, depot de documents
 * Migre depuis le projet WEMAS standalone (Supabase → Firebase)
 */
import { createHash, randomBytes } from 'crypto';
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
// Lazy import io to avoid circular dependency
let _io: any = null;
function getIO() {
  if (!_io) { try { _io = require('../../app').io; } catch { /* not available yet */ } }
  return _io;
}
import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'rejected' | 'expired';
export type ContractType =
  | 'prestation_services' | 'partenariat' | 'nda' | 'licence'
  | 'cdi' | 'cdd' | 'stage' | 'freelance'
  | 'custom';
export type MainContractType = 'prestation' | 'standard' | 'custom';
export type PartyRole = 'client' | 'provider' | 'employee' | 'employer' | 'witness' | 'other';

export interface WemasContract {
  id: string;
  companyId: string;
  uniqueLink: string;

  signatoryName: string;
  signatoryEmail: string;
  signatoryPhone?: string;
  signatoryAddress?: string;

  contractContent: string;
  contractType: ContractType;
  mainContractType: MainContractType;
  templateId?: string;

  importedFileUrl?: string;
  importedFileName?: string;
  importedFileType?: string;

  senderName?: string;
  senderSignatureData?: string;
  senderSignedAt?: string;

  // Single signatory (backward compat)
  signatureData?: string;
  signedAt?: string;
  signatureIp?: string;
  signatureUserAgent?: string;

  // Multi-signature support
  signatories?: ContractSignatory[];

  status: ContractStatus;
  expiresAt?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ContractSignatory {
  name: string;
  email: string;
  role: PartyRole;
  signatureLink: string;       // unique link per signatory
  signatureData?: string;
  signedAt?: string;
  signatureIp?: string;
  signatureUserAgent?: string;
}

export interface ContractTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  templateContent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PortfolioDocument {
  id: string;
  companyId: string;
  signatoryEmail: string;
  signatoryName: string;
  documentType: string;
  label: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadRequestToken?: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface PortfolioNote {
  id: string;
  companyId: string;
  signatoryEmail: string;
  content: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadRequest {
  id: string;
  companyId: string;
  signatoryEmail: string;
  signatoryName: string;
  requestedTypes: string[];
  message: string;
  token: string;
  expiresAt?: string;
  createdBy?: string;
  createdAt: string;
}

// ── Helper ───────────────────────────────────────────────────────────────────

function col(companyId: string, sub: string) {
  return `companies/${companyId}/${sub}`;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class WemasService {

  // ════════════════════════════════════════════════════════════════════════════
  // CONTRACTS
  // ════════════════════════════════════════════════════════════════════════════

  async createContract(input: {
    companyId: string;
    createdBy?: string;
    signatoryName: string;
    signatoryEmail: string;
    signatoryPhone?: string;
    signatoryAddress?: string;
    contractContent: string;
    contractType: ContractType;
    mainContractType: MainContractType;
    templateId?: string;
    importedFileUrl?: string;
    importedFileName?: string;
    importedFileType?: string;
    senderName?: string;
    senderSignatureData?: string;
    expiresInDays?: number;
    tags?: string[];
    status?: ContractStatus;
    additionalSignatories?: Array<{ name: string; email: string; role?: PartyRole }>;
  }): Promise<WemasContract> {
    const db = getFirestore();
    const ref = db.collection(col(input.companyId, 'contracts')).doc();
    const uniqueLink = randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    // Build signatories array (primary + additional)
    const signatories: ContractSignatory[] = [
      {
        name: input.signatoryName,
        email: input.signatoryEmail,
        role: 'client',
        signatureLink: uniqueLink,
      },
      ...(input.additionalSignatories ?? []).map(s => ({
        name: s.name,
        email: s.email,
        role: s.role ?? 'other' as PartyRole,
        signatureLink: randomBytes(32).toString('hex'),
      })),
    ];

    const contract: WemasContract = {
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
        ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
        : undefined,
      tags: input.tags ?? [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(contract);
    logger.info('[WEMAS] Contract created', { companyId: input.companyId, contractId: ref.id, uniqueLink, signatoryCount: signatories.length });
    return contract;
  }

  async listContracts(companyId: string, filters?: { status?: ContractStatus; type?: ContractType }): Promise<WemasContract[]> {
    try {
      const db = getFirestore();
      let query = db.collection(col(companyId, 'contracts')) as FirebaseFirestore.Query;
      if (filters?.status) query = query.where('status', '==', filters.status);
      if (filters?.type) query = query.where('contractType', '==', filters.type);
      const snap = await query.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WemasContract));
    } catch { return []; }
  }

  async getContract(companyId: string, contractId: string): Promise<WemasContract | null> {
    try {
      const db = getFirestore();
      const doc = await db.collection(col(companyId, 'contracts')).doc(contractId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() } as WemasContract;
    } catch { return null; }
  }

  async getContractByUniqueLink(uniqueLink: string): Promise<WemasContract | null> {
    try {
      const db = getFirestore();
      // Try primary uniqueLink first
      let snap = await db.collectionGroup('contracts').where('uniqueLink', '==', uniqueLink).limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as WemasContract;

      // Try signatories[].signatureLink (multi-signature)
      // collectionGroup doesn't support array-contains on nested fields,
      // so we do a broader search
      snap = await db.collectionGroup('contracts').where('status', '==', 'pending_signature').get();
      for (const doc of snap.docs) {
        const data = doc.data();
        const signatories = (data.signatories ?? []) as ContractSignatory[];
        if (signatories.some(s => s.signatureLink === uniqueLink)) {
          return { id: doc.id, ...data } as WemasContract;
        }
      }
      return null;
    } catch { return null; }
  }

  async updateContract(companyId: string, contractId: string, updates: Partial<WemasContract>): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'contracts')).doc(contractId)
      .update({ ...updates, updatedAt: new Date().toISOString() });
  }

  async signContract(
    companyId: string,
    contractId: string,
    signatureData: string,
    ip?: string,
    userAgent?: string,
    signingLink?: string,
  ): Promise<{ success: boolean; message: string }> {
    const contract = await this.getContract(companyId, contractId);
    if (!contract) return { success: false, message: 'Contrat introuvable' };
    if (contract.status !== 'pending_signature') return { success: false, message: 'Ce contrat n\'est pas en attente de signature' };
    if (contract.expiresAt && new Date() > new Date(contract.expiresAt)) {
      await this.updateContract(companyId, contractId, { status: 'expired' });
      return { success: false, message: 'Contrat expire' };
    }

    const now = new Date().toISOString();

    // Multi-signature: find which signatory is signing
    if (contract.signatories && contract.signatories.length > 0 && signingLink) {
      const signatories = [...contract.signatories];
      const sigIdx = signatories.findIndex(s => s.signatureLink === signingLink);
      if (sigIdx === -1) return { success: false, message: 'Lien de signature invalide' };
      if (signatories[sigIdx].signedAt) return { success: false, message: 'Deja signe' };

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
      logger.info('[WEMAS] Multi-sig: signatory signed', { companyId, contractId, signatoryEmail: signatories[sigIdx].email, allSigned });
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

    logger.info('[WEMAS] Contract signed', { companyId, contractId });
    return { success: true, message: 'Contrat signe avec succes' };
  }

  async sendForSignature(companyId: string, contractId: string): Promise<string> {
    const contract = await this.getContract(companyId, contractId);
    if (!contract) throw new Error('Contrat introuvable');
    await this.updateContract(companyId, contractId, { status: 'pending_signature' });
    return contract.uniqueLink;
  }

  async deleteContract(companyId: string, contractId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'contracts')).doc(contractId).delete();
  }

  async getStats(companyId: string): Promise<{ total: number; draft: number; pending: number; signed: number; expired: number }> {
    const contracts = await this.listContracts(companyId);
    const now = new Date();
    // Auto-expire
    for (const c of contracts) {
      if (c.status === 'pending_signature' && c.expiresAt && new Date(c.expiresAt) < now) {
        await this.updateContract(companyId, c.id, { status: 'expired' }).catch(() => {});
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

  async listComments(companyId: string, contractId: string): Promise<Array<{
    id: string; contractId: string; content: string; authorName: string; authorEmail: string; createdAt: string;
  }>> {
    try {
      const db = getFirestore();
      const snap = await db.collection(col(companyId, 'contractComments'))
        .where('contractId', '==', contractId)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch { return []; }
  }

  async addComment(companyId: string, data: {
    contractId: string; content: string; authorName: string; authorEmail: string;
  }): Promise<{ id: string }> {
    const db = getFirestore();
    const ref = db.collection(col(companyId, 'contractComments')).doc();
    await ref.set({ ...data, createdAt: new Date().toISOString() });
    return { id: ref.id };
  }

  async deleteComment(companyId: string, commentId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'contractComments')).doc(commentId).delete();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════════════════════

  async listTemplates(companyId: string): Promise<ContractTemplate[]> {
    try {
      const db = getFirestore();
      const snap = await db.collection(col(companyId, 'contractTemplates'))
        .where('isActive', '==', true)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ContractTemplate));
    } catch { return []; }
  }

  async createTemplate(companyId: string, data: Omit<ContractTemplate, 'id' | 'companyId' | 'createdAt'>): Promise<ContractTemplate> {
    const db = getFirestore();
    const ref = db.collection(col(companyId, 'contractTemplates')).doc();
    const template: ContractTemplate = {
      id: ref.id,
      companyId,
      ...data,
      createdAt: new Date().toISOString(),
    };
    await ref.set(template);
    return template;
  }

  async updateTemplate(companyId: string, templateId: string, updates: Partial<ContractTemplate>): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'contractTemplates')).doc(templateId)
      .update({ ...updates, updatedAt: new Date().toISOString() });
  }

  async deleteTemplate(companyId: string, templateId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'contractTemplates')).doc(templateId).delete();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PORTFOLIO DOCUMENTS
  // ════════════════════════════════════════════════════════════════════════════

  async listDocuments(companyId: string, signatoryEmail: string): Promise<PortfolioDocument[]> {
    try {
      const db = getFirestore();
      const snap = await db.collection(col(companyId, 'portfolioDocuments'))
        .where('signatoryEmail', '==', signatoryEmail)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioDocument));
    } catch { return []; }
  }

  async addDocument(companyId: string, doc: Omit<PortfolioDocument, 'id' | 'companyId' | 'createdAt'>): Promise<PortfolioDocument> {
    const db = getFirestore();
    const ref = db.collection(col(companyId, 'portfolioDocuments')).doc();
    const document: PortfolioDocument = {
      id: ref.id,
      companyId,
      ...doc,
      createdAt: new Date().toISOString(),
    };
    const toWrite = Object.fromEntries(
      Object.entries(document).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;
    await ref.set(toWrite);
    return document;
  }

  async deleteDocument(companyId: string, documentId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'portfolioDocuments')).doc(documentId).delete();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PORTFOLIO NOTES
  // ════════════════════════════════════════════════════════════════════════════

  async listNotes(companyId: string, signatoryEmail: string): Promise<PortfolioNote[]> {
    try {
      const db = getFirestore();
      const snap = await db.collection(col(companyId, 'portfolioNotes'))
        .where('signatoryEmail', '==', signatoryEmail)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioNote));
    } catch { return []; }
  }

  async addNote(companyId: string, data: { signatoryEmail: string; content: string; createdBy?: string }): Promise<PortfolioNote> {
    const db = getFirestore();
    const ref = db.collection(col(companyId, 'portfolioNotes')).doc();
    const now = new Date().toISOString();
    const note: PortfolioNote = {
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

  async updateNote(companyId: string, noteId: string, content: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'portfolioNotes')).doc(noteId)
      .update({ content, updatedAt: new Date().toISOString() });
  }

  async deleteNote(companyId: string, noteId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'portfolioNotes')).doc(noteId).delete();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DOCUMENT UPLOAD REQUESTS (public links)
  // ════════════════════════════════════════════════════════════════════════════

  async createUploadRequest(companyId: string, data: {
    signatoryEmail: string;
    signatoryName: string;
    requestedTypes: string[];
    message?: string;
    expiresInDays?: number;
    createdBy?: string;
  }): Promise<DocumentUploadRequest> {
    const db = getFirestore();
    const ref = db.collection(col(companyId, 'documentUploadRequests')).doc();
    const token = randomBytes(32).toString('hex');
    const request: DocumentUploadRequest = {
      id: ref.id,
      companyId,
      signatoryEmail: data.signatoryEmail,
      signatoryName: data.signatoryName,
      requestedTypes: data.requestedTypes,
      message: data.message ?? '',
      token,
      expiresAt: data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString()
        : undefined,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
    };
    // Strip undefined — Firestore rejects them without ignoreUndefinedProperties setting
    const toWrite = Object.fromEntries(
      Object.entries(request).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;
    await ref.set(toWrite);
    return request;
  }

  async getUploadRequestByToken(token: string): Promise<DocumentUploadRequest | null> {
    const db = getFirestore();
    // Try collection group first (fast path)
    try {
      const snap = await db.collectionGroup('documentUploadRequests')
        .where('token', '==', token)
        .limit(1)
        .get();
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as DocumentUploadRequest;
      }
    } catch { /* fallthrough */ }

    // Fallback: scan all companies (for when collection-group index is missing
    // or the doc was written by HR agent using its token as doc ID).
    try {
      const companies = await db.collection('companies').select().get();
      for (const c of companies.docs) {
        // a) direct doc lookup by token (HR agent pattern: token == docId)
        const direct = await db.collection(`companies/${c.id}/documentUploadRequests`).doc(token).get();
        if (direct.exists) return { id: direct.id, ...direct.data() } as DocumentUploadRequest;
        // b) query on subcollection
        const sub = await db.collection(`companies/${c.id}/documentUploadRequests`)
          .where('token', '==', token).limit(1).get();
        if (!sub.empty) return { id: sub.docs[0].id, ...sub.docs[0].data() } as DocumentUploadRequest;
      }
    } catch { /* noop */ }
    return null;
  }

  async deleteUploadRequest(companyId: string, requestId: string): Promise<void> {
    const db = getFirestore();
    await db.collection(col(companyId, 'documentUploadRequests')).doc(requestId).delete();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PORTFOLIOS (aggregated view)
  // ════════════════════════════════════════════════════════════════════════════

  async getPortfolios(companyId: string): Promise<Array<{
    signatoryName: string;
    signatoryEmail: string;
    signatoryPhone?: string;
    signatoryAddress?: string;
    contractCount: number;
    lastSignedAt?: string;
  }>> {
    const contracts = await this.listContracts(companyId, { status: 'signed' });
    const map = new Map<string, {
      signatoryName: string;
      signatoryEmail: string;
      signatoryPhone?: string;
      signatoryAddress?: string;
      contractCount: number;
      lastSignedAt?: string;
    }>();

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
      } else {
        existing.contractCount++;
        if (c.signedAt && (!existing.lastSignedAt || c.signedAt > existing.lastSignedAt)) {
          existing.lastSignedAt = c.signedAt;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.signatoryName.localeCompare(b.signatoryName));
  }
}

export const wemasService = new WemasService();
