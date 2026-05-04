import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Loader } from '@/components/common/Loader';

interface AuthGuardProps {
  requireCompany?: boolean;
  requireRole?: string[];
  requireSuperAdmin?: boolean;
}

export default function AuthGuard({ requireCompany, requireRole, requireSuperAdmin }: AuthGuardProps) {
  const { user, company, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireSuperAdmin) {
    // Check superAdmin flag (stored in custom claims or user doc)
    const isSuperAdmin = (user as unknown as { superAdmin?: boolean }).superAdmin === true;
    if (!isSuperAdmin) return <Navigate to="/" replace />;
  }

  // If Firestore is unavailable companyId may be empty but user is still authenticated — allow through
  if (requireCompany && !company && !user?.companyId) return <Navigate to="/select-company" replace />;

  if (requireRole && requireRole.length > 0) {
    if (!requireRole.includes(user.role)) return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
