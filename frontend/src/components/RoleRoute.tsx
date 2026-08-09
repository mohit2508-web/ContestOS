import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: string;
}

export function RoleRoute({ children, allowedRoles, fallback = '/dashboard' }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is not super_admin / platform author and is offboarded/unattached to an organization, block staff routes
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_CONTENT_AUTHOR' && !user.organizationId && user.role !== 'STUDENT' && user.role !== 'CANDIDATE') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
