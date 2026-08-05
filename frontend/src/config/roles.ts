export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_CONTENT_AUTHOR: 'PLATFORM_CONTENT_AUTHOR',
  ORG_ADMIN: 'ORG_ADMIN',
  PROCTOR: 'PROCTOR',
  ORG_MEMBER: 'ORG_MEMBER',
  EVALUATOR: 'EVALUATOR',
  STUDENT: 'STUDENT',
  CANDIDATE: 'CANDIDATE',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export const HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 1,
  PLATFORM_CONTENT_AUTHOR: 2,
  ORG_ADMIN: 3,
  PROCTOR: 4,
  ORG_MEMBER: 5,
  EVALUATOR: 6,
  STUDENT: 7,
  CANDIDATE: 7,
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Business Owner',
  PLATFORM_CONTENT_AUTHOR: 'Platform Content SME',
  ORG_ADMIN: 'Organizer Admin',
  PROCTOR: 'Live Exam Proctor',
  ORG_MEMBER: 'Organizer Member / Question Setter',
  EVALUATOR: 'Evaluator / Judge',
  STUDENT: 'Candidate',
  CANDIDATE: 'Candidate',
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-600',
  PLATFORM_CONTENT_AUTHOR: 'bg-indigo-600',
  ORG_ADMIN: 'bg-blue-600',
  PROCTOR: 'bg-rose-600',
  ORG_MEMBER: 'bg-purple-600',
  EVALUATOR: 'bg-cyan-600',
  STUDENT: 'bg-emerald-600',
  CANDIDATE: 'bg-emerald-600',
};

export const ROLE_BADGE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PLATFORM_CONTENT_AUTHOR: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  ORG_ADMIN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PROCTOR: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  ORG_MEMBER: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  EVALUATOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  STUDENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANDIDATE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
