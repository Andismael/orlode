export type UserRole = 'admin' | 'manager' | 'employee';
export type CompanyPlan = 'trial' | 'starter' | 'professional' | 'enterprise';

export interface CompanySettings {
  language: string;
  aiPersonality: 'professional' | 'friendly' | 'concise';
  systemContext?: string;
  timezone?: string;
  maxTokens?: number;
  temperature?: number;
  aiLanguage?: string;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  plan: CompanyPlan;
  settings: CompanySettings;
  logoUrl?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface CompanyUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  companyId: string;
  role: UserRole;
  department?: string;
  jobTitle?: string;
  isActive: boolean;
  createdAt: string | Date;
}
