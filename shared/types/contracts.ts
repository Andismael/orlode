/**
 * Contract types — shared between client and server.
 * Migrated from WEMAS + enriched for Orlode.
 */

export type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'rejected' | 'expired';

export type ContractType =
  | 'prestation_services' | 'partenariat' | 'nda' | 'licence'       // Prestation
  | 'cdi' | 'cdd' | 'stage' | 'freelance'                           // Standard
  | 'custom';                                                         // Custom template

export type MainContractType = 'prestation' | 'standard' | 'custom';

export type PartyRole = 'client' | 'provider' | 'employee' | 'employer' | 'witness' | 'other';

export interface ContractParty {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: PartyRole;
  signedAt?: string;
  signatureData?: string;
  ipAddress?: string;
  userAgent?: string;
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

export interface Contract {
  id: string;
  companyId: string;
  uniqueLink: string;

  // Signataire principal
  signatoryName: string;
  signatoryEmail: string;
  signatoryPhone?: string;
  signatoryAddress?: string;

  // Contenu
  contractContent: string;
  contractType: ContractType;
  mainContractType: MainContractType;
  templateId?: string;

  // Fichier importe (PDF/Word)
  importedFileUrl?: string;
  importedFileName?: string;
  importedFileType?: string;

  // Signature emetteur (pre-signature)
  senderName?: string;
  senderSignatureData?: string;
  senderSignedAt?: string;

  // Signature destinataire
  signatureData?: string;
  signedAt?: string;
  signatureIp?: string;
  signatureUserAgent?: string;

  // Metadata
  status: ContractStatus;
  expiresAt?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface ContractStats {
  total: number;
  draft: number;
  pending: number;
  signed: number;
  expired: number;
}

export interface Portfolio {
  signatoryName: string;
  signatoryEmail: string;
  signatoryPhone?: string;
  signatoryAddress?: string;
  contracts: Contract[];
  documentCount?: number;
  noteCount?: number;
  lastSignedAt?: string;
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

// Document type labels and icons
export const DOCUMENT_TYPES = [
  { value: 'id_card', label: "Carte d'identite" },
  { value: 'passport', label: 'Passeport' },
  { value: 'driver_license', label: 'Permis de conduire' },
  { value: 'rib', label: 'RIB / IBAN' },
  { value: 'kbis', label: 'Kbis / Statuts' },
  { value: 'photo', label: 'Photo' },
  { value: 'autre', label: 'Autre document' },
] as const;

export const PRESTATION_CONTRACT_TYPES = [
  { value: 'prestation_services', label: 'Prestation de Services' },
  { value: 'partenariat', label: 'Accord de Partenariat' },
  { value: 'nda', label: 'Accord de Confidentialite (NDA)' },
  { value: 'licence', label: "Licence d'Exploitation" },
] as const;

export const STANDARD_CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI - Contrat a Duree Indeterminee' },
  { value: 'cdd', label: 'CDD - Contrat a Duree Determinee' },
  { value: 'stage', label: 'Convention de Stage' },
  { value: 'freelance', label: 'Contrat Freelance' },
] as const;

export const PROFILE_PHOTO_TYPE = 'profile_photo';
