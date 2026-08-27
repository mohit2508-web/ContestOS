
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  logoUrl: 'logoUrl',
  domain: 'domain',
  status: 'status',
  subscriptionTier: 'subscriptionTier',
  featureFlags: 'featureFlags',
  maxContests: 'maxContests',
  maxUsers: 'maxUsers',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  samlEnabled: 'samlEnabled',
  samlDomain: 'samlDomain',
  samlIdpEntityId: 'samlIdpEntityId',
  samlIdpSsoUrl: 'samlIdpSsoUrl',
  samlIdpCert: 'samlIdpCert'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  password: 'password',
  name: 'name',
  username: 'username',
  phone: 'phone',
  role: 'role',
  status: 'status',
  lastLoginAt: 'lastLoginAt',
  invitedById: 'invitedById',
  organizationId: 'organizationId',
  ssoProvider: 'ssoProvider',
  ssoId: 'ssoId',
  avatarUrl: 'avatarUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProblemScalarFieldEnum = {
  id: 'id',
  title: 'title',
  slug: 'slug',
  description: 'description',
  difficulty: 'difficulty',
  category: 'category',
  problemType: 'problemType',
  evaluationStrategy: 'evaluationStrategy',
  referenceSolution: 'referenceSolution',
  starterCode: 'starterCode',
  driverCode: 'driverCode',
  images: 'images',
  isPublic: 'isPublic',
  organizationId: 'organizationId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  aiCreditsRemaining: 'aiCreditsRemaining',
  aiCreditsMax: 'aiCreditsMax'
};

exports.Prisma.ProblemAiCreditLogScalarFieldEnum = {
  id: 'id',
  problemId: 'problemId',
  userId: 'userId',
  action: 'action',
  creditsDeducted: 'creditsDeducted',
  creditsRemaining: 'creditsRemaining',
  createdAt: 'createdAt'
};

exports.Prisma.TestCaseScalarFieldEnum = {
  id: 'id',
  problemId: 'problemId',
  input: 'input',
  expectedOutput: 'expectedOutput',
  isHidden: 'isHidden',
  order: 'order',
  createdAt: 'createdAt'
};

exports.Prisma.ContestScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  startTime: 'startTime',
  endTime: 'endTime',
  duration: 'duration',
  difficulty: 'difficulty',
  isPublic: 'isPublic',
  allowJoin: 'allowJoin',
  accessCode: 'accessCode',
  requireSeb: 'requireSeb',
  sebConfig: 'sebConfig',
  sebQuitPassword: 'sebQuitPassword',
  requireFullscreen: 'requireFullscreen',
  preventTabSwitch: 'preventTabSwitch',
  disableCopyPaste: 'disableCopyPaste',
  pasteMode: 'pasteMode',
  enableProctoring: 'enableProctoring',
  faceCheckEnabled: 'faceCheckEnabled',
  voiceCheckEnabled: 'voiceCheckEnabled',
  snapshotIntervalSeconds: 'snapshotIntervalSeconds',
  maxWarnings: 'maxWarnings',
  allowMultipleMonitors: 'allowMultipleMonitors',
  randomizeQuestionOrder: 'randomizeQuestionOrder',
  scoringMode: 'scoringMode',
  negativeMarkingEnabled: 'negativeMarkingEnabled',
  negativeMarkingValue: 'negativeMarkingValue',
  showLeaderboardDuringContest: 'showLeaderboardDuringContest',
  freezeLeaderboardMins: 'freezeLeaderboardMins',
  organizationId: 'organizationId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContestProblemScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  problemId: 'problemId',
  order: 'order',
  points: 'points',
  timeLimitOverride: 'timeLimitOverride'
};

exports.Prisma.ContestRegistrationScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  userId: 'userId',
  score: 'score',
  penalty: 'penalty',
  activeSessionToken: 'activeSessionToken',
  status: 'status',
  registeredAt: 'registeredAt'
};

exports.Prisma.SubmissionScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  problemId: 'problemId',
  userId: 'userId',
  code: 'code',
  language: 'language',
  status: 'status',
  executionTime: 'executionTime',
  memoryUsed: 'memoryUsed',
  score: 'score',
  testResults: 'testResults',
  evaluatedById: 'evaluatedById',
  evaluatedAt: 'evaluatedAt',
  evaluationComments: 'evaluationComments',
  submittedAt: 'submittedAt'
};

exports.Prisma.ProctoringLogScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  userId: 'userId',
  eventType: 'eventType',
  details: 'details',
  timestamp: 'timestamp'
};

exports.Prisma.PlagiarismReportScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  similarityMap: 'similarityMap',
  createdAt: 'createdAt'
};

exports.Prisma.TeamInvitationScalarFieldEnum = {
  id: 'id',
  email: 'email',
  role: 'role',
  token: 'token',
  status: 'status',
  organizationId: 'organizationId',
  invitedById: 'invitedById',
  expiresAt: 'expiresAt',
  acceptedAt: 'acceptedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ContestAssignmentScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  userId: 'userId',
  assignedById: 'assignedById',
  role: 'role',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  organizationId: 'organizationId',
  action: 'action',
  resource: 'resource',
  resourceId: 'resourceId',
  details: 'details',
  timestamp: 'timestamp'
};

exports.Prisma.RefreshTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.OrganizationRequestScalarFieldEnum = {
  id: 'id',
  orgName: 'orgName',
  orgType: 'orgType',
  contactName: 'contactName',
  contactEmail: 'contactEmail',
  contactPhone: 'contactPhone',
  websiteUrl: 'websiteUrl',
  domain: 'domain',
  reason: 'reason',
  status: 'status',
  reviewedById: 'reviewedById',
  reviewNotes: 'reviewNotes',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
  industry: 'industry',
  orgSize: 'orgSize',
  linkedinOrgUrl: 'linkedinOrgUrl',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  gstNumber: 'gstNumber',
  panNumber: 'panNumber',
  cinNumber: 'cinNumber',
  regNumber: 'regNumber',
  taxId: 'taxId',
  aisheCode: 'aisheCode',
  nirfRanking: 'nirfRanking',
  affiliatedTo: 'affiliatedTo',
  contactDesignation: 'contactDesignation',
  contactAlternateEmail: 'contactAlternateEmail',
  domainMismatchReason: 'domainMismatchReason',
  useCases: 'useCases',
  expectedCandidates: 'expectedCandidates',
  preferredFormat: 'preferredFormat',
  hearAboutUs: 'hearAboutUs',
  referralCode: 'referralCode',
  dpaAgreed: 'dpaAgreed',
  certifiedRepresentative: 'certifiedRepresentative'
};

exports.Prisma.ContestSectionScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  title: 'title',
  sectionType: 'sectionType',
  order: 'order',
  duration: 'duration',
  sectionLocked: 'sectionLocked',
  weight: 'weight',
  negativeMarkingEnabled: 'negativeMarkingEnabled',
  negativeMarkingValue: 'negativeMarkingValue',
  problemIds: 'problemIds',
  instructions: 'instructions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuestionBankScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  scope: 'scope',
  organizationId: 'organizationId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuizPassageScalarFieldEnum = {
  id: 'id',
  sectionId: 'sectionId',
  title: 'title',
  passageType: 'passageType',
  content: 'content',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuizQuestionScalarFieldEnum = {
  id: 'id',
  sectionId: 'sectionId',
  passageId: 'passageId',
  bankId: 'bankId',
  questionType: 'questionType',
  reviewStatus: 'reviewStatus',
  content: 'content',
  imageUrl: 'imageUrl',
  difficulty: 'difficulty',
  category: 'category',
  topic: 'topic',
  subtopic: 'subtopic',
  points: 'points',
  negativeMarking: 'negativeMarking',
  randomizeOptions: 'randomizeOptions',
  explanation: 'explanation',
  version: 'version',
  parentQuestionId: 'parentQuestionId',
  allowPlatformSharing: 'allowPlatformSharing',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuestionVersionScalarFieldEnum = {
  id: 'id',
  questionId: 'questionId',
  versionNumber: 'versionNumber',
  contentSnapshot: 'contentSnapshot',
  changeSummary: 'changeSummary',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.QuestionReviewLogScalarFieldEnum = {
  id: 'id',
  questionId: 'questionId',
  reviewerId: 'reviewerId',
  fromStatus: 'fromStatus',
  toStatus: 'toStatus',
  comments: 'comments',
  createdAt: 'createdAt'
};

exports.Prisma.ContestAssemblyRuleScalarFieldEnum = {
  id: 'id',
  sectionId: 'sectionId',
  category: 'category',
  topic: 'topic',
  minDifficulty: 'minDifficulty',
  maxDifficulty: 'maxDifficulty',
  sampleCount: 'sampleCount',
  points: 'points',
  createdAt: 'createdAt'
};

exports.Prisma.QuizOptionScalarFieldEnum = {
  id: 'id',
  questionId: 'questionId',
  content: 'content',
  imageUrl: 'imageUrl',
  isCorrect: 'isCorrect',
  displayOrder: 'displayOrder'
};

exports.Prisma.QuizAttemptQuestionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  contestId: 'contestId',
  sectionId: 'sectionId',
  questionId: 'questionId',
  presentedOrder: 'presentedOrder',
  optionOrderMap: 'optionOrderMap',
  imageTransformApplied: 'imageTransformApplied',
  servedAt: 'servedAt'
};

exports.Prisma.QuizResponseScalarFieldEnum = {
  id: 'id',
  attemptQuestionId: 'attemptQuestionId',
  userId: 'userId',
  selectedOptionIds: 'selectedOptionIds',
  numericAnswer: 'numericAnswer',
  textAnswer: 'textAnswer',
  scratchpadData: 'scratchpadData',
  timeSpentMs: 'timeSpentMs',
  flaggedForReview: 'flaggedForReview',
  isCorrect: 'isCorrect',
  scoreAwarded: 'scoreAwarded',
  evaluationStatus: 'evaluationStatus',
  evaluatedById: 'evaluatedById',
  evaluatorNotes: 'evaluatorNotes',
  approvedById: 'approvedById',
  answeredAt: 'answeredAt',
  moderatorOverride: 'moderatorOverride',
  moderatedById: 'moderatedById',
  moderationReason: 'moderationReason',
  moderatedAt: 'moderatedAt'
};

exports.Prisma.QuizItemAnalyticsScalarFieldEnum = {
  id: 'id',
  questionId: 'questionId',
  totalAttempts: 'totalAttempts',
  correctAttempts: 'correctAttempts',
  avgTimeSpentMs: 'avgTimeSpentMs',
  pointBiserialCorr: 'pointBiserialCorr',
  calibratedDifficulty: 'calibratedDifficulty',
  updatedAt: 'updatedAt'
};

exports.Prisma.BreakGlassAuditLogScalarFieldEnum = {
  id: 'id',
  superAdminId: 'superAdminId',
  organizationId: 'organizationId',
  resourcePath: 'resourcePath',
  actionType: 'actionType',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.GuestInviteScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  email: 'email',
  name: 'name',
  token: 'token',
  guestUserId: 'guestUserId',
  usedAt: 'usedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.GdprErasureRequestScalarFieldEnum = {
  id: 'id',
  requestedByEmail: 'requestedByEmail',
  targetUserId: 'targetUserId',
  reason: 'reason',
  status: 'status',
  reviewedById: 'reviewedById',
  reviewNotes: 'reviewNotes',
  executedAt: 'executedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ContestModerationAssignmentScalarFieldEnum = {
  id: 'id',
  contestId: 'contestId',
  moderatorId: 'moderatorId',
  assignedById: 'assignedById',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  message: 'message',
  type: 'type',
  data: 'data',
  isRead: 'isRead',
  createdAt: 'createdAt'
};

exports.Prisma.MockInterviewSessionScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  scheduledAt: 'scheduledAt',
  durationMinutes: 'durationMinutes',
  accessCode: 'accessCode',
  accessCodePlain: 'accessCodePlain',
  status: 'status',
  currentPhase: 'currentPhase',
  phaseUnderstandMins: 'phaseUnderstandMins',
  planMins: 'planMins',
  codeMins: 'codeMins',
  optimizeMins: 'optimizeMins',
  allowHints: 'allowHints',
  allowObservers: 'allowObservers',
  interviewerId: 'interviewerId',
  candidateId: 'candidateId',
  candidateEmail: 'candidateEmail',
  problemId: 'problemId',
  organizationId: 'organizationId',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
  yjsDocumentId: 'yjsDocumentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InterviewParticipantScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  userId: 'userId',
  role: 'role',
  joinedAt: 'joinedAt',
  leftAt: 'leftAt'
};

exports.Prisma.InterviewFeedbackScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  problemUnderstandingScore: 'problemUnderstandingScore',
  algorithmDesignScore: 'algorithmDesignScore',
  codeQualityScore: 'codeQualityScore',
  communicationScore: 'communicationScore',
  edgeCaseHandlingScore: 'edgeCaseHandlingScore',
  recommendation: 'recommendation',
  privateNotes: 'privateNotes',
  candidateFeedback: 'candidateFeedback',
  evaluatedAt: 'evaluatedAt'
};

exports.Prisma.InterviewCodeSnapshotScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  code: 'code',
  language: 'language',
  phase: 'phase',
  snapshotAt: 'snapshotAt'
};

exports.Prisma.InterviewHintRequestScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  requestedAt: 'requestedAt',
  hintLevel: 'hintLevel',
  approved: 'approved',
  hintContent: 'hintContent'
};

exports.Prisma.InterviewExecutionResultScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  code: 'code',
  language: 'language',
  output: 'output',
  status: 'status',
  executedAt: 'executedAt'
};

exports.Prisma.AssistantSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  problemId: 'problemId',
  stage: 'stage',
  tokenBudget: 'tokenBudget',
  tokensUsed: 'tokensUsed',
  codeGenerated: 'codeGenerated',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CapturedAnswerScalarFieldEnum = {
  sessionId: 'sessionId',
  problemSummary: 'problemSummary',
  dsChoice: 'dsChoice',
  approach: 'approach'
};

exports.Prisma.AssistantTranscriptScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  turnIndex: 'turnIndex',
  role: 'role',
  stageAtTime: 'stageAtTime',
  message: 'message',
  gateResult: 'gateResult',
  tokensConsumed: 'tokensConsumed',
  llmCallType: 'llmCallType',
  createdAt: 'createdAt'
};

exports.Prisma.AssistantStageEventScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  fromStage: 'fromStage',
  toStage: 'toStage',
  eventType: 'eventType',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.AssistantCodeSnapshotScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  code: 'code',
  version: 'version',
  insertedAt: 'insertedAt',
  createdAt: 'createdAt'
};

exports.Prisma.CompanyVaultScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  companyName: 'companyName',
  brandColor: 'brandColor',
  logoUrl: 'logoUrl',
  targetCtc: 'targetCtc',
  examPattern: 'examPattern',
  description: 'description',
  accessCode: 'accessCode',
  accessCodePlain: 'accessCodePlain',
  expiresAt: 'expiresAt',
  isLocked: 'isLocked',
  organizationId: 'organizationId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompanyMaterialScalarFieldEnum = {
  id: 'id',
  vaultId: 'vaultId',
  title: 'title',
  materialType: 'materialType',
  contentUrl: 'contentUrl',
  dataJson: 'dataJson',
  order: 'order',
  createdAt: 'createdAt'
};

exports.Prisma.CompanyInterviewTranscriptScalarFieldEnum = {
  id: 'id',
  vaultId: 'vaultId',
  roleTitle: 'roleTitle',
  location: 'location',
  experience: 'experience',
  difficulty: 'difficulty',
  upvotes: 'upvotes',
  createdAt: 'createdAt'
};

exports.Prisma.CompanyAccessLogScalarFieldEnum = {
  id: 'id',
  vaultId: 'vaultId',
  userId: 'userId',
  unlockedAt: 'unlockedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.OrgStatus = exports.$Enums.OrgStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRIAL: 'TRIAL'
};

exports.SubscriptionTier = exports.$Enums.SubscriptionTier = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
};

exports.Role = exports.$Enums.Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_CONTENT_AUTHOR: 'PLATFORM_CONTENT_AUTHOR',
  ORG_ADMIN: 'ORG_ADMIN',
  PROCTOR: 'PROCTOR',
  ORG_MEMBER: 'ORG_MEMBER',
  STUDENT: 'STUDENT',
  CANDIDATE: 'CANDIDATE',
  EVALUATOR: 'EVALUATOR',
  ANALYTICS_VIEWER: 'ANALYTICS_VIEWER',
  GUEST_CANDIDATE: 'GUEST_CANDIDATE',
  COMPLIANCE_OFFICER: 'COMPLIANCE_OFFICER',
  CONTEST_MODERATOR: 'CONTEST_MODERATOR'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_INVITE: 'PENDING_INVITE'
};

exports.EvaluationStrategy = exports.$Enums.EvaluationStrategy = {
  EXACT_MATCH: 'EXACT_MATCH',
  UNORDERED_MATCH: 'UNORDERED_MATCH',
  FLOAT_TOLERANCE: 'FLOAT_TOLERANCE'
};

exports.SubmissionStatus = exports.$Enums.SubmissionStatus = {
  ACCEPTED: 'ACCEPTED',
  WRONG_ANSWER: 'WRONG_ANSWER',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  PENDING: 'PENDING',
  RUNNING: 'RUNNING'
};

exports.InvitationStatus = exports.$Enums.InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
};

exports.ContestMemberRole = exports.$Enums.ContestMemberRole = {
  CONTENT_EDITOR: 'CONTENT_EDITOR',
  PROCTOR: 'PROCTOR',
  EVALUATOR: 'EVALUATOR'
};

exports.OrgRequestStatus = exports.$Enums.OrgRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

exports.SectionType = exports.$Enums.SectionType = {
  QUIZ: 'QUIZ',
  CODING: 'CODING',
  WEB_DEV: 'WEB_DEV'
};

exports.BankScope = exports.$Enums.BankScope = {
  PLATFORM_GLOBAL: 'PLATFORM_GLOBAL',
  TENANT_PRIVATE: 'TENANT_PRIVATE',
  SHARED_CONTRIBUTED: 'SHARED_CONTRIBUTED'
};

exports.QuestionType = exports.$Enums.QuestionType = {
  SINGLE_SELECT: 'SINGLE_SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  TRUE_FALSE: 'TRUE_FALSE',
  NUMERIC: 'NUMERIC',
  CODE_OUTPUT: 'CODE_OUTPUT',
  FILL_BLANK: 'FILL_BLANK',
  IMAGE_PATTERN: 'IMAGE_PATTERN'
};

exports.QuestionReviewStatus = exports.$Enums.QuestionReviewStatus = {
  DRAFT: 'DRAFT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED'
};

exports.EvaluationStatus = exports.$Enums.EvaluationStatus = {
  UNGRADED: 'UNGRADED',
  EVALUATION_SUBMITTED: 'EVALUATION_SUBMITTED',
  RESULT_APPROVED: 'RESULT_APPROVED'
};

exports.InterviewStatus = exports.$Enums.InterviewStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

exports.InterviewPhase = exports.$Enums.InterviewPhase = {
  UNDERSTAND: 'UNDERSTAND',
  PLAN: 'PLAN',
  CODE: 'CODE',
  OPTIMIZE: 'OPTIMIZE',
  COMPLETED: 'COMPLETED'
};

exports.InterviewParticipantRole = exports.$Enums.InterviewParticipantRole = {
  INTERVIEWER: 'INTERVIEWER',
  CANDIDATE: 'CANDIDATE',
  OBSERVER: 'OBSERVER'
};

exports.Recommendation = exports.$Enums.Recommendation = {
  STRONG_HIRE: 'STRONG_HIRE',
  HIRE: 'HIRE',
  LEAN_HIRE: 'LEAN_HIRE',
  NO_HIRE: 'NO_HIRE'
};

exports.AssistantStage = exports.$Enums.AssistantStage = {
  PROBLEM: 'PROBLEM',
  DATA_STRUCTURE: 'DATA_STRUCTURE',
  APPROACH: 'APPROACH',
  AWAITING_CODE_REQUEST: 'AWAITING_CODE_REQUEST',
  CODE_GEN: 'CODE_GEN',
  REFINEMENT: 'REFINEMENT'
};

exports.Prisma.ModelName = {
  Organization: 'Organization',
  User: 'User',
  Problem: 'Problem',
  ProblemAiCreditLog: 'ProblemAiCreditLog',
  TestCase: 'TestCase',
  Contest: 'Contest',
  ContestProblem: 'ContestProblem',
  ContestRegistration: 'ContestRegistration',
  Submission: 'Submission',
  ProctoringLog: 'ProctoringLog',
  PlagiarismReport: 'PlagiarismReport',
  TeamInvitation: 'TeamInvitation',
  ContestAssignment: 'ContestAssignment',
  AuditLog: 'AuditLog',
  RefreshToken: 'RefreshToken',
  OrganizationRequest: 'OrganizationRequest',
  ContestSection: 'ContestSection',
  QuestionBank: 'QuestionBank',
  QuizPassage: 'QuizPassage',
  QuizQuestion: 'QuizQuestion',
  QuestionVersion: 'QuestionVersion',
  QuestionReviewLog: 'QuestionReviewLog',
  ContestAssemblyRule: 'ContestAssemblyRule',
  QuizOption: 'QuizOption',
  QuizAttemptQuestion: 'QuizAttemptQuestion',
  QuizResponse: 'QuizResponse',
  QuizItemAnalytics: 'QuizItemAnalytics',
  BreakGlassAuditLog: 'BreakGlassAuditLog',
  GuestInvite: 'GuestInvite',
  GdprErasureRequest: 'GdprErasureRequest',
  ContestModerationAssignment: 'ContestModerationAssignment',
  Notification: 'Notification',
  MockInterviewSession: 'MockInterviewSession',
  InterviewParticipant: 'InterviewParticipant',
  InterviewFeedback: 'InterviewFeedback',
  InterviewCodeSnapshot: 'InterviewCodeSnapshot',
  InterviewHintRequest: 'InterviewHintRequest',
  InterviewExecutionResult: 'InterviewExecutionResult',
  AssistantSession: 'AssistantSession',
  CapturedAnswer: 'CapturedAnswer',
  AssistantTranscript: 'AssistantTranscript',
  AssistantStageEvent: 'AssistantStageEvent',
  AssistantCodeSnapshot: 'AssistantCodeSnapshot',
  CompanyVault: 'CompanyVault',
  CompanyMaterial: 'CompanyMaterial',
  CompanyInterviewTranscript: 'CompanyInterviewTranscript',
  CompanyAccessLog: 'CompanyAccessLog'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
