import { Timestamp } from 'firebase-admin/firestore';

export interface CompanySettings {
  language: string;
  aiPersonality: 'professional' | 'friendly' | 'concise';
  systemContext?: string;
  timezone?: string;
  maxTokens?: number;
  temperature?: number;
  aiLanguage?: string;
  knowledgeAgentName?: string; // Custom name for the Knowledge agent (e.g. "Jarvis", "Nova", "Atlas")
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  settings: CompanySettings;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  logoUrl?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
}
