/**
 * agentRolesStore — fetches & caches the current user's per-agent roles.
 * Used by Sidebar and agent pages to filter/enforce access.
 */
import { create } from 'zustand';
import api from '@/services/api';

export type AgentRole = 'admin' | 'user';

interface AgentRolesState {
  agentRoles: Record<string, AgentRole | null>;
  isOwner: boolean;
  legacyRole: string;
  loaded: boolean;
  load: () => Promise<void>;
  hasAccess: (agentId: string) => boolean;
  isAdmin: (agentId: string) => boolean;
}

export const useAgentRolesStore = create<AgentRolesState>((set, get) => ({
  agentRoles: {},
  isOwner: false,
  legacyRole: 'member',
  loaded: false,

  load: async () => {
    try {
      const r = await api.get('/team/my-agent-roles');
      const d = r.data as { agentRoles?: Record<string, AgentRole | null>; isOwner?: boolean; legacyRole?: string };
      set({
        agentRoles: d?.agentRoles ?? {},
        isOwner: d?.isOwner ?? false,
        legacyRole: d?.legacyRole ?? 'member',
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  hasAccess: (agentId: string) => {
    const s = get();
    if (s.isOwner || s.legacyRole === 'admin') return true;
    return Boolean(s.agentRoles[agentId]);
  },

  isAdmin: (agentId: string) => {
    const s = get();
    if (s.isOwner || s.legacyRole === 'admin') return true;
    return s.agentRoles[agentId] === 'admin';
  },
}));
