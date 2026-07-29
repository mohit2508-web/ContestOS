export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  ORG_MEMBER: 'ORG_MEMBER',
  EVALUATOR: 'EVALUATOR',
  STUDENT: 'STUDENT',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export const HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 1,
  ORG_ADMIN: 2,
  ORG_MEMBER: 3,
  EVALUATOR: 4,
  STUDENT: 5,
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Owner',
  ORG_ADMIN: 'Organizer Admin',
  ORG_MEMBER: 'Organizer Member',
  EVALUATOR: 'Evaluator / Judge',
  STUDENT: 'Participant',
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-600',
  ORG_ADMIN: 'bg-blue-600',
  ORG_MEMBER: 'bg-purple-600',
  EVALUATOR: 'bg-cyan-600',
  STUDENT: 'bg-emerald-600',
};

export const ROLE_BADGE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ORG_ADMIN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ORG_MEMBER: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  EVALUATOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  STUDENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
