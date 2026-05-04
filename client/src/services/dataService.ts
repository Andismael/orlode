import api from './api';
import type { CompanyDocument } from '@/types/data.types';

export const dataService = {
  async uploadDocument(file: File, companyId: string): Promise<CompanyDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);

    const res = await api.post<CompanyDocument>('/data/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minutes for large files
    });

    const doc = res.data;
    return {
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
      processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
    };
  },

  async getDocuments(companyId: string): Promise<CompanyDocument[]> {
    const res = await api.get<CompanyDocument[]>(`/data/documents?companyId=${companyId}`);
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((doc) => ({
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
      processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
    }));
  },

  async deleteDocument(documentId: string): Promise<void> {
    await api.delete(`/data/documents/${documentId}`);
  },

  async reprocessDocument(documentId: string): Promise<void> {
    await api.post(`/data/documents/${documentId}/reprocess`);
  },

  async getDocumentStatus(documentId: string): Promise<{ status: string; chunksCreated?: number }> {
    const res = await api.get<{ status: string; chunksCreated?: number }>(`/data/documents/${documentId}/status`);
    return res.data;
  },
};
