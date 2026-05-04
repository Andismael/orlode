// Common enums

export enum Language {
  FR = 'fr',
  EN = 'en',
  ES = 'es',
  DE = 'de',
  IT = 'it',
}

export enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  CSV = 'csv',
  TXT = 'txt',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type ID = string;

export interface Timestamps {
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}
