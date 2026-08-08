export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_CONTENT_AUTHOR: 'PLATFORM_CONTENT_AUTHOR',
  ORG_ADMIN: 'ORG_ADMIN',
  PROCTOR: 'PROCTOR',
  ORG_MEMBER: 'ORG_MEMBER',
  EVALUATOR: 'EVALUATOR',
  STUDENT: 'STUDENT',
  CANDIDATE: 'CANDIDATE',
  ANALYTICS_VIEWER: 'ANALYTICS_VIEWER',
  GUEST_CANDIDATE: 'GUEST_CANDIDATE',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  CONTEST_MODERATOR: 'CONTEST_MODERATOR',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

export const HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 1,
  PLATFORM_CONTENT_AUTHOR: 2,
  ORG_ADMIN: 3,
  PROCTOR: 4,
  ORG_MEMBER: 4,
  EVALUATOR: 4,
  CONTEST_MODERATOR: 4,
  COMPLIANCE_OFFICER: 4,
  ANALYTICS_VIEWER: 5,
  STUDENT: 6,
  CANDIDATE: 6,
  GUEST_CANDIDATE: 7,
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
  ANALYTICS_VIEWER: 'Analytics Viewer / HR Manager',
  GUEST_CANDIDATE: 'Guest Candidate',
  COMPLIANCE_OFFICER: 'Compliance & GDPR Officer',
  CONTEST_MODERATOR: 'Chief Examiner / Contest Moderator',
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
  ANALYTICS_VIEWER: 'bg-teal-600',
  GUEST_CANDIDATE: 'bg-zinc-600',
  COMPLIANCE_OFFICER: 'bg-red-600',
  CONTEST_MODERATOR: 'bg-orange-600',
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
  ANALYTICS_VIEWER: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  GUEST_CANDIDATE: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  COMPLIANCE_OFFICER: 'bg-red-500/10 text-red-400 border-red-500/20',
  CONTEST_MODERATOR: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};
