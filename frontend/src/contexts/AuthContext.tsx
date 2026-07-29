import React, { createContext, useContext, useState, useCallback } from 'react';
import type { UserRole } from '../types';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  hierarchyLevel: number;
  organization?: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: string;
    featureFlags?: Record<string, boolean>;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string, userData: User) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  hasMinLevel: (level: number) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isOrgMember: boolean;
  isParticipant: boolean;
  isEvaluator: boolean;
}

let accessTokenMemory: string | null = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

export function getAccessToken(): string | null {
  return accessTokenMemory || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  login: () => {},
  logout: () => {},
  hasRole: () => false,
  hasMinLevel: () => false,
  isAdmin: false,
  isSuperAdmin: false,
  isOrgAdmin: false,
  isOrgMember: false,
  isParticipant: false,
  isEvaluator: false,
});

if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenParam = urlParams.get('token');
  const userParam = urlParams.get('user');
  if (tokenParam) {
    accessTokenMemory = tokenParam;
    localStorage.setItem('accessToken', tokenParam);
  }
  if (userParam) {
    try {
      const decodedUser = decodeURIComponent(userParam);
      localStorage.setItem('user', decodedUser);
    } catch (e) {}
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      const userParam = urlParams.get('user');
      if (tokenParam) {
        accessTokenMemory = tokenParam;
        localStorage.setItem('accessToken', tokenParam);
      }
      if (userParam) {
        try {
          const decodedUser = decodeURIComponent(userParam);
          localStorage.setItem('user', decodedUser);
          return JSON.parse(decodedUser);
        } catch (e) {}
      }
    }
    const saved = localStorage.getItem('user');
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });
  const [loading] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      const userParam = urlParams.get('user');
      if (tokenParam) {
        accessTokenMemory = tokenParam;
        localStorage.setItem('accessToken', tokenParam);
      }
      if (userParam) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(userParam));
          localStorage.setItem('user', JSON.stringify(parsedUser));
          setUser(parsedUser);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const login = useCallback((accessToken: string, refreshToken: string, userData: User) => {
    accessTokenMemory = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    accessTokenMemory = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role as UserRole);
  }, [user]);

  const hasMinLevel = useCallback((level: number) => {
    if (!user) return false;
    return (user.hierarchyLevel || 5) <= level;
  }, [user]);

  const hierarchyLevel = user?.hierarchyLevel || 5;

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    hasRole,
    hasMinLevel,
    isAdmin: hierarchyLevel <= 3,
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isOrgAdmin: user?.role === 'ORG_ADMIN',
    isOrgMember: user?.role === 'ORG_MEMBER',
    isParticipant: user?.role === 'STUDENT',
    isEvaluator: user?.role === 'EVALUATOR',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
