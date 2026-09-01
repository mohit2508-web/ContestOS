# Kryptavia OS — Complete Project Documentation

> **Version:** 1.0 | **Last Updated:** August 2026 | **Status:** Production-Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Value Proposition](#2-product-vision--value-proposition)
3. [Tech Stack & Infrastructure](#3-tech-stack--infrastructure)
4. [Project Architecture](#4-project-architecture)
5. [Directory Structure](#5-directory-structure)
6. [Database Schema — Complete Reference](#6-database-schema--complete-reference)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Backend API — Complete Route Reference](#8-backend-api--complete-route-reference)
9. [Backend Services — Detailed Breakdown](#9-backend-services--detailed-breakdown)
10. [Frontend — Complete Component & Page Reference](#10-frontend--complete-component--page-reference)
11. [Contest System — Deep Dive](#11-contest-system--deep-dive)
12. [Code Execution Engine](#12-code-execution-engine)
13. [Safe Exam Browser (SEB) Integration](#13-safe-exam-browser-seb-integration)
14. [Proctoring & Anti-Cheat System](#14-proctoring--anti-cheat-system)
15. [Quiz Instrument System](#15-quiz-instrument-system)
16. [Socratic AI Coding Assistant (Capgemini Stage 4)](#16-socratic-ai-coding-assistant-capgemini-stage-4)
17. [Mock Interview System](#17-mock-interview-system)
18. [Company Placement Vaults](#18-company-placement-vaults)
19. [SQL Playground](#19-sql-playground)
20. [Web Development Playground](#20-web-development-playground)
21. [Plagiarism Detection](#21-plagiarism-detection)
22. [Real-Time Socket Architecture](#22-real-time-socket-architecture)
23. [Landing Page & Marketing Site](#23-landing-page--marketing-site)
24. [Capgemini-Specific Features](#24-capgemini-specific-features)
25. [Role-Based Access Control (RBAC)](#25-role-based-access-control-rbac)
26. [Multi-Tenant SaaS Architecture](#26-multi-tenant-saas-architecture)
27. [Offline Support & Resilience](#27-offline-support--resilience)
28. [Deployment & DevOps](#28-deployment--devops)
29. [Environment Variables & Configuration](#29-environment-variables--configuration)
30. [API Error Handling & Status Codes](#30-api-error-handling--status-codes)
31. [Performance Optimizations](#31-performance-optimizations)
32. [Security Architecture](#32-security-architecture)
33. [Data Models — Relationship Diagram](#33-data-models--relationship-diagram)
34. [Testing Strategy](#34-testing-strategy)
35. [Git History & Development Timeline](#35-git-history--development-timeline)
36. [Non-Negotiable Invariants](#36-non-negotiable-invariants)
37. [Future Roadmap](#37-future-roadmap)

---

## 1. Executive Summary

**Kryptavia OS** is a full-stack, enterprise-grade **B2B online contest and assessment platform** built for universities, colleges, and companies. It is a production-ready SaaS product combining:

- **Codeforces-style competitive programming** with multi-language code execution
- **Safe Exam Browser (SEB)** deep integration with candidate-specific `.seb` config generation
- **Advanced anti-cheat & live proctoring** with webcam streaming, tab detection, and AI-based violation tracking
- **AI-Assisted Socratic Coding** — a guided stage-based AI coding assistant replicating Capgemini's new assessment format
- **Real-time live leaderboard** backed by Redis
- **Quiz instruments** with IRT analytics, 7+ question types, and passage-based questions
- **1-on-1 mock interviews** with collaborative IDE and structured feedback
- **Company placement vaults** with branded preparation materials
- **SQL, Web Dev, and Code playgrounds** with sandboxed execution
- **Multi-tenant SaaS** with organization branding, RBAC (12 roles), and SAML 2.0 SSO

### Key Metrics

| Metric | Value |
|--------|-------|
| Git Commits | 94 (main branch) |
| Backend Route Modules | 29 |
| Backend Services | 20+ |
| Frontend Components | 50+ |
| Frontend Pages | 40+ |
| Database Models | 38 |
| Database Enums | 14 |
| Supported Code Languages | 7 (C++, Java, Python, JS, Go, Rust, C#) |
| User Roles | 12 |
| Landing Page Sections | 10+ per audience |

---

## 2. Product Vision & Value Proposition

### Problem Statement
Colleges and companies conducting campus recruitment drives face fragmented tooling — separate platforms for coding tests, aptitude quizzes, proctoring, interview scheduling, and study material distribution. Students prepare with outdated material that doesn't match current exam formats.

### Solution
Kryptavia OS provides a **single, unified platform** covering the entire assessment lifecycle:

1. **Contest Assembly** — Faculty create contests with multi-section format (Quiz + Coding + Web Dev)
2. **Secure Delivery** — SEB lockdown, proctoring, fullscreen enforcement, copy-paste blocking
3. **Live Monitoring** — Proctor console with real-time webcam/screen streaming, violation alerts
4. **Automated Evaluation** — Multi-language code execution, partial credit scoring, plagiarism detection
5. **Analytics & Reporting** — Competency radar charts, score distributions, IRT analytics
6. **Placement Preparation** — Company-specific vaults with study material, mock interviews, AI-assisted coding

### Target Users

| Role | Description |
|------|-------------|
| **Super Admin** | Platform-level management, break-glass access, org oversight |
| **Org Admin** | College/company administration, user management, billing |
| **Contest Manager/Teacher** | Contest creation, problem authoring, question banking |
| **Proctor** | Live exam monitoring, candidate management, violation handling |
| **Evaluator** | Manual grading, evaluation queue, feedback |
| **Student/Candidate** | Contest participation, code submission, practice |
| **Analytics Viewer** | Read-only access to results, scorecards, dashboards |
| **Compliance Officer** | GDPR erasure requests, audit log access |
| **Contest Moderator** | Grade approval, score override, moderation |
| **Guest Candidate** | External invite-only contest participation |

---

## 3. Tech Stack & Infrastructure

### Backend

| Technology | Purpose | Version/Details |
|------------|---------|-----------------|
| **Node.js** | Runtime | ES2022 target |
| **Express** | HTTP framework | With middleware pipeline |
| **TypeScript** | Language | CommonJS modules |
| **Prisma** | ORM | Client generated to `../src/generated/client` |
| **CockroachDB** | Primary database | Distributed SQL, PostgreSQL-compatible |
| **Redis (ioredis)** | Caching & real-time | Graceful degradation if unavailable |
| **Socket.IO** | WebSockets | Proctor ↔ Student, Interview rooms |
| **bcryptjs** | Password hashing | 12 rounds |
| **jsonwebtoken** | Auth tokens | Access: 7d, Refresh: 30d |
| **Piston** | Code execution | `https://emkc.org/api/v2/piston` |
| **Judge0** | Code execution fallback | `ce.judge0.com` / RapidAPI |
| **Playwright** | Web dev evaluation | Headless Chrome, JSDOM failover |
| **sql.js** | SQL sandbox | WASM-based, 10k row limit |
| **node-sql-parser** | SQL AST validation | Injection/DoS prevention |
| **archiver / adm-zip** | Archive handling | Submission downloads |
| **pdfkit** | PDF generation | Reports, scorecards |
| **multer** | File uploads | 10MB limit |

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **TypeScript** | Language |
| **TailwindCSS** | Styling (custom dark theme) |
| **@monaco-editor/react** | Code editor (Monaco) |
| **@tanstack/react-query** | Server state management |
| **@tanstack/react-virtual** | Virtualized lists |
| **@xyflow/react** + **dagre** | SQL schema graph visualization |
| **framer-motion** | Animations |
| **socket.io-client** | Real-time communication |
| **lucide-react** | Icons |
| **d3-delaunay** | Data visualization |
| **perfect-freehand** | Drawing/whiteboard |
| **matter-js** | Physics animations (landing) |
| **react-window** | Virtualized scrolling |
| **axios** | HTTP client |

### Landing Page

| Technology | Purpose |
|------------|---------|
| **React + Vite** | Framework |
| **TailwindCSS** | Styling |
| **framer-motion** | Page transitions |
| **matter-js** | Physics-based intro animation |
| **GalaxyCanvas** | Cinematic star-field intro |
| **IceBreakOverlay** | Once-seen intro overlay |

### Deployment

| Service | Component |
|---------|-----------|
| **Vercel** | Frontend + Landing Page (SPA rewrite, immutable caching) |
| **Render** | Backend API (with anti-sleep self-pinger) |
| **CockroachDB** | Managed database |
| **Redis** | Managed cache |

---

## 4. Project Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Frontend  │  │ Landing Page │  │ SEB Browser      │  │
│  │ React SPA │  │ Marketing    │  │ (Locked Down)    │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│       │               │                    │             │
└───────┼───────────────┼────────────────────┼─────────────┘
        │               │                    │
        ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              EXPRESS API SERVER (Port 5000)              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Middleware Pipeline                               │ │
│  │  CORS → JSON Parser → Auth → RBAC → Rate Limit   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  REST Routes     │  │  Socket.IO Namespaces       │  │
│  │  (29 modules)    │  │  /quiz-timer                │  │
│  │                  │  │  /interview                  │  │
│  │                  │  │  /proctor                    │  │
│  └────────┬─────────┘  └─────────────┬──────────────┘  │
│           │                          │                  │
│  ┌────────▼──────────────────────────▼──────────────┐  │
│  │              SERVICES LAYER                       │  │
│  │  Code Executor │ Quiz Evaluator │ Proctoring      │  │
│  │  SQL Executor  │ SEB Generator  │ Plagiarism      │  │
│  │  WebDev Eval   │ AI Assistant   │ Assembly Engine │  │
│  └────────────────────────┬────────────────────────┘  │
│                           │                            │
│  ┌────────────────────────▼────────────────────────┐  │
│  │           DATA ACCESS LAYER                      │  │
│  │  Prisma ORM ──── Redis Cache ──── IndexedDB      │  │
│  └────────────────────────┬────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────┐
              │     CockroachDB      │
              │   (Distributed SQL)  │
              └──────────────────────┘
```

### Request Flow (Contest Participation)

```
Candidate Login → Access Code Gate → SEB Detection → System Check
    → Lobby (Boarding Pass, Environment Check, Liveness)
    → Contest Zone (Problems Tab → Code Editor → Submit)
    → Real-time Evaluation (Piston/Judge0)
    → Live Leaderboard Update (Redis → Socket.IO)
    → Proctor Monitoring (Webcam/Screen Stream → Proctor Console)
    → Auto-Submit on Timer End
    → Results & Analytics
```

### Request Flow (AI-Assisted Coding)

```
Candidate opens problem → AI Assistant Panel activates
    → Stage 1 (PROBLEM): "Describe the problem in your own words"
    → Gate Logic validates understanding depth
    → Stage 2 (DATA_STRUCTURE): "What data structure would you use?"
    → Gate Logic validates DS choice
    → Stage 3 (APPROACH): "Describe your algorithmic approach"
    → Gate Logic validates approach completeness
    → Stage 4 (CODE_GEN): Code generated with test harness
    → Stage 5 (REFINEMENT): Optimize and iterate
    → Token budget enforced (2000 per problem)
```

---

## 5. Directory Structure

```
ContestOS/
├── .gitignore
├── .vscode/
│   └── settings.json                     # Tailwind at-rule hints, schema settings
├── README.md                             # Product overview & quickstart
├── SEB_AND_PROCTORING_INVARIANTS.md      # Non-negotiable architectural rules
├── TESTING_DEPLOYMENT_GUIDE.md           # Staging/deploy checklist
├── PROJECT_DOCUMENTATION.md              # This file
│
├── backend/
│   ├── package.json                      # Backend dependencies
│   ├── tsconfig.json                     # ES2022/CommonJS, excludes utility scripts
│   ├── prisma/
│   │   ├── schema.prisma                 # Full database schema (1063 lines)
│   │   └── seed.ts                       # Organization + demo account seeding
│   ├── cockroach_backup_*.json           # Database backup artifacts
│   └── src/
│       ├── app.ts                        # Express entry, route mounts, sockets, health check
│       ├── generated/
│       │   └── client/                   # Prisma generated client (committed)
│       ├── config/
│       │   └── roles.ts                  # 8-role hierarchy definition
│       ├── lib/
│       │   ├── prisma.ts                 # Prisma client with heartbeat + retry wrapper
│       │   ├── redis.ts                  # Redis singleton with graceful degradation
│       │   ├── notifyUser.ts             # User notification helper
│       │   ├── notificationEmitter.ts    # SSE notification emitter
│       │   ├── securityLogger.ts         # Security event logging
│       │   ├── sanitize.ts               # Input sanitization
│       │   ├── safeParseInt.ts           # Safe integer parsing
│       │   ├── parsePageParams.ts        # Pagination parameter parsing
│       │   ├── jwtBlacklist.ts           # JWT blacklist for logout
│       │   └── cacheUtils.ts             # Redis cache utilities
│       ├── middlewares/
│       │   ├── auth.ts                   # JWT authentication middleware
│       │   ├── rbac.ts                   # Role-based access control
│       │   ├── breakGlassMiddleware.ts   # Super admin emergency access
│       │   ├── featureGate.ts            # Feature flag gating
│       │   ├── rateLimit.ts             # Rate limiting
│       │   ├── validateBody.ts          # Request body validation
│       │   └── verifySafeBrowser.ts     # SEB verification
│       ├── routes/                       # 29 route modules (see §8)
│       │   ├── auth.routes.ts
│       │   ├── sso.routes.ts
│       │   ├── org.routes.ts
│       │   ├── admin.routes.ts
│       │   ├── billing.routes.ts
│       │   ├── contests.routes.ts
│       │   ├── contest-manager.routes.ts
│       │   ├── problems.routes.ts
│       │   ├── submissions.routes.ts
│       │   ├── leaderboard.routes.ts
│       │   ├── guard.routes.ts
│       │   ├── code.routes.ts
│       │   ├── plagiarism.routes.ts
│       │   ├── webdev.routes.ts
│       │   ├── playground.routes.ts
│       │   ├── quiz.routes.ts
│       │   ├── question-governance.routes.ts
│       │   ├── proctor.routes.ts
│       │   ├── evaluator.routes.ts
│       │   ├── assignment.routes.ts
│       │   ├── org-request.routes.ts
│       │   ├── analytics-viewer.routes.ts
│       │   ├── guest.routes.ts
│       │   ├── compliance.routes.ts
│       │   ├── notification.routes.ts
│       │   ├── interview.routes.ts
│       │   ├── assistant.routes.ts
│       │   └── company-vault.routes.ts
│       ├── services/                     # 20+ services (see §9)
│       │   ├── externalCodeExecutor.ts
│       │   ├── code-execution.service.ts
│       │   ├── languageAdapter.ts
│       │   ├── codeTemplates.ts
│       │   ├── codeWrapperGenerator.ts
│       │   ├── sqlExecutor.ts
│       │   ├── quizEvaluator.ts
│       │   ├── quizMaterializer.ts
│       │   ├── questionAnalyticsEngine.ts
│       │   ├── contestAssemblyEngine.ts
│       │   ├── sectionConfigSchema.ts
│       │   ├── webDevEvaluator.ts
│       │   ├── webDevEvaluatorV2.ts
│       │   ├── previewRunnerService.ts
│       │   ├── problemAiCreditService.ts
│       │   ├── questionBankService.ts
│       │   ├── plagiarismDetector.ts
│       │   ├── proctoringService.ts
│       │   ├── sebConfigGenerator.ts
│       │   └── sebConfigService.ts
│       ├── sockets/
│       │   ├── quizTimerSocket.ts        # /quiz-timer namespace
│       │   └── interviewSocket.ts        # /interview namespace
│       ├── workers/
│       │   ├── quizAutosaveWorker.ts     # Batch flush QuizResponse every 3s
│       │   └── webDevWorker.ts           # Web dev evaluation worker
│       ├── seed_capgemini_lcm_problem.ts # Auto-seeds Capgemini LCM problem on boot
│       ├── data/
│       │   └── socraticQuestionBank.ts   # Full Socratic AI question bank (516 lines)
│       └── *.ts                          # 30+ utility/seed/test scripts
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts                    # Manual chunks, proxy config
│   ├── tailwind.config.js                # Dark theme, custom fonts
│   ├── vercel.json                       # SPA rewrite + immutable caching
│   ├── index.html                        # Mounts #root
│   ├── public/
│   │   └── capgemini_logo.svg            # Capgemini spade logo
│   └── src/
│       ├── main.tsx                       # ReactDOM.createRoot entry
│       ├── App.tsx                         # Router, all route definitions (388 lines)
│       ├── index.css                       # Global styles, CSS variables, bracket-panel motif
│       ├── types.ts                        # Shared TypeScript types
│       ├── config/
│       │   └── roles.ts                    # 12-role frontend config with colors
│       ├── contexts/
│       │   ├── AuthContext.tsx              # Auth state, token refresh, URL token injection
│       │   ├── SidebarContext.tsx           # Sidebar visibility toggle
│       │   └── ThemeContext.tsx             # Dark/light theme with localStorage
│       ├── services/
│       │   ├── api.ts                      # Axios instance with 401 refresh queue
│       │   ├── indexedDbService.ts          # IndexedDB offline answer storage
│       │   └── offlineStorage.ts           # Offline telemetry sync stub
│       ├── hooks/
│       │   └── useProctorSocket.ts         # Proctor WebSocket hook
│       ├── components/                     # 50+ components (see §10)
│       ├── pages/                          # 40+ pages (see §10)
│       ├── data/
│       │   ├── capgeminiAiLiteracyBank.ts  # 19 MCQ questions across 8 scenarios
│       │   └── socraticFallbackProblems.ts # Fallback problems for AI assistant
│       └── landing/
│           ├── LandingPageApp.tsx           # Embedded landing page for SPA
│           └── components/                  # Landing components shared with landing-page/
│
└── landing-page/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.tsx                          # Hash-based routing, GalaxyCanvas intro
        ├── GalaxyCanvas.tsx                 # Cinematic star-field animation
        ├── IceBreakOverlay.tsx              # Once-seen intro overlay
        ├── components/
        │   ├── shared/
        │   │   ├── Navbar.tsx               # Top nav with Capgemini announcement bar
        │   │   └── LiveJudgeSpeed.tsx       # Animated judge speed display
        │   ├── company/                     # Company landing sections
        │   │   ├── CompanyHero.tsx
        │   │   ├── CandidateExperience.tsx
        │   │   ├── ProctoringSection.tsx
        │   │   ├── TestProctoring.tsx
        │   │   ├── SampleReport.tsx
        │   │   ├── ROIBlock.tsx
        │   │   ├── TrustBar.tsx
        │   │   ├── HowItWorksCompany.tsx
        │   │   └── CompanyCTA.tsx
        │   └── college/                     # College landing sections
        │       ├── CollegeHero.tsx
        │       ├── ForOrganizers.tsx
        │       ├── ForStudents.tsx
        │       ├── InterCollegeLeaderboard.tsx
        │       ├── ContestGallery.tsx
        │       ├── ProblemShowcase.tsx
        │       ├── TemplateGallery.tsx
        │       ├── PlacementConnect.tsx
        │       ├── CertificatePreview.tsx
        │       └── CollegeCTA.tsx
        ├── pages/
        │   ├── CompanyPage.tsx
        │   ├── CollegePage.tsx
        │   ├── AboutPage.tsx
        │   ├── PricingPage.tsx
        │   └── SecurityPage.tsx
        └── lib/
            ├── physicsWorld.ts
            ├── shatter.ts
            └── portal.ts
```

---

## 6. Database Schema — Complete Reference

### Database: CockroachDB (Distributed SQL)

**Connection:** `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations)
**Prisma Client Output:** `../src/generated/client`

### Enums (14)

| Enum | Values | Purpose |
|------|--------|---------|
| `Role` | SUPER_ADMIN, PLATFORM_CONTENT_AUTHOR, ORG_ADMIN, PROCTOR, ORG_MEMBER, STUDENT, CANDIDATE, EVALUATOR, ANALYTICS_VIEWER, GUEST_CANDIDATE, COMPLIANCE_OFFICER, CONTEST_MODERATOR | User roles |
| `EvaluationStatus` | UNGRADED, EVALUATION_SUBMITTED, RESULT_APPROVED | Quiz evaluation state |
| `OrgStatus` | ACTIVE, SUSPENDED, TRIAL | Organization lifecycle |
| `SubscriptionTier` | FREE, PRO, ENTERPRISE | Billing tiers |
| `InvitationStatus` | PENDING, ACCEPTED, EXPIRED, REVOKED | Team invitation state |
| `UserStatus` | ACTIVE, SUSPENDED, PENDING_INVITE | User lifecycle |
| `ContestMemberRole` | CONTENT_EDITOR, PROCTOR, EVALUATOR | Contest team roles |
| `EvaluationStrategy` | EXACT_MATCH, UNORDERED_MATCH, FLOAT_TOLERANCE | Test case matching |
| `SubmissionStatus` | ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, COMPILATION_ERROR, PENDING, RUNNING | Code submission state |
| `SectionType` | QUIZ, CODING, WEB_DEV | Contest section types |
| `QuestionType` | SINGLE_SELECT, MULTI_SELECT, TRUE_FALSE, NUMERIC, CODE_OUTPUT, FILL_BLANK, IMAGE_PATTERN | Quiz question types |
| `BankScope` | PLATFORM_GLOBAL, TENANT_PRIVATE, SHARED_CONTRIBUTED | Question bank visibility |
| `QuestionReviewStatus` | DRAFT, UNDER_REVIEW, APPROVED, PUBLISHED, REJECTED | Question governance |
| `AssistantStage` | PROBLEM, DATA_STRUCTURE, APPROACH, AWAITING_CODE_REQUEST, CODE_GEN, REFINEMENT | AI assistant progression |
| `InterviewStatus` | SCHEDULED, LIVE, COMPLETED, CANCELLED | Interview lifecycle |
| `InterviewPhase` | UNDERSTAND, PLAN, CODE, OPTIMIZE, COMPLETED | Interview phases |
| `Recommendation` | STRONG_HIRE, HIRE, LEAN_HIRE, NO_HIRE | Interview outcome |
| `InterviewParticipantRole` | INTERVIEWER, CANDIDATE, OBSERVER | Interview roles |
| `OrgRequestStatus` | PENDING, APPROVED, REJECTED | Onboarding request state |

### Models (38) — Complete Reference

#### Core Platform Models

**Organization**
| Column | Type | Details |
|--------|------|---------|
| id | String (UUID) | Primary key |
| name | String | Organization name |
| slug | String | Unique slug |
| logoUrl | String? | Brand logo |
| domain | String? | Unique custom domain |
| status | OrgStatus | ACTIVE / SUSPENDED / TRIAL |
| subscriptionTier | SubscriptionTier | FREE / PRO / ENTERPRISE |
| featureFlags | Json? | Feature toggle map |
| maxContests | Int | Default 5 |
| maxUsers | Int | Default 50 |
| samlEnabled | Boolean | SAML 2.0 SSO toggle |
| samlDomain | String? | SAML domain |
| samlIdpEntityId | String? | IdP Entity ID |
| samlIdpSsoUrl | String? | IdP SSO URL |
| samlIdpCert | String? | IdP certificate |
| Relations | users, contests, problems, invitations, auditLogs, questionBanks, interviewSessions, companyVaults |

**User**
| Column | Type | Details |
|--------|------|---------|
| id | String (UUID) | Primary key |
| email | String | Unique |
| password | String | bcrypt-hashed |
| name | String | Display name |
| username | String? | Unique handle |
| phone | String? | Phone number |
| role | Role | Default STUDENT |
| status | UserStatus | Default ACTIVE |
| lastLoginAt | DateTime? | Last login timestamp |
| invitedById | String? | FK to inviter |
| organizationId | String? | FK to org |
| ssoProvider | String? | GOOGLE / GITHUB / LINKEDIN / SAML |
| ssoId | String? | Provider subject ID |
| avatarUrl | String? | Profile image |
| Relations | createdContests, createdProblems, registrations, submissions, proctoringLogs, invitedUsers, sentInvitations, contestAssignments, auditLogs, refreshTokens, scoredSubmissions, reviewedRequests, quizAttemptQuestions, quizResponses, questionReviews, breakGlassLogs, moderatorAssignments, notifications, interviewerSessions, candidateSessions, interviewParticipants, assistantSessions, problemAiCreditLogs, createdCompanyVaults, companyAccessLogs |

**Problem**
| Column | Type | Details |
|--------|------|---------|
| id | String (UUID) | Primary key |
| title | String | Problem title |
| slug | String | Unique slug |
| description | String | Full problem statement |
| difficulty | String | Easy / Medium / Hard |
| category | String | e.g., "Trees & Recursion" |
| problemType | String | "code" / "vibe-code" (AI-assisted) |
| evaluationStrategy | EvaluationStrategy | EXACT_MATCH default |
| referenceSolution | String? | Reference solution |
| starterCode | Json | Starter code per language |
| driverCode | Json? | Driver code per language |
| images | Json? | Problem images |
| isPublic | Boolean | Visibility flag |
| organizationId | String? | FK to org |
| createdById | String? | FK to creator |
| aiCreditsRemaining | Int | Default 2000 |
| aiCreditsMax | Int | Default 2000 |
| Relations | aiCreditLogs, testCases, contestProblems, submissions, interviewSessions |
| Indexes | [organizationId, isPublic], [createdById] |

**TestCase**
| Column | Type | Details |
|--------|------|---------|
| id | String (UUID) | Primary key |
| problemId | String | FK to problem (CASCADE) |
| input | String | Test input |
| expectedOutput | String | Expected output |
| isHidden | Boolean | Hidden from candidate |
| order | Int | Display order |

**Contest**
| Column | Type | Details |
|--------|------|---------|
| id | String (UUID) | Primary key |
| title | String | Contest title |
| description | String? | Description |
| startTime | DateTime | Start time |
| endTime | DateTime | End time |
| duration | Int | Duration in minutes |
| difficulty | String | Default "Medium" |
| isPublic | Boolean | Default true |
| allowJoin | Boolean | Default true |
| **Security Settings** | | |
| accessCode | String? | Entry passcode |
| requireSeb | Boolean | SEB lockdown toggle |
| sebConfig | String? | SEB config blob |
| sebQuitPassword | String? | SEB quit password |
| requireFullscreen | Boolean | Default true |
| preventTabSwitch | Boolean | Default true |
| disableCopyPaste | Boolean | Default true |
| pasteMode | String | "LOG_ONLY" default |
| enableProctoring | Boolean | Live proctoring toggle |
| faceCheckEnabled | Boolean | Webcam face check |
| voiceCheckEnabled | Boolean | Voice check |
| snapshotIntervalSeconds | Int | Default 45 |
| maxWarnings | Int | Default 3 |
| allowMultipleMonitors | Boolean | Default false |
| randomizeQuestionOrder | Boolean | Shuffle questions |
| **Scoring Config** | | |
| scoringMode | String | PARTIAL / BINARY / ACM / DYNAMIC |
| negativeMarkingEnabled | Boolean | Default false |
| negativeMarkingValue | Float | Default 0.25 |
| showLeaderboardDuringContest | Boolean | Default true |
| freezeLeaderboardMins | Int | Default 0 (never freeze) |
| Relations | problems, registrations, submissions, proctoringLogs, plagiarismReports, assignments, sections, quizAttemptQuestions, guestInvites, moderationAssignments |

**ContestProblem** — Junction table with order, points, timeLimitOverride
**ContestRegistration** — score, penalty, activeSessionToken, status
**Submission** — code, language, status, executionTime, memoryUsed, score, testResults, evaluationComments

#### Quiz System Models

**ContestSection** — sectionType (QUIZ/CODING/WEB_DEV), duration, sectionLocked, weight, negative marking overrides, problemIds (JSON), instructions
**QuestionBank** — scope (PLATFORM_GLOBAL/TENANT_PRIVATE/SHARED_CONTRIBUTED), organizationId
**QuizPassage** — passageType, content (reading comprehension passages)
**QuizQuestion** — questionType, reviewStatus, content, imageUrl, difficulty, category, topic, subtopic, points, negativeMarking, randomizeOptions, explanation, version, parentQuestionId, allowPlatformSharing
**QuestionVersion** — versionNumber, contentSnapshot, changeSummary
**QuestionReviewLog** — fromStatus, toStatus, comments
**ContestAssemblyRule** — category, topic, minDifficulty, maxDifficulty, sampleCount, points
**QuizOption** — content, imageUrl, isCorrect, displayOrder
**QuizAttemptQuestion** — presentedOrder, optionOrderMap, imageTransformApplied
**QuizResponse** — selectedOptionIds[], numericAnswer, textAnswer, scratchpadData, timeSpentMs, isCorrect, scoreAwarded, moderatorOverride/moderatedById/moderationReason
**QuizItemAnalytics** — totalAttempts, correctAttempts, avgTimeSpentMs, pointBiserialCorr, calibratedDifficulty (IRT)

#### Interview Models

**MockInterviewSession** — title, description, scheduledAt, durationMinutes, accessCode (bcrypt), accessCodePlain, status, currentPhase, phase durations, allowHints, allowObservers, interviewerId, candidateId, candidateEmail, problemId, organizationId, yjsDocumentId
**InterviewParticipant** — role (INTERVIEWER/CANDIDATE/OBSERVER), joinedAt, leftAt
**InterviewFeedback** — 5 rubric scores (1-5), recommendation, privateNotes, candidateFeedback
**InterviewCodeSnapshot** — code, language, phase, snapshotAt
**InterviewHintRequest** — hintLevel (1-3), approved, hintContent
**InterviewExecutionResult** — code, language, output, status

#### AI Assistant Models

**AssistantSession** — userId, problemId, stage, tokenBudget (2000), tokensUsed, codeGenerated
**CapturedAnswer** — problemSummary, dsChoice, approach
**AssistantTranscript** — turnIndex, role, stageAtTime, message, gateResult, tokensConsumed, llmCallType
**AssistantStageEvent** — fromStage, toStage, eventType (gate_pass/gate_reject/stage_advance), reason
**AssistantCodeSnapshot** — code, version, insertedAt

#### Company Vault Models

**CompanyVault** — name, slug, companyName, brandColor, logoUrl, targetCtc, examPattern, description, accessCode, accessCodePlain, expiresAt, isLocked, organizationId
**CompanyMaterial** — title, materialType (PROBLEM/QUIZ/PDF_GUIDE/ROUND_INTEL), contentUrl, dataJson, order
**CompanyInterviewTranscript** — roleTitle, location, experience, difficulty, upvotes
**CompanyAccessLog** — vaultId, userId, unlockedAt

#### Compliance & Governance Models

**AuditLog** — userId, organizationId, action, resource, resourceId, details
**RefreshToken** — userId, token, expiresAt
**OrganizationRequest** — Multi-step onboarding (identity, legal/anti-fraud, contact, requirements, DPA)
**BreakGlassAuditLog** — superAdminId, resourcePath, actionType, reason
**GuestInvite** — contestId, email, name, token, guestUserId, expiresAt
**GdprErasureRequest** — requestedByEmail, targetUserId, reason, status, reviewNotes, executedAt
**ContestModerationAssignment** — contestId, moderatorId, assignedById
**Notification** — userId, title, message, type, data, isRead

---

## 7. Authentication & Authorization

### Authentication Flow

```
Login Request → bcrypt.compare() → JWT Access Token (7d) + Refresh Token (30d)
    → Client stores in memory + localStorage
    → API calls include Authorization: Bearer <token>
    → On 401: Token refresh queue prevents concurrent refresh attempts
    → On exam routes (/contests/*): No redirect to login (exam continuity)
```

### JWT Token Structure

```typescript
{
  userId: string,
  email: string,
  role: Role,
  organizationId?: string,
  iat: number,
  exp: number    // 7 days for access token
}
```

### Refresh Token Flow

1. Access token expires → 401 response
2. Client queues the failed request
3. Client sends refresh token to `/api/auth/refresh`
4. Server validates refresh token, issues new access token
5. Queued requests retry with new token
6. If refresh fails → logout, redirect to login

### URL Token Injection

For SEB auto-login and guest access, tokens can be passed via URL:
```
/contest/{id}?token={jwt_token}
```
The AuthContext reads this and injects it into the auth state.

### SSO Support

- **Social OAuth:** Google, GitHub, LinkedIn
- **Enterprise SAML 2.0:** Configurable IdP with entity ID, SSO URL, and certificate
- SSO callback handled at `/api/auth/sso`

### Password Security

- **Hashing:** bcryptjs with 12 rounds
- **Token blacklist:** JWT blacklist for forced logout (stored in Redis/memory)

### Role Hierarchy

```
SUPER_ADMIN (1)
  └── PLATFORM_CONTENT_AUTHOR (2)
        └── ORG_ADMIN (3)
              └── PROCTOR (4)
                    └── ORG_MEMBER (5)
                          └── EVALUATOR (6)
                                └── STUDENT (7)
                                      └── CANDIDATE (7)
```

Frontend extends to 12 roles:
```
+ ANALYTICS_VIEWER
+ GUEST_CANDIDATE
+ COMPLIANCE_OFFICER
+ CONTEST_MODERATOR
```

### RBAC Middleware

- `authenticateToken` — Validates JWT, attaches `req.user`
- `requireMinLevel(level)` — Enforces minimum hierarchy level
- `requireRole(role)` — Enforces exact role match
- `requireOrgAccess` — Validates organization membership
- `breakGlassMiddleware` — Super admin emergency cross-org access (audited)

---

## 8. Backend API — Complete Route Reference

### Route Mount Summary

| Mount Path | Module | Purpose |
|------------|--------|---------|
| `/api/auth/sso` | sso.routes.ts | SSO callback (Google, GitHub, LinkedIn, SAML) |
| `/api/auth` | auth.routes.ts | login, register, logout, refresh, demo accounts |
| `/api/org` | org.routes.ts | Organization CRUD, user management |
| `/api/assignments` | assignment.routes.ts | Contest assignment management |
| `/api/admin` | admin.routes.ts | Super admin dashboard, break-glass access |
| `/api/billing` | billing.routes.ts | Subscription management |
| `/api/evaluator` | evaluator.routes.ts | Grading queue, evaluation submission |
| `/api/org-requests` | org-request.routes.ts | Multi-step org onboarding |
| `/api/contests/manager` | contest-manager.routes.ts | Contest listing, creation, problem mapping |
| `/api/contests` | contests.routes.ts | Core contest APIs |
| `/api/submissions` | submissions.routes.ts | Code submission & results |
| `/api/leaderboard` | leaderboard.routes.ts | Live leaderboard |
| `/api/problems` | problems.routes.ts | Problem CRUD (RBAC-gated) |
| `/api/guard` | guard.routes.ts | Contest entry, SEB guard |
| `/api/code` | code.routes.ts | Code execution |
| `/api/plagiarism` | plagiarism.routes.ts | Plagiarism reports |
| `/api/webdev` | webdev.routes.ts | Web dev evaluation |
| `/api/playground` | playground.routes.ts | Playground endpoints |
| `/api/quiz` | quiz.routes.ts | Quiz subsystem |
| `/api/governance` | question-governance.routes.ts | Question review & governance |
| `/api/proctor` | proctor.routes.ts | Proctoring console |
| `/api/analytics` | analytics-viewer.routes.ts | Read-only analytics & scorecards |
| `/api/guest` | guest.routes.ts | Guest candidate management |
| `/api/compliance` | compliance.routes.ts | GDPR erasure, audit logs |
| `/api/notifications` | notification.routes.ts | Notifications & SSE stream |
| `/api/interviews` | interview.routes.ts | Mock interview management |
| `/api/assistant` | assistant.routes.ts | Socratic AI assistant |
| `/api/company-vaults` | company-vault.routes.ts | Company placement vaults |

### Inline Routes (in app.ts)

| Path | Purpose |
|------|---------|
| `GET /api/user/streak` | Calculate current & max submission streak |
| `POST /api/user/streak/update` | Update streak after submission |
| `GET /api/classes` | Demo fallback: class list |
| `GET /api/classes/:id/students` | Demo fallback: student list |
| `GET /api/health` | Health check → `"Kryptavia OS API Engine"` |

### Key API Endpoints (Detailed)

#### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| POST | `/api/auth/logout` | Yes | Blacklist token |
| POST | `/api/auth/refresh` | No | Refresh access token |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/demo/:role` | No | Quick login as demo user |

Rate limit: 3 requests per 15 minutes on auth endpoints.

#### Contests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/contests` | Yes | List all contests |
| GET | `/api/contests/:id` | Yes | Get contest details |
| POST | `/api/contests` | ORG_ADMIN+ | Create contest |
| PUT | `/api/contests/:id` | ORG_ADMIN+ | Update contest |
| DELETE | `/api/contests/:id` | ORG_ADMIN+ | Delete contest |
| POST | `/api/contests/:id/register` | Yes | Register for contest |
| POST | `/api/contests/:id/join` | Yes | Join with access code |
| GET | `/api/contests/:id/problems` | Yes | Get contest problems |

#### Contest Manager

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/contests/manager/list` | Yes | List managed contests |
| POST | `/api/contests/manager/create` | Yes | Create contest |
| POST | `/api/contests/manager/:id/map-problems` | Yes | Map problems to contest |

#### Code Execution

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/code/execute` | Yes | Execute code (rate: 10/user/min) |
| POST | `/api/code/execute-test` | Yes | Run against specific test case |

#### Submissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/submissions` | Yes | Submit solution |
| GET | `/api/submissions` | Yes | List user submissions |
| GET | `/api/submissions/:id` | Yes | Get submission detail |

#### Leaderboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/leaderboard/:contestId` | Yes | Contest leaderboard |
| GET | `/api/leaderboard/global` | Yes | Global leaderboard |
| GET | `/api/leaderboard/category/:category` | Yes | Category leaderboard |
| GET | `/api/leaderboard/department/:dept` | Yes | Department leaderboard |
| GET | `/api/leaderboard/platform/:platform` | Yes | Platform leaderboard (LeetCode, etc.) |

#### Quiz

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/quiz/contest/:id/sections` | Yes | Get contest sections |
| POST | `/api/quiz/attempt/start` | Yes | Start quiz attempt |
| POST | `/api/quiz/response` | Yes | Save response |
| POST | `/api/quiz/submit` | Yes | Submit quiz |
| GET | `/api/quiz/results/:contestId` | Yes | Get results |

#### Proctoring

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/proctor/contest/:id/participants` | PROCTOR+ | List participants |
| POST | `/api/proctor/warn` | PROCTOR+ | Send warning |
| POST | `/api/proctor/block` | PROCTOR+ | Block candidate |
| POST | `/api/proctor/terminate` | PROCTOR+ | Terminate session |

#### AI Assistant

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/assistant/session/init` | Yes | Initialize AI session |
| POST | `/api/assistant/:sessionId/message` | Yes | Send message to AI |
| GET | `/api/assistant/:sessionId/history` | Yes | Get conversation history |

#### Company Vaults

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/company-vaults` | Yes | List available vaults |
| POST | `/api/company-vaults/:slug/unlock` | Yes | Unlock with access code |
| GET | `/api/company-vaults/:slug/materials` | Yes | Get vault materials |

#### Interviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/interviews/schedule` | Yes | Schedule interview |
| GET | `/api/interviews/:id` | Yes | Get interview details |
| POST | `/api/interviews/:id/join` | Yes | Join with passcode |
| POST | `/api/interviews/:id/feedback` | Yes | Submit feedback |

#### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Yes | List notifications |
| PUT | `/api/notifications/:id/read` | Yes | Mark as read |
| GET | `/api/notifications/stream` | Yes | SSE real-time stream |

#### Compliance

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/compliance/gdpr/request` | Yes | Submit erasure request |
| GET | `/api/compliance/audit-logs` | COMPLIANCE_OFFICER+ | View audit logs |

---

## 9. Backend Services — Detailed Breakdown

### 9.1 Code Execution Services

**`externalCodeExecutor.ts` / `code-execution.service.ts`**

Multi-language code execution via external APIs with fallback chain:

```
Primary: Piston (emkc.org/api/v2/piston)
  → Fallback: Judge0 (ce.judge0.com / RapidAPI)
    → Fallback: Local mock runner
```

**Supported Languages:**
| Language | Piston Runtime | Extension |
|----------|---------------|-----------|
| C++ | cpp/g++ | .cpp |
| Java | java/openjdk | .java |
| Python | python/python3 | .py |
| JavaScript | javascript/node | .js |
| Go | go/go | .go |
| Rust | rust/rustc | .rs |
| C# | csharp/dotnet | .cs |

**Rate Limiting:** 10 executions per user per minute
**Execution Flow:** Code → Language adapter → Wrapper generator (adds test harness) → External API → Parse stdout/stderr → Compare with expected output → Return results

### 9.2 SQL Executor (`sqlExecutor.ts`)

- **Engine:** WASM-based `sql.js` (SQLite in browser/Node)
- **Validation:** `node-sql-parser` AST-level validation before execution
- **Limits:** 10,000 result rows maximum
- **Security:** Injection/DoS prevention via AST analysis, query sanitization
- **Schema:** Loaded from provided JSON schema definition

### 9.3 Quiz Evaluator (`quizEvaluator.ts`)

- Multi-type evaluation: SINGLE_SELECT, MULTI_SELECT, TRUE_FALSE, NUMERIC, CODE_OUTPUT, FILL_BLANK, IMAGE_PATTERN
- **Partial credit scoring** for multi-select questions
- **Float tolerance** for numeric answers
- **Moderator override** capability (CONTEST_MODERATOR role)
- **IRT Analytics:** Point-biserial correlation, calibrated difficulty via `questionAnalyticsEngine.ts`

### 9.4 Quiz Materializer (`quizMaterializer.ts`)

- Instantiates questions from banks with:
  - Option shuffling (configurable per question)
  - Image transform application
  - Presented order tracking
  - Unique constraint enforcement (one attempt per user per question per contest)

### 9.5 Contest Assembly Engine (`contestAssemblyEngine.ts`)

- **Rule-based auto-assembly** of contest sections from question banks
- **Fisher-Yates sampling** per-candidate for randomization
- Assembly rules define: category, topic, difficulty range, sample count, points
- Ensures no duplicate questions across sections

### 9.6 Web Dev Evaluator (`webDevEvaluator.ts` / `webDevEvaluatorV2.ts`)

- **Headless Chrome** via Playwright for evaluation
- **JSDOM failover** when Playwright unavailable
- **4-dimension rubric:**
  1. Functionality (feature completeness)
  2. Styling (visual fidelity)
  3. Accessibility (WCAG compliance)
  4. Code Quality (clean code metrics)
- Supports both structured JSON spec and legacy DSL input
- NLP heuristic parsing for natural language requirements
- Browser lifecycle: `closeBrowser()` called on SIGTERM/SIGINT

### 9.7 Proctoring Service (`proctoringService.ts`)

- **In-memory 10-second sliding window** for sync-cheat detection
- **Detection Logic:** Same IP + identical options within 500ms = flagged
- **Frozen quiz sessions** tracked in-memory (stateless across restarts)
- **Violation tracking:** tab-switch, fullscreen exit, copy-paste, webcam anomalies

### 9.8 SEB Config Generator (`sebConfigGenerator.ts` / `sebConfigService.ts`)

Generates Apple plist-format `.seb` configuration files:

**Blocked URLs:**
- ChatGPT (chat.openai.com, chatgpt.com)
- Google Search (google.com/search)
- StackOverflow
- DeepSeek
- Claude (claude.ai)
- Gemini (gemini.google.com)
- GitHub Copilot

**Blocked Features:**
- Developer tools
- Virtual machines
- Screen sharing
- Right-click context menu
- Clipboard operations
- Task manager

**Auto-Login:** One-time token embedded in `.seb` file for seamless candidate entry

### 9.9 Plagiarism Detector (`plagiarismDetector.ts`)

- **Token hashing** and normalized token extraction
- **Structural similarity** (AST-based, MOSS-style)
- **Token similarity** (n-gram overlap)
- **LRU cache** with TTL for performance
- Generates `PlagiarismReport` with similarity map JSON

### 9.10 Problem AI Credit Service (`problemAiCreditService.ts`)

- Per-problem AI credit budgets (default: 2000 credits)
- Tracks consumption per user per problem
- Actions tracked: GENERATE_PROBLEM, AI_CODE_ASSIST, TESTCASE_GENERATE, HINT_GENERATE
- Credits deducted on each AI interaction

### 9.11 Question Bank Service (`questionBankService.ts`)

- CRUD for question banks with scope control
- PLATFORM_GLOBAL: Available to all organizations
- TENANT_PRIVATE: Organization-specific
- SHARED_CONTRIBUTED: Cross-org sharing

### 9.12 Preview Runner Service (`previewRunnerService.ts`)

- Quick code preview execution for playground environments
- Lightweight execution without full test suite evaluation

### 9.13 Section Config Schema (`sectionConfigSchema.ts`)

- Validates section configuration JSON
- Ensures required fields, type constraints, scoring rules

### 9.14 Language Adapter (`languageAdapter.ts`)

- Maps user-friendly language names to executor runtime IDs
- Handles language-specific compilation flags

### 9.15 Code Templates (`codeTemplates.ts`)

- Starter code templates for all 7 supported languages
- Includes boilerplate imports, main function, I/O stubs

### 9.16 Code Wrapper Generator (`codeWrapperGenerator.ts`)

- Wraps candidate code with test harnesses
- Adds input reading, output comparison, timeout handling
- Language-specific wrapper generation

### 9.17 Workers

**`quizAutosaveWorker.ts`**
- In-memory answer queue
- Flushes `QuizResponse` upserts to CockroachDB every 3 seconds
- Batch size: 50 records per flush
- Prevents data loss on browser crash/network interruption

**`webDevWorker.ts`**
- Background worker for web dev evaluation jobs
- Processes evaluation queue asynchronously

---

## 10. Frontend — Complete Component & Page Reference

### 10.1 Routing Architecture (`App.tsx`)

**Router:** React Router v6
**Wrapper Chain:** `ErrorBoundary → QueryClientProvider → AuthProvider → NotificationProvider → Router → Sidebar`

**Route Structure:**
```
/ → LandingPageApp (embedded)
/landing → LandingPageApp
/login → LoginPage
/register → RegisterPage
/sso/callback → SsoCallbackPage
/accept-invite → AcceptInvitePage
/portal → Role-based redirect

/participant/dashboard → ParticipantDashboard
/contests → Contests list
/contest/:id → ContestBoard
/contest/:id/zone → ContestZoneLayout (nested)
  /overview → OverviewTab
  /problems → ProblemsTab
  /leaderboard → LeaderboardTab
  /rules → RulesTab
/leaderboard → LeaderboardPage

/playground/code → CodePlaygroundPage
/playground/sql → SqlPlaygroundPage
/playground/web → WebPlaygroundPage
/playground/quiz → QuizPlaygroundPage
/playground/ai-assisted → AiAssistedPlaygroundPage

/teacher/contests → ContestManagement
/teacher/problems → ProblemList
/teacher/problem/:id → ProblemEditor
/teacher/question-bank → QuestionBankPage
/teacher/question-review → QuestionReviewDashboard
/teacher/quiz-analytics → QuizAnalyticsPage
/teacher/contest-attempt/:id → ContestAttemptReport

/superadmin/platform → PlatformDashboard
/orgadmin/dashboard → OrgDashboard
/orgmember/dashboard → MemberDashboard
/evaluator/dashboard → EvaluatorDashboard
/proctor/console → ProctorConsole
/analytics/dashboard → AnalyticsDashboard
/compliance/dashboard → ComplianceDashboard
/moderator/dashboard → ModeratorDashboard
/governance/sme-repository → SmeGlobalRepositoryPage

/interviews → InterviewDashboardPage
/interview/:id/live → LiveInterviewRoomPage

/company-vaults → CompanyVaultsPage
/company-vaults/:slug → CompanyWorkspacePage

/guest/entry → GuestContestEntry
/guest/results → GuestResultView

/notifications → NotificationsPage
/* → NotFoundPage
```

### 10.2 Components (50+)

#### Layout & Navigation
| Component | File | Purpose |
|-----------|------|---------|
| Sidebar | Sidebar.tsx | Role-based navigation with Capgemini restricted modals |
| Navbar | Navbar.tsx | Top navigation bar |
| KryptaviaLogo | KryptaviaLogo.tsx | Animated logo component |
| ErrorBoundary | ErrorBoundary.tsx | React error boundary |
| RoleRoute | RoleRoute.tsx | Role-based route guard |
| NotificationBell | NotificationBell.tsx | Notification icon with count |
| NotificationProvider | notifications.tsx | SSE notification context |

#### Entry & Security
| Component | File | Purpose |
|-----------|------|---------|
| SecureContestWrapper | SecureContestWrapper.tsx | Full contest security envelope (fullscreen, tab, copy, webcam, proctor socket) |
| AccessCodeGate | AccessCodeGate.tsx | Access code verification gate |
| SebLaunchGate | SebLaunchGate.tsx | SEB browser detection gate |
| SebWarningShield | SebWarningShield.tsx | SEB warning display |
| SebDiagnosticCockpit | SebDiagnosticCockpit.tsx | SEB diagnostic state machine |
| SystemCheckScreen | SystemCheckScreen.tsx | Pre-exam system check |
| ExamFlowModals | ExamFlowModals.tsx | Exam flow modal dialogs |
| ProctorBlockScreen | ProctorBlockScreen.tsx | Proctor-blocked candidate screen |
| WarningModal | WarningModal.tsx | Warning display modal |
| PostAutoSubmitScreen | PostAutoSubmitScreen.tsx | Post-submission screen |
| GlassShatter | GlassShatter.tsx | Screen shatter animation (violation) |
| ProctoringIndicator | ProctoringIndicator.tsx | Live violation count indicator |
| ProctoringSummary | ProctoringSummary.tsx | Post-exam proctoring summary |
| ProctorActionModal | ProctorActionModal.tsx | Proctor action dialog |

#### Lobby (Pre-Flight)
| Component | File | Purpose |
|-----------|------|---------|
| LobbyStepper | LobbyStepper.tsx | Multi-step pre-exam flow |
| BoardingPass | BoardingPass.tsx | Candidate exam boarding pass |
| EnvironmentIntegrityCheck | EnvironmentIntegrityCheck.tsx | Browser/environment validation |
| LivenessCheck | LivenessCheck.tsx | Webcam liveness detection |
| NetworkDiagnostics | NetworkDiagnostics.tsx | Network quality check |
| ScratchpadRunner | ScratchpadRunner.tsx | Scratchpad test runner |
| DiagnosticPreflightModal | DiagnosticPreflightModal.tsx | Pre-exam diagnostic modal |

#### Problem & Editor
| Component | File | Purpose |
|-----------|------|---------|
| ProblemDescription | ProblemDescription.tsx | Problem display with video hints, YouTube integration |
| ProblemLockModal | ProblemLockModal.tsx | Problem lock dialog |
| ProblemQuickViewModal | ProblemQuickViewModal.tsx | Quick problem preview |
| MarkdownRenderer | MarkdownRenderer.tsx | Markdown rendering for descriptions |

#### AI Assistant
| Component | File | Purpose |
|-----------|------|---------|
| VibeAssistantPanel | assistant/VibeAssistantPanel.tsx | Socratic AI chat interface with token tracking |
| InsertInEditorButton | assistant/InsertInEditorButton.tsx | Insert AI-generated code into editor |
| TokenUsageBar | assistant/TokenUsageBar.tsx | Token budget visualization |
| InContestAiWorkspace | InContestAiWorkspace.tsx | In-contest AI workspace |

#### Quiz Instruments (20+)
| Component | File | Purpose |
|-----------|------|---------|
| AmbientParticleBackground | AmbientParticleBackground.tsx | Ambient background animation |
| CalibrationModal | CalibrationModal.tsx | Pre-quiz calibration |
| CommandPaletteModal | CommandPaletteModal.tsx | Keyboard command palette |
| InstrumentHeader | InstrumentHeader.tsx | Quiz instrument header |
| InstrumentOptionCard | InstrumentOptionCard.tsx | Option selection card |
| InstrumentPassagePanel | InstrumentPassagePanel.tsx | Reading passage display |
| InstrumentQuestionMap | InstrumentQuestionMap.tsx | Question navigation map |
| InteractiveCodeOrder | InteractiveCodeOrder.tsx | Code ordering exercise |
| InteractiveHotspotMarker | InteractiveHotspotMarker.tsx | Image hotspot marking |
| InteractiveSliderGauge | InteractiveSliderGauge.tsx | Slider input |
| LiquidCardDeck | LiquidCardDeck.tsx | Card flip deck |
| MaterialHonestyHeader | MaterialHonestyHeader.tsx | Academic honesty header |
| PracticeExploreCanvas | PracticeExploreCanvas.tsx | Practice exploration |
| QuietOptionCard | QuietOptionCard.tsx | Minimal option card |
| ReadingGravityPassage | ReadingGravityPassage.tsx | Gravity-themed passage |
| ScratchpadCanvas | ScratchpadCanvas.tsx | Drawing scratchpad |
| ScratchpadDock | ScratchpadDock.tsx | Scratchpad container |
| SectionPacingIndicator | SectionPacingIndicator.tsx | Time pacing indicator |
| TimerProgressRing | TimerProgressRing.tsx | Circular timer |
| TypedMathInput | TypedMathInput.tsx | Math equation input |
| VerifiableScorecardPDF | VerifiableScorecardPDF.tsx | PDF scorecard generator |

#### Playgrounds
| Component | File | Purpose |
|-----------|------|---------|
| SqlPlayground | SqlPlayground.tsx | SQL editor + execution |
| WebPlayground | WebPlayground.tsx | HTML/CSS/JS editor |
| SchemaViewer | sql-playground/SchemaViewer.tsx | Database schema visualization |
| SchemaTreeView | sql-playground/SchemaTreeView.tsx | Tree view of schema |
| TableNode | sql-playground/TableNode.tsx | Individual table node |
| layoutEngine | sql-playground/layoutEngine.ts | Graph layout engine |

#### Interview
| Component | File | Purpose |
|-----------|------|---------|
| InterviewJoinModal | InterviewJoinModal.tsx | Interview entry modal |
| InterviewLoader | InterviewLoader.tsx | Loading state |
| InterviewScheduleModal | InterviewScheduleModal.tsx | Scheduling dialog |
| InterviewWhiteboardModal | InterviewWhiteboardModal.tsx | Collaborative whiteboard |

#### Participant & Branding
| Component | File | Purpose |
|-----------|------|---------|
| CapgeminiCountdownBanner | CapgeminiCountdownBanner.tsx | Capgemini drive countdown with module cards |
| ContestHeroHeader | ContestHeroHeader.tsx | Contest hero section |
| ContestPlaygroundHeader | ContestPlaygroundHeader.tsx | Playground header |
| CandidateSkillCockpit | CandidateSkillCockpit.tsx | Skill visualization |

#### Teacher Tools
| Component | File | Purpose |
|-----------|------|---------|
| ContestAssemblyBuilder | ContestAssemblyBuilder.tsx | Rule-based contest assembly |
| GlobalItemTypeWizard | GlobalItemTypeWizard.tsx | Question type wizard |
| IrtCalibrationModal | IrtCalibrationModal.tsx | IRT calibration dialog |
| QuestionAuthoringForm | QuestionAuthoringForm.tsx | Question creation form |
| TeacherAiQuestionBuilder | TeacherAiQuestionBuilder.tsx | AI-assisted question builder ("Capgemini Stage 4 Format") |

#### Analytics
| Component | File | Purpose |
|-----------|------|---------|
| CompetencyRadarChart | CompetencyRadarChart.tsx | Skill radar chart |
| IntegrityDonutChart | IntegrityDonutChart.tsx | Integrity violation donut |
| QuadrantScatterChart | QuadrantScatterChart.tsx | Score distribution scatter |
| ScoreDistributionChart | ScoreDistributionChart.tsx | Score histogram |
| ProblemAiCreditMeter | ProblemAiCreditMeter.tsx | AI credit usage meter |

#### Company
| Component | File | Purpose |
|-----------|------|---------|
| CompanyVaultCard | CompanyVaultCard.tsx | Vault display card with Capgemini logo |
| SecretPasscodeModal | SecretPasscodeModal.tsx | Access code entry |

#### Common
| Component | File | Purpose |
|-----------|------|---------|
| CinematicAuthBackground | CinematicAuthBackground.tsx | Login/register background |
| EmptyState | EmptyState.tsx | Empty state placeholder |
| ErrorState | ErrorState.tsx | Error state display |
| PortalLoader | PortalLoader.tsx | Loading spinner |
| JoinByCodeModal | JoinByCodeModal.tsx | Join by code dialog |
| ProgressRing | ProgressRing.tsx | Circular progress |
| RankReveal3D | RankReveal3D.tsx | 3D rank reveal animation |

### 10.3 Pages (40+)

| Page | Path | Description |
|------|------|-------------|
| Login | /login | Auth with SSO, demo accounts |
| Register | /register | Multi-field registration |
| SsoCallbackPage | /sso/callback | SSO OAuth callback |
| AcceptInvitePage | /accept-invite | Team invitation acceptance |
| ParticipantDashboard | /participant/dashboard | Candidate dashboard with Capgemini card |
| Contests | /contests | Contest listing with filters |
| ContestBoard | /contest/:id | Contest detail board |
| ContestZonePage | /contest/:id/zone | Full contest zone with tabs |
| Leaderboard | /leaderboard | Multi-tab leaderboard |
| CodePlaygroundPage | /playground/code | Code practice |
| SqlPlaygroundPage | /playground/sql | SQL practice |
| WebPlaygroundPage | /playground/web | Web dev practice |
| QuizPlaygroundPage | /playground/quiz | Quiz practice |
| AiAssistedPlaygroundPage | /playground/ai-assisted | AI-assisted coding (Capgemini exclusive) |
| ContestManagement | /teacher/contests | Contest CRUD |
| ProblemList | /teacher/problems | Problem listing |
| ProblemEditor | /teacher/problem/:id | Problem authoring |
| QuestionBankPage | /teacher/question-bank | Question bank management |
| QuestionReviewDashboard | /teacher/question-review | Question governance |
| QuizAnalyticsPage | /teacher/quiz-analytics | Quiz analytics |
| ContestAttemptReport | /teacher/contest-attempt/:id | Attempt report |
| PlatformDashboard | /superadmin/platform | Super admin dashboard |
| OrgDashboard | /orgadmin/dashboard | Org admin dashboard |
| MemberDashboard | /orgmember/dashboard | Member dashboard |
| EvaluatorDashboard | /evaluator/dashboard | Evaluation queue |
| ProctorConsole | /proctor/console | Live proctoring console |
| AnalyticsDashboard | /analytics/dashboard | Analytics viewer |
| ComplianceDashboard | /compliance/dashboard | GDPR & audit |
| ModeratorDashboard | /moderator/dashboard | Moderation queue |
| SmeGlobalRepositoryPage | /governance/sme-repository | Question governance |
| InterviewDashboardPage | /interviews | Interview scheduling |
| LiveInterviewRoomPage | /interview/:id/live | Live interview room |
| CompanyVaultsPage | /company-vaults | Company vault listing |
| CompanyWorkspacePage | /company-vaults/:slug | Vault workspace |
| GuestContestEntry | /guest/entry | Guest entry |
| GuestResultView | /guest/results | Guest results |
| NotificationsPage | /notifications | Notification center |
| NotFoundPage | /* | 404 page |

---

## 11. Contest System — Deep Dive

### Contest Lifecycle

```
1. Creation (ORG_ADMIN/Teacher)
   → Define title, duration, start/end time
   → Set security settings (SEB, proctoring, fullscreen)
   → Configure scoring mode (PARTIAL/BINARY/ACM/DYNAMIC)
   → Map problems with points & time limits
   → Set access code
   → Create sections (QUIZ/CODING/WEB_DEV)

2. Registration
   → Candidates register via dashboard
   → Receive boarding pass with details
   → Access code required for entry

3. Pre-Exam (Lobby)
   → System check (browser, webcam, network)
   → Liveness check (face detection)
   → Environment integrity check
   → Network diagnostics
   → SEB detection (if required)
   → Boarding pass display

4. Exam Delivery
   → SecureContestWrapper envelope
   → Fullscreen enforcement
   → Tab-switch detection
   → Copy-paste blocking
   → Live webcam/screen streaming (if proctoring enabled)
   → Quiz autosave worker (every 3s)

5. Code Submission
   → Code editor (Monaco) with syntax highlighting
   → Language selection (7 languages)
   → Execute against test cases (rate: 10/min)
   → Partial credit scoring
   → Real-time feedback

6. Real-Time Features
   → Live leaderboard (Redis-backed)
   → Proctor warnings/blocks via Socket.IO
   → Timer with auto-submit

7. Post-Exam
   → Evaluation queue for manual grading
   → Plagiarism detection
   → Analytics & reports
   → Verifiable scorecard PDF
```

### Scoring Modes

| Mode | Description |
|------|-------------|
| **PARTIAL** | Credit per test case passed (default) |
| **BINARY** | All-or-nothing per problem |
| **ACM** | ACM-ICPC style with penalty time |
| **DYNAMIC** | Dynamic scoring based on solve count |

### Negative Marking

- Configurable per contest and per section
- Default: 0.25 marks deducted per wrong attempt
- Can be disabled globally or per section

### Section Types

| Type | Description |
|------|-------------|
| **QUIZ** | Multiple-choice, true/false, numeric, code output, fill-blank, image pattern |
| **CODING** | Code submission with test case evaluation |
| **WEB_DEV** | HTML/CSS/JS submission with Playwright evaluation |

### Contest Assembly

The `contestAssemblyEngine.ts` auto-assembles sections from question banks:
1. Define rules: category, topic, difficulty range, sample count, points
2. Engine samples questions using Fisher-Yates shuffle (per-candidate)
3. Ensures no duplicates across sections
4. Supports weighted scoring across sections

---

## 12. Code Execution Engine

### Execution Pipeline

```
Candidate Code
  → Language Detection & Validation
  → Code Wrapper (adds test harness, I/O handling)
  → Rate Limit Check (10/user/min)
  → Primary Executor: Piston API
    → Response parsing (stdout, stderr, time, memory)
  → Fallback: Judge0 API
  → Fallback: Local Mock Runner
  → Test Case Comparison
    → EXACT_MATCH: String equality
    → UNORDERED_MATCH: Set equality
    → FLOAT_TOLERANCE: Numeric comparison with epsilon
  → Score Calculation (partial credit)
  → Return Results
```

### Piston API Request

```json
{
  "language": "cpp",
  "version": "10.2.0",
  "files": [
    {
      "name": "main.cpp",
      "content": "#include <iostream>..."
    }
  ]
}
```

### Response Format

```json
{
  "run": {
    "stdout": "output...",
    "stderr": "",
    "code": 0,
    "signal": null,
    "output": "output..."
  }
}
```

---

## 13. Safe Exam Browser (SEB) Integration

### SEB Config Generation

The `sebConfigGenerator.ts` creates Apple plist-format `.seb` files with:

**URL Filtering:**
- Blacklist: ChatGPT, Google Search, StackOverflow, DeepSeek, Claude, Gemini, Copilot
- Whitelist: Only the contest domain

**Feature Restrictions:**
- Developer tools: Blocked
- Virtual machines: Blocked
- Screen sharing: Blocked
- Right-click: Blocked
- Clipboard: Blocked
- Task manager: Blocked
- Multiple monitors: Configurable

**Auto-Login:**
- One-time token embedded in `.seb` file
- Token expires after single use
- Candidate opens `.seb` → auto-navigates to contest → auto-authenticates

### SEB Detection (Client-Side)

```typescript
const isSEB = navigator.userAgent.includes('SEB') 
  || navigator.userAgent.includes('SafeExamBrowser')
  || new URLSearchParams(window.location.search).get('seb') === '1';
```

### Non-Negotiable Invariant

> The SEB gate MUST remain at the top level of `ContestZoneLayout` wrapping `<Outlet/>`, never inside child tabs. This is an architectural invariant that cannot be violated.

---

## 14. Proctoring & Anti-Cheat System

### Multi-Layer Security

| Layer | Mechanism | Implementation |
|-------|-----------|----------------|
| **1. Browser Lock** | SEB Integration | Config generation + detection |
| **2. Fullscreen** | Mandatory fullscreen | Violation tracking, auto-block after max |
| **3. Tab Switch** | Visibility API | Real-time detection, warning counter |
| **4. Copy-Paste** | Keyboard shortcuts | Blocked or logged (configurable) |
| **5. Webcam** | Periodic snapshots | Configurable interval (default 45s) |
| **6. Face Check** | Liveness detection | Pre-exam and periodic |
| **7. Voice Check** | Audio monitoring | Optional |
| **8. Screen Share** | Screen capture | Live streaming to proctor |
| **9. Sync-Cheat** | Sliding window | Same IP + identical answers within 500ms |
| **10. Proctor Console** | Real-time dashboard | Live webcam grid, violation alerts |

### Proctor Console Actions

| Action | Effect |
|--------|--------|
| **WARN** | Send warning message to candidate |
| **NUDGE** | Gentle reminder notification |
| **PAUSE** | Pause candidate's timer |
| **BLOCK** | Block candidate's screen |
| **RESUME** | Resume blocked candidate |
| **TERMINATE** | End candidate's session |
| **DISQUALIFY** | Permanently disqualify |

### Socket.IO Proctor Events

```
Namespace: /quiz-timer
Events:
  - candidate:join (contestId, userId)
  - candidate:leave
  - proctor:warn (userId, message)
  - proctor:block (userId, reason)
  - proctor:terminate (userId, reason)
  - proctor:disqualify (userId, reason)
  - proctor:pause (userId)
  - proctor:resume (userId)
```

### Sync-Cheat Detection Algorithm

```typescript
// In-memory 10s sliding window
const window = 10000; // 10 seconds
const submissions = getRecentSubmissions(window);

for (let i = 0; i < submissions.length; i++) {
  for (let j = i + 1; j < submissions.length; j++) {
    if (submissions[i].ip === submissions[j].ip &&
        submissions[i].answers === submissions[j].answers &&
        Math.abs(submissions[i].timestamp - submissions[j].timestamp) < 500) {
      flagForReview(submissions[i], submissions[j]);
    }
  }
}
```

---

## 15. Quiz Instrument System

### Question Types (7)

| Type | Description |
|------|-------------|
| **SINGLE_SELECT** | Single correct option from 4+ choices |
| **MULTI_SELECT** | Multiple correct options (partial credit) |
| **TRUE_FALSE** | Boolean choice |
| **NUMERIC** | Numeric input with float tolerance |
| **CODE_OUTPUT** | Predict the output of code |
| **FILL_BLANK** | Fill in the blank |
| **IMAGE_PATTERN** | Pattern recognition from images |

### Question Governance Workflow

```
DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED
                    ↘ REJECTED
```

- Version tracking with snapshots
- Review logs with reviewer comments
- Platform sharing (allowPlatformSharing)
- Parent question relationships for versions

### IRT Analytics

**QuizItemAnalytics** tracks:
- `totalAttempts` / `correctAttempts` — Basic statistics
- `avgTimeSpentMs` — Average time per question
- `pointBisericCorr` — Item discrimination index
- `calibratedDifficulty` — IRT-calibrated difficulty parameter

### Quiz Autosave

The `quizAutosaveWorker.ts` ensures no data loss:
- Answers queued in memory
- Batch flush to CockroachDB every 3 seconds
- Batch size: 50 records
- Upsert logic (no duplicates)

### Passage-Based Questions

- `QuizPassage` supports reading comprehension passages
- Multiple questions can reference the same passage
- passageType: "reading_comprehension"

---

## 16. Socratic AI Coding Assistant (Capgemini Stage 4)

### Architecture

```
Candidate Input → Stage Gate Logic → AI Response → Stage Advancement
                     ↓
              Token Budget (2000)
              Gate Rejection (shallow answers)
              Stage Progression
```

### Stage Progression

| Stage | Name | Required Input | Gate Criteria |
|-------|------|---------------|---------------|
| 1 | **PROBLEM** | Describe the problem in own words | Must mention inputs, outputs, constraints |
| 2 | **DATA_STRUCTURE** | Choose data structure | Must justify choice with reasoning |
| 3 | **APPROACH** | Describe algorithm | Must cover traversal, edge cases, complexity |
| 4 | **AWAITING_CODE_REQUEST** | Request code | Automatic transition |
| 5 | **CODE_GEN** | Receive code | Code with test harness |
| 6 | **REFINEMENT** | Optimize | Iterative improvement |

### Gate Logic

- **Rejects shallow answers** — "I think it's arrays" is rejected
- **Rejects premature code requests** — "Just give me the code" is rejected
- **Validates depth** — Must demonstrate genuine understanding
- **Token tracking** — Each interaction costs tokens from 2000 budget

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assistant/session/init` | POST | Create/reinitialize session |
| `/api/assistant/:sessionId/message` | POST | Send candidate message, get AI response |
| `/api/assistant/:sessionId/history` | GET | Get full conversation transcript |

### Database Models

- `AssistantSession` — Tracks stage, token budget, tokens used
- `CapturedAnswer` — Stores problem summary, DS choice, approach
- `AssistantTranscript` — Full conversation log with gate results
- `AssistantStageEvent` — Stage transitions (gate_pass/gate_reject/stage_advance)
- `AssistantCodeSnapshot` — Generated code versions

### Flagship Problem: LCM of Two Binary Trees

- **Slug:** `lcm-of-two-trees-c`
- **Difficulty:** Medium
- **Category:** Trees & Recursion
- **Languages:** C, C++, Java, Python, JavaScript
- **Test Cases:** 10 (3 visible, 7 hidden)
- **AI Credits:** 2000 per problem
- **Auto-seeded on server boot** via `seedCapgeminiLcmProblem()`

### Token Budget System

- Default: 2,000 tokens per problem
- Tracked in `AssistantSession.tokensUsed`
- Persisted in localStorage (`kryptavia_ai_tokens_{contestId}_{problemId}`)
- Synced with backend on session init
- Visual indicator via `TokenUsageBar` component

---

## 17. Mock Interview System

### Interview Lifecycle

```
SCHEDULED → LIVE → COMPLETED
                  → CANCELLED
```

### Interview Phases

| Phase | Default Duration | Description |
|-------|-----------------|-------------|
| **UNDERSTAND** | 5 minutes | Problem understanding discussion |
| **PLAN** | 10 minutes | Algorithm design & planning |
| **CODE** | 25 minutes | Live coding with collaborative IDE |
| **OPTIMIZE** | 5 minutes | Optimization & edge cases |
| **COMPLETED** | — | Final state |

### Security

- **Access code:** 6-character passcode, bcrypt-hashed
- One-time token for entry
- Passcode sent via email invite (`accessCodePlain`)

### Collaborative IDE

- **Yjs** document-based collaboration
- Real-time code editing via Socket.IO
- Code snapshots at each phase transition
- Execution results tracked

### Feedback System

5 rubric scores (1-5 scale):
1. Problem Understanding
2. Algorithm Design
3. Code Quality
4. Communication
5. Edge Case Handling

**Recommendation:** STRONG_HIRE / HIRE / LEAN_HIRE / NO_HIRE

- `privateNotes` — Only visible to interviewer
- `candidateFeedback` — Shared with candidate after interview

### Hint System

- Candidates can request hints at levels 1, 2, 3
- Interviewer approval required
- Hint content tracked in `InterviewHintRequest`

---

## 18. Company Placement Vaults

### Concept

Password-protected preparation vaults for specific companies, containing:
- Coding problem sets
- Quiz question banks
- PDF study guides
- Interview transcripts
- AI literacy assessments

### Capgemini Vault Configuration

```typescript
{
  name: 'Capgemini Excellence & Coding Vault',
  companyName: 'Capgemini',
  brandColor: '#0091FF',
  targetCtc: '7.5 - 12 LPA',
  examPattern: 'AON Assessment (Pseudocode + Technical MCQ + 2 Coding Problems)',
  accessCode: 'CAPG99',
  materials: [
    'AI Literacy Assessment Questions (Scenario-based MCQs)',
    'Core Coding Assessment Sheet 2026 (15 problems)',
    'Aptitude & Logical Reasoning MCQ Bank (30 questions)',
    'System Design & Interview Prep Guide (PDF)'
  ]
}
```

### Company Classification

| Category | Companies |
|----------|-----------|
| **SERVICE** | TCS Digital, Infosys, Accenture, Wipro, Cognizant, Capgemini |
| **PRODUCT** | Amazon, Google, Microsoft, Meta |
| **FINANCE** | Goldman Sachs, JPMorgan |
| **STARTUP** | Various |

### Material Types

| Type | Description |
|------|-------------|
| **PROBLEM** | Coding problem set with test cases |
| **QUIZ** | Interactive quiz with MCQ questions |
| **PDF_GUIDE** | Downloadable PDF study material |
| **ROUND_INTEL** | Interview round intelligence |

---

## 19. SQL Playground

### Features

- **Monaco Editor** with SQL syntax highlighting
- **Schema visualization** via React Flow (`@xyflow/react`) + Dagre layout
- **Tree view** of database schema
- **WASM execution** via `sql.js` (SQLite in Node/browser)
- **AST validation** via `node-sql-parser` before execution
- **10,000 row limit** to prevent DoS
- **Schema loading** from JSON definition

### Schema Visualization Components

| Component | Purpose |
|-----------|---------|
| SchemaViewer | Main schema visualization container |
| SchemaTreeView | Hierarchical tree view |
| TableNode | Individual table with columns |
| layoutEngine | Dagre-based graph layout |

---

## 20. Web Development Playground

### Features

- **Monaco Editor** with HTML/CSS/JS syntax highlighting
- **Live preview** via iframe
- **Playwright evaluation** in headless Chrome
- **JSDOM failover** when Playwright unavailable
- **4-dimension rubric:** Functionality, Styling, Accessibility, Code Quality
- **Structured JSON spec** + legacy DSL support
- **NLP heuristic parsing** for natural language requirements

---

## 21. Plagiarism Detection

### Algorithm

1. **Tokenization:** Extract tokens from submitted code
2. **Normalization:** Normalize variable names, whitespace, comments
3. **Hashing:** Create token hashes for fast comparison
4. **Structural Analysis:** AST-based comparison (MOSS-style)
5. **Token Similarity:** N-gram overlap calculation
6. **Similarity Score:** Combined structural + token similarity
7. **Report Generation:** Similarity map JSON

### Performance

- **LRU cache** with TTL for repeated comparisons
- Batch processing for contest-wide analysis
- Reports stored in `PlagiarismReport` model

---

## 22. Real-Time Socket Architecture

### Socket.IO Namespaces

| Namespace | Purpose | Events |
|-----------|---------|--------|
| `/quiz-timer` | Exam timer & proctoring | join, leave, warn, block, terminate, pause, resume |
| `/interview` | Interview rooms | presence, code-edit, execute, hint-request |
| `/proctor` | Live proctoring | webcam-frame, screen-frame, violation-alert |

### Transport

```typescript
{
  transports: ['websocket', 'polling'],
  cors: { origin: '*', credentials: true }
}
```

### Quiz Timer Socket

- Candidates join with `(contestId, userId)`
- Timer events: freeze, resume
- Proctor relay: WARN, NUDGE, PAUSE, BLOCK, RESUME, TERMINATE, DISQUALIFY

### Interview Socket

- Interviewer/candidate/observer presence tracking
- Collaborative code editing
- Real-time execution results
- Whiteboard synchronization

---

## 23. Landing Page & Marketing Site

### Architecture

- **Hash-based routing:** `/#/company`, `/#/college`, `/#/about`, `/#/pricing`, `/#/security`
- **Once-seen intro:** `GalaxyCanvas` + `IceBreakOverlay` (localStorage: `kryptaviaos-intro-done`)
- **Framer Motion** page transitions

### Pages

| Page | Sections |
|------|----------|
| **Company** | Hero, Trust Bar, ROI, Live Judge Speed, Proctoring, How It Works, Sample Report, Candidate Experience, CTA |
| **College** | Hero, For Students, For Organizers, Inter-College Leaderboard, Live Judge Speed, Contest Gallery, Problem Showcase, Template Gallery, Certificate Preview, Placement Connect, CTA |
| **About** | Company story, team, mission |
| **Pricing** | Tier comparison |
| **Security** | Security features & compliance |

### Animation System

- **GalaxyCanvas:** WebGL star-field with physics
- **IceBreakOverlay:** Ice-breaking intro animation
- **matter-js:** Physics engine for landing animations
- **d3-delaunay:** Voronoi tessellation effects

---

## 24. Capgemini-Specific Features

### Branding

- **Logo:** Custom SVG spade with `#0070AD` → `#003B73` gradient
- **Brand Color:** `#0091FF` (primary), `#0070AD` (secondary)
- **Used in:** Vault cards, dashboard, sidebar, AI playground, countdown banner

### Capgemini Exclusive Mock Test

**Contest Configuration:**
- **Title:** "Capgemini Exclusive Mock Test"
- **Access Code:** `CAPG99`
- **Duration:** 180 minutes
- **Date:** August 25, 2026, 9:00 AM IST
- **Scoring:** Partial credit per test case
- **Proctoring:** SEB Lockdown, AI Optical Eye-Tracking, Window Blur Interception

**3 Modules:**
1. **Module 1:** AI-Assisted Questioning (Socratic AI)
2. **Module 2:** Algorithmic Debugging
3. **Module 3:** DSA Core Challenges

### AI Literacy Question Bank (19 Questions, 8 Scenarios)

| Scenario | Topic | Questions |
|----------|-------|-----------|
| Legal Review Assistant Memory Loss | Context Window, Grounding & Hallucination | 3 |
| Customer Support Knowledge Retrieval | RAG & Enterprise Grounding | 3 |
| HR Leave-Policy Enterprise Redesign | Prompt/System Design | 2 |
| Hospital AI Prescription Mistranslation | Translation Risk | 2 |
| Radiologist Automation Complacency | Decision Fatigue | 2 |
| Global Consulting MSA Contract Drift | Hallucination | 4 |
| Retail Customer Service Warranty | Sycophancy | 3 |
| Enterprise IT Helpdesk Log Injection | Prompt Injection | 3 |

### Capgemini Selection Process (4 Rounds)

| Round | Format | Duration |
|-------|--------|----------|
| **Round 1** | Online Assessment (AON/Hackerearth) — 2 Algorithmic Coding + Aptitude | 90 Mins |
| **Round 2** | Technical Interview 1 — DS (Trees/Graphs) & Live Pair Programming | 60 Mins |
| **Round 3** | Technical Interview 2 — System Design, DB Schema & CS Fundamentals | 60 Mins |
| **Round 4** | Leadership & HR Fit — Leadership Principles & Behavioral Questions | 45 Mins |

### Capgemini-Specific UI Components

1. **CapgeminiCountdownBanner** — Live countdown with module cards, registration modal
2. **Capgemini Contest Card** — Special 2-column card with watermark logo on dashboard
3. **Capgemini Restricted Modal** — Sidebar/AI playground restriction notice
4. **Capgemini Vault Card** — Company vault with inline spade SVG
5. **Navbar Announcement Bar** — Persistent top bar on landing page

---

## 25. Role-Based Access Control (RBAC)

### Backend Hierarchy (8 roles)

```
SUPER_ADMIN (1) — Full platform access, break-glass
PLATFORM_CONTENT_AUTHOR (2) — Content creation
ORG_ADMIN (3) — Organization management
PROCTOR (4) — Exam monitoring
ORG_MEMBER (5) — Basic member access
EVALUATOR (6) — Grading & evaluation
STUDENT (7) — Contest participation
CANDIDATE (7) — External candidate
```

### Frontend Extended (12 roles)

```
+ ANALYTICS_VIEWER — Read-only analytics
+ GUEST_CANDIDATE — External invite-only
+ COMPLIANCE_OFFICER — GDPR & audit
+ CONTEST_MODERATOR — Grade approval & override
```

### Frontend Role Colors

| Role | Color |
|------|-------|
| SUPER_ADMIN | Red |
| ORG_ADMIN | Blue |
| PROCTOR | Orange |
| TEACHER | Green |
| STUDENT | Purple |
| EVALUATOR | Teal |
| ANALYTICS_VIEWER | Cyan |
| COMPLIANCE_OFFICER | Gray |

### RBAC Middleware Usage

```typescript
// Require minimum hierarchy level
router.get('/admin', authenticateToken, requireMinLevel(3), handler);

// Require exact role
router.post('/proctor/warn', authenticateToken, requireRole('PROCTOR'), handler);

// Require organization access
router.get('/org/problems', authenticateToken, requireOrgAccess, handler);
```

---

## 26. Multi-Tenant SaaS Architecture

### Organization Model

Each organization is a tenant with:
- Isolated data (organizationId foreign keys)
- Custom branding (logo, colors, domain)
- Feature flags (JSON)
- Subscription tier (FREE / PRO / ENTERPRISE)
- Usage limits (maxContests, maxUsers)
- SAML 2.0 SSO configuration

### Data Isolation

All major models have `organizationId`:
- Problems, Contests, Users, Question Banks, Interview Sessions, Company Vaults
- Queries filtered by organizationId via RBAC middleware

### Onboarding Flow (5 Steps)

1. **Organization Identity** — Industry, size, LinkedIn URL
2. **Legal & Location** — Address, GST/PAN/CIN, AISHE code, NIRF ranking
3. **Contact Officer** — Designation, alternate email, domain mismatch
4. **Platform Requirements** — Use cases, expected candidates, preferred format
5. **Legal Agreements** — DPA agreement, certified representative

---

## 27. Offline Support & Resilience

### IndexedDB Service

```typescript
// Database: KryptaviaOS_Quiz_Offline
// Store: offline_answers
// Key: attemptQuestionId

saveAnswerOffline(attemptQuestionId, answerData)  // Store answer
getOfflineAnswers()                                 // Retrieve all
clearOfflineAnswer(attemptQuestionId)               // Delete after sync
```

### Offline Telemetry

```typescript
syncOfflineTelemetryLogs(contestId): Promise<number>
// Returns synced count (stub implementation)
```

### Quiz Autosave Resilience

- Answers queued in memory
- Batch flush every 3 seconds (50 records)
- Survives browser crashes
- Survives network interruptions

### API Resilience

- **Token refresh queue** prevents concurrent refresh attempts
- **Exam route awareness** — No redirect to login during contests
- **Session persistence** — Contest state persisted in sessionStorage
- **Redis graceful degradation** — Falls back to in-memory if Redis unavailable
- **Database retry wrapper** — `withDbRetry` handles P1001/P1002 CockroachDB errors
- **2-minute heartbeat** — Prisma client pings database every 2 minutes

---

## 28. Deployment & DevOps

### Frontend (Vercel)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### Backend (Render)

- **Port:** 5000 (default, configurable via `PORT`)
- **Anti-sleep pinger:** Self-pings `/api/health` every 10 minutes
- **Graceful shutdown:** Closes Playwright browser on SIGTERM/SIGINT
- **Auto-seed:** Capgemini LCM problem seeded on boot

### Database (CockroachDB)

- `DATABASE_URL` — Pooled connection string
- `DIRECT_URL` — Direct connection for migrations
- Client generated to `../src/generated/client`
- Push schema: `npx prisma db push`

### Vite Build Configuration

```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'monaco-editor': ['@monaco-editor/react'],
  'framer': ['framer-motion'],
  'charts': ['recharts', 'd3']
}
```

### Git

- **Branch:** main (single branch)
- **Commits:** 94
- **Remote:** origin/main
- **Working tree:** Clean

---

## 29. Environment Variables & Configuration

### Backend Required

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **YES** | JWT signing secret (crash if missing) |
| `DATABASE_URL` | **YES** | CockroachDB connection URL (crash if missing) |
| `DIRECT_URL` | No | Direct DB connection for migrations |
| `PORT` | No | Server port (default: 5000) |
| `REDIS_URL` | No | Redis connection (graceful degradation) |
| `FRONTEND_URL` | No | Comma-separated allowed origins |
| `KEEP_ALIVE_URL` | No | Anti-sleep self-ping URL |
| `BACKEND_URL` | No | Backend URL for self-ping |

### Backend Optional

| Variable | Description |
|----------|-------------|
| `PISTON_API_URL` | Piston code execution API |
| `JUDGE0_API_URL` | Judge0 code execution API |
| `JUDGE0_API_KEY` | Judge0 RapidAPI key |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:5000`) |

---

## 30. API Error Handling & Status Codes

### Standard Response Format

```json
{
  "success": true/false,
  "message": "Description",
  "data": { },
  "error": "Error details"
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (token missing/invalid) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (duplicate entry) |
| 429 | Rate limited |
| 500 | Internal server error |

### Auth Error Handling

- 401 on expired token → Client refreshes token → Retries request
- 401 on invalid refresh → Logout → Redirect to login
- 401 during exam → No redirect (exam continuity)

---

## 31. Performance Optimizations

### Frontend

- **Manual chunks:** React, Monaco, Framer, Charts split into separate bundles
- **Virtualized lists:** `@tanstack/react-virtual` for large lists
- **Session persistence:** Contest state in `sessionStorage` survives refresh
- **Lazy loading:** Route-based code splitting
- **CSS variables:** Minimal runtime style computation

### Backend

- **Redis caching:** Leaderboard, session data
- **Prisma connection pooling:** Via CockroachDB connection pool
- **Batch operations:** Quiz autosave (50 records every 3s)
- **Rate limiting:** 10 code executions/user/min, 3 auth attempts/15min
- **Database indexes:** Composite indexes on hot query paths

### Database

- **Composite indexes:** `[organizationId, isPublic]`, `[contestId, order]`, `[userId, isRead]`
- **Unique constraints:** Prevent duplicate registrations, attempts
- **Cascade deletes:** Clean up on parent deletion

---

## 32. Security Architecture

### Authentication Security

- bcryptjs 12-round password hashing
- JWT with 7-day expiry (access) + 30-day expiry (refresh)
- Token blacklist for forced logout
- Rate limiting on auth endpoints (3/15min)

### Data Security

- Input sanitization via `sanitize.ts`
- SQL injection prevention via Prisma ORM
- XSS prevention via React's default escaping
- CORS configuration for allowed origins
- 10MB body parser limit

### Exam Security

- SEB lockdown (blocked URLs, features)
- Fullscreen enforcement
- Tab-switch detection
- Copy-paste blocking
- Webcam/screen monitoring
- Sync-cheat detection
- Proctor override capabilities

### Infrastructure Security

- Environment variables for secrets
- No secrets in codebase
- HTTPS in production
- Secure WebSocket connections
- Graceful error handling (no stack traces in production)

---

## 33. Data Models — Relationship Diagram

```
Organization ──┬── User ──┬── Submission
                │          ├── ContestRegistration
                │          ├── ProctoringLog
                │          ├── QuizResponse
                │          ├── AssistantSession
                │          ├── MockInterviewSession (interviewer/candidate)
                │          └── CompanyAccessLog
                │
                ├── Problem ──┬── TestCase
                │              ├── ContestProblem ── Contest
                │              └── Submission
                │
                ├── Contest ──┬── ContestProblem
                │              ├── ContestRegistration
                │              ├── Submission
                │              ├── ProctoringLog
                │              ├── PlagiarismReport
                │              ├── ContestAssignment
                │              ├── ContestSection ──┬── QuizPassage
                │              │                     ├── QuizQuestion ──┬── QuizOption
                │              │                     │                  ├── QuizAttemptQuestion ── QuizResponse
                │              │                     │                  ├── QuizItemAnalytics
                │              │                     │                  └── QuestionVersion
                │              │                     └── ContestAssemblyRule
                │              ├── GuestInvite
                │              └── ContestModerationAssignment
                │
                ├── QuestionBank ── QuizQuestion
                │
                ├── MockInterviewSession ──┬── InterviewParticipant
                │                           ├── InterviewFeedback
                │                           ├── InterviewCodeSnapshot
                │                           ├── InterviewHintRequest
                │                           └── InterviewExecutionResult
                │
                ├── CompanyVault ──┬── CompanyMaterial
                │                   ├── CompanyInterviewTranscript
                │                   └── CompanyAccessLog
                │
                └── AuditLog
                    RefreshToken
                    TeamInvitation
                    OrganizationRequest
                    Notification
                    BreakGlassAuditLog
                    GdprErasureRequest

AssistantSession ──┬── CapturedAnswer
                   ├── AssistantTranscript
                   ├── AssistantStageEvent
                   └── AssistantCodeSnapshot
```

---

## 34. Testing Strategy

### Available Test Scripts

| Script | Purpose |
|--------|---------|
| `test_socratic_simulation.ts` | End-to-end Socratic AI flow (7 turns) |
| `test_quiz_*` | Quiz subsystem tests |
| `test_sql_*` | SQL execution tests |
| `test_webdev_*` | Web dev evaluation tests |
| `test_candidate_*` | Candidate flow tests |
| `test_security_governance_*` | Security governance tests |
| `test_ecommerce_*` | E-commerce integration tests |

### Socratic Simulation Test Flow

```
1. Welcome message → verify stage is PROBLEM
2. Shallow answer → verify REJECT
3. Premature code demand → verify REJECT
4. Genuine Stage 1 answer → verify PASS → advance to DATA_STRUCTURE
5. Shallow Stage 2 → verify REJECT
6. Genuine Stage 2 → verify PASS → advance to APPROACH
7. Genuine Stage 3 → verify PASS → advance to CODE_GEN
8. Verify code generation unlocked
```

### Validation Scripts

| Script | Purpose |
|--------|---------|
| `check_*` | Database/problem validation |
| `verify_db_live.js` | Live database verification |
| `dump_*` | Data export utilities |
| `init_cockroach_db.ts` | Database initialization |
| `reset_cockroach.ts` | Database reset |

---

## 35. Git History & Development Timeline

### Commit Summary (94 commits, main branch)

| Date Range | Focus Area |
|------------|------------|
| Aug 24, 2026 | Initial setup, SQL playground, problem routing, RBAC |
| Aug 24-25 | Participant dashboard, access code gate, contest system |
| Aug 25 | Code execution, submission system, leaderboard |
| Aug 25-26 | SEB integration, contest zone, proctoring |
| Aug 26 | Socratic AI assistant, mock interviews, whiteboard |
| Aug 26-27 | Company vaults, Capgemini branding, quiz instruments |
| Aug 27 | Question governance, analytics, compliance |
| Aug 27-28 | Capgemini countdown, registration modal, landing page |
| Aug 28 | Auth service, token refresh, contest management |
| Aug 28-29 | Database maintenance, backup tooling, proctoring admin |
| Aug 29 | Contest manager routes, proctoring admin scripts |

### Most Recent Commits

1. `213edbf` — Contest manager routes + admin utility scripts
2. `d077082` — Database maintenance scripts
3. `e54723a` — Authentication service with token refresh
4. `cd431d0` — AccessCodeGate + ContestManagement page
5. `c5ac3cf` — ParticipantDashboard with Capgemini assessment UI

---

## 36. Non-Negotiable Invariants

### SEB & Proctoring

1. **SEB gate MUST remain at the top level** of `ContestZoneLayout` wrapping `<Outlet/>`, never inside child tabs
2. **Proctoring uses in-memory** 10s sliding window sync-cheat detection
3. **Frozen quiz sessions** are tracked in-memory (stateless across restarts)
4. **Code execution rate limit** is 10/user/min
5. **SQL sandbox** limits 10k result rows
6. **AST-level injection/DoS validation** before SQL execution

### Authentication

7. **JWT_SECRET and DATABASE_URL are required** — server crashes on boot if missing
8. **Token refresh prevents concurrent refresh attempts** via queue
9. **Exam routes do not redirect to login** on refresh failure

### Database

10. **CockroachDB retry wrapper** handles P1001/P1002 errors
11. **Prisma heartbeat** pings database every 2 minutes
12. **Cascade deletes** on all major relations

### Frontend

13. **Session persistence** in sessionStorage for contest state
14. **ErrorBoundary** wraps entire application
15. **Role-based route guards** on all protected routes

---

## 37. Future Roadmap

### Potential Enhancements

| Area | Feature |
|------|---------|
| **AI** | Integration with GPT-4/Claude for question generation |
| **Mobile** | React Native companion app |
| **LMS** | LTI integration with Moodle/Canvas |
| **Video** | Live video interview rooms (WebRTC) |
| **Analytics** | Advanced IRT calibration with 3PL model |
| **Gamification** | Badges, streaks, achievement system |
| **Multi-language** | i18n support for Hindi, regional languages |
| **Offline** | Full offline mode with service workers |
| **API** | Public API for third-party integrations |
| **Compliance** | SOC 2 Type II certification |

---

*This document was auto-generated from the complete codebase analysis of Kryptavia OS (ContestOS). For questions or updates, refer to the source code or contact the development team.*
