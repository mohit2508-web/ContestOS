export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  username?: string;
  profileUsername?: string;
  avatar_url?: string;
  university?: string;
  department?: string;
  trust_score?: number;
  category?: string;
  problems_solved?: number;
  activity_score?: number;
  hasConnected?: boolean;
  score?: number;
  stats?: any;
}

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'ORG_MEMBER' | 'EVALUATOR' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
  organizationId?: string | null;
  hierarchyLevel?: number;
  username?: string;
  phone?: string;
  status?: string;
  lastLoginAt?: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: string;
    featureFlags?: Record<string, boolean>;
  };
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: UserRole;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  organizationId: string;
  invitedById: string;
  expiresAt: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  user: { name: string; email: string };
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  timestamp: string;
}

export interface Problem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: string;
  category: string;
  problemType: string;
  evaluationStrategy: string;
  starterCode?: any;
  testCases?: any[];
}

export interface Contest {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  difficulty: string;
  isPublic: boolean;
  requireSeb: boolean;
  requireFullscreen: boolean;
  preventTabSwitch: boolean;
  disableCopyPaste: boolean;
  enableProctoring: boolean;
  maxWarnings: number;
}
