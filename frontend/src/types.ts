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

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
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
