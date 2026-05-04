export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CompanyDocument {
  id: string;
  companyId: string;
  originalName: string;
  storagePath: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  chunksCreated?: number;
  uploadedBy: string;
  uploadedAt: Date;
  processedAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessingJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}
