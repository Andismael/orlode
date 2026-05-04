/**
 * AgentAccessGuard — wrap a route/component to ensure the user has access
 * to a specific agent. Falls back to redirect or a friendly "Access denied" page.
 */
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAgentRolesStore } from '@/store/agentRolesStore';

interface Props {
  agentId: string;
  requireAdmin?: boolean;
  children: ReactNode;
  /** If true, show an inline "access denied" card instead of redirecting */
  inline?: boolean;
}

export default function AgentAccessGuard({ agentId, requireAdmin, children, inline }: Props) {
  const { loaded, hasAccess, isAdmin } = useAgentRolesStore();
  if (!loaded) return null;

  const authorized = requireAdmin ? isAdmin(agentId) : hasAccess(agentId);
  if (authorized) return <>{children}</>;

  if (inline) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-rose-50 items-center justify-center mb-4">
          <ShieldAlert size={28} className="text-rose-500" />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1">Accès refusé</h2>
        <p className="text-sm text-gray-500">
          {requireAdmin
            ? "Cette section est réservée aux administrateurs de cet agent."
            : "Tu n'as pas accès à cet agent. Demande à un administrateur."}
        </p>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}
