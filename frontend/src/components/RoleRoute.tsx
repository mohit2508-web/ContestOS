import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ErrorState } from './common/ErrorState';
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
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <ErrorState
          variant="forbidden"
          title="Organization Membership Required"
          body="Your account is not assigned to an active organization. Request an admin invitation to unlock staff portals."
          onAction={() => window.location.href = '/portal'}
          ctaLabel="Return to Portal"
        />
      </div>
    );
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <ErrorState
          variant="forbidden"
          title="Access Restricted"
          body={`This section requires elevated permissions (${allowedRoles.join(', ')}). You are signed in as ${user.role}.`}
          onAction={() => window.location.href = '/portal'}
          ctaLabel="Return to Portal"
        />
      </div>
    );
  }

  return <>{children}</>;
}
