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
  PLATFORM_CONTENT_AUTHOR: 'Platform Content SME / Author',
  ORG_ADMIN: 'Organizer Admin',
  PROCTOR: 'Live Exam Proctor',
  ORG_MEMBER: 'Organizer Member / Question Setter',
  EVALUATOR: 'Evaluator / Judge',
  STUDENT: 'Candidate',
  CANDIDATE: 'Candidate',
};
