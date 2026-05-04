import { create } from 'zustand';

export interface CompanyUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  companyId: string;
  role: 'admin' | 'manager' | 'employee';
  superAdmin?: boolean;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  companyCode?: string;
  ownerId: string;
  plan: string;
  selectedAgents?: string[];
  onboardingCompleted?: boolean;
  // ── Branding used by PDFs (devis, factures, contrats, rapports)
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;      // SIRET, RCS, NIF, etc.
  legalForm?: string;  // SARL, SAS, EURL, NGO, etc.
  settings: {
    language: string;
    aiPersonality: string;
    systemContext?: string;
    timezone?: string;
    maxTokens?: number;
    temperature?: number;
    aiLanguage?: string;
  };
  createdAt: Date;
}

interface AuthState {
  user: CompanyUser | null;
  company: Company | null;
  isLoading: boolean;
  setUser: (user: CompanyUser | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setCompany: (company) => set({ company }),
  setLoading: (isLoading) => set({ isLoading }),
}));
