import { Timestamp } from 'firebase-admin/firestore';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CompanyDocument {
  id: string;
  companyId: string;
  originalName: string;
  storagePath: string;
  localPath?: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  chunksCreated?: number;
  uploadedBy: string;
  uploadedAt: Timestamp | Date;
  processedAt?: Timestamp | Date;
  error?: string;
  metadata?: Record<string, unknown>;
  vectorIds?: string[];
}
