# 🚀 Kryptavia OS — Testing Deployment, Pre-Flight Checklist & System Audit Manual

> **Official Enterprise Documentation**  
> **Target Audience**: Core Engineering Team, DevOps Engineers, QA Testers  
> **Status**: STAGING / PREVIEW TESTING READY  
> **Last Updated**: August 2026  

---

## 1. Executive Summary & Testing Scope

This document provides a **complete 360° deployment guide and risk analysis** for launching **Kryptavia OS** in a **Testing/Staging Environment** (before final production deployment).

### Primary Goals for Staging Deployment:
- **Low/Zero Cost Setup**: Utilize free-tier serverless databases (CockroachDB / Supabase) and static/container preview platforms (Vercel, Render, Railway).
- **Comprehensive Route Testing**: Verify end-to-end functionality for all 26 backend route controllers.
- **Failover Verification**: Test built-in fallback mechanisms (Playwright → JSDOM failover, Judge0 → Local Code Runner fallback, SSO → Mock Auth fallback).
- **Incident Mitigation**: Identify and document potential runtime errors, browser engine limits, proxy timeouts, and database connection pooling thresholds.

---

## 2. Pre-Deployment Pre-Flight Checklist

Before pushing any code or triggering deployment builds on Vercel/Render, complete this mandatory verification checklist:

### A. Codebase & Build Health
- [x] **Frontend Production Build**: `cd frontend && npm run build` (Must succeed with zero TypeScript or Vite bundle errors).
- [x] **Backend Production Build**: `cd backend && npm run build` (Must execute `tsc` with zero compilation errors).
- [x] **Workspace Rebranding Audit**: All user-facing strings, logos, favicons, emails, and localStorage keys updated to `Kryptavia OS` / `kryptaviaos`.

### B. Database & Schema Preparation
- [ ] **Prisma Schema Verification**: Run `npx prisma validate` inside `backend/`.
- [ ] **Database Connection Check**: Verify `DATABASE_URL` and `DIRECT_URL` point to the target PostgreSQL / CockroachDB testing database.
- [ ] **Database Migration Push**: Execute `npx prisma db push` or `npx prisma migrate deploy` on the target testing database.
- [ ] **Seed Data Execution**: Execute `npx prisma db seed` to seed initial Super Admin (`admin@kryptavia.io`), test organizations (IIT Delhi, GLA University), and quick-access credentials.

### C. Networking & Security
- [ ] **CORS Origins Allowed**: Verify backend `app.ts` includes the exact frontend Vercel preview domain (e.g. `https://kryptaviaos.vercel.app` or `https://*.vercel.app`).
- [ ] **JWT Secret Set**: Ensure `JWT_SECRET` is set to a secure, random string (at least 32 characters) in backend environment variables.
- [ ] **HTTPS Enforced**: Ensure all API requests pass over `https://` in non-localhost environments.

---

## 3. Recommended Testing Deployment Architecture

For staging and preview testing without incurring high infrastructure costs, use the following cloud topology:

```
                  ┌──────────────────────────────────────────┐
                  │          User / QA Candidate             │
                  └────────────────────┬─────────────────────┘
                                       │
                               HTTPS / WSS / SSE
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
  ┌────────────────────────────┐               ┌─────────────────────────────┐
  │      Vercel Hosting        │               │      Render / Railway       │
  │     (Frontend Client)      │               │        (Backend API)        │
  │  kryptaviaos.vercel.app    │               │  kryptaviaos-api.onrender   │
  └─────────────┬──────────────┘               └──────────────┬──────────────┘
                │                                             │
                │              REST API Calls                 │
                └─────────────────────────────────────────────┤
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                        ┌─────────────────────────────┐               ┌─────────────────────────────┐
                        │   CockroachDB / Supabase    │               │    Upstash Redis Serverless │
                        │  (PostgreSQL Database)      │               │   (Caching & Leaderboards)  │
                        └─────────────────────────────┘               └─────────────────────────────┘
```

| Component | Recommended Testing Provider | Tier / Cost | Justification |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | **Vercel** | Free | Automatic Vite builds, global CDN, instant preview deployments for PRs. |
| **Backend API** | **Render Web Service** / **Railway** | Free / $5 credit | Native Node.js support, automatic SSL, background worker support. |
| **Database** | **CockroachDB Serverless** / **Supabase** | Free (5GB) | Full PostgreSQL compatibility, ACID compliance, serverless connection handling. |
| **Redis Cache** | **Upstash Redis** | Free (10k req/day) | Serverless HTTP/Redis protocol, perfect for live leaderboard testing. |

---

## 4. Step-by-Step Testing Deployment Instructions

### Step 1: Deploy Database (CockroachDB Serverless / Supabase)
1. Create a free database instance on [CockroachDB Cloud](https://cockroachlabs.cloud/) or [Supabase](https://supabase.com/).
2. Copy the connection string (`postgresql://user:pass@host:5432/db?sslmode=verify-full`).
3. Update `backend/prisma/schema.prisma` datasource provider if necessary (`postgresql` or `cockroachdb`).
4. In local terminal, run:
   ```bash
   cd backend
   export DATABASE_URL="your-testing-db-connection-string"
   npx prisma db push
   npm run seed
   ```

### Step 2: Deploy Backend API on Render / Railway
1. Push repository to GitHub.
2. Log in to [Render](https://render.com/) → **New Web Service** → Select your repository.
3. Set Environment Configuration:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/app.js`
4. Add Environment Variables (see [Section 5](#5-master-environment-variable-matrix)).
5. Deploy Web Service and note the generated backend URL (e.g., `https://kryptaviaos-api.onrender.com`).

### Step 3: Deploy Frontend on Vercel
1. Log in to [Vercel](https://vercel.com/) → **Add New Project** → Import repository.
2. Select Framework Preset: **Vite**.
3. Set **Root Directory**: `frontend`.
4. Add Environment Variable:
   - `VITE_API_URL` = `https://kryptaviaos-api.onrender.com` (your backend URL)
5. Click **Deploy**.

---

## 5. Master Environment Variable Matrix

### Backend Environment Variables (`backend/.env`)

| Variable Name | Required? | Fallback Value | Description / Security Note |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `5000` | Port for Express server (Set automatically by Render/Heroku). |
| `NODE_ENV` | **Yes** | `development` | Set to `production` or `staging` in deployed testing environments. |
| `DATABASE_URL` | **Yes** | *None* | Primary PostgreSQL / CockroachDB connection string. |
| `DIRECT_URL` | Optional | *Same as DATABASE_URL* | Direct DB connection string for Prisma migrations. |
| `JWT_SECRET` | **Yes** | *None* | Secret key for signing JWT auth tokens. Must be >= 32 hex chars. |
| `FRONTEND_URL` | **Yes** | `http://localhost:5173` | Allowed CORS origin (e.g. `https://kryptaviaos.vercel.app`). |
| `BACKEND_URL` | Optional | `http://localhost:5000` | Full URL of the backend API server. |
| `KEEP_ALIVE_URL` | Optional | *Uses BACKEND_URL* | Public URL for built-in anti-sleep self-ping engine (e.g. `https://kryptaviaos-api.onrender.com`). |
| `REDIS_URL` | Optional | *In-memory fallback* | Redis connection string for live leaderboards & caching. |
| `JUDGE0_API_KEY` | Optional | *Mock local runner* | RapidAPI / Judge0 API key for code execution. |
| `JUDGE0_BASE_URL` | Optional | `https://ce.judge0.com` | Base URL for remote code execution engine. |
| `PISTON_API_URL` | Optional | `https://emkc.org/api/v2/piston` | Alternative Piston code execution API. |
| `GOOGLE_CLIENT_ID` | Optional | *Mock SSO Mode* | OAuth 2.0 Client ID for Google login. |
| `GOOGLE_CLIENT_SECRET` | Optional | *Mock SSO Mode* | OAuth 2.0 Client Secret for Google login. |
| `GITHUB_CLIENT_ID` | Optional | *Mock SSO Mode* | GitHub OAuth Client ID. |
| `GITHUB_CLIENT_SECRET` | Optional | *Mock SSO Mode* | GitHub OAuth Client Secret. |

### Frontend Environment Variables (`frontend/.env`)

| Variable Name | Required? | Fallback Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `http://localhost:5000` | Full URL of the backend API server. |
| `VITE_APP_TITLE` | Optional | `Kryptavia OS` | Global application brand title. |

---

## 6. Complete 26-Route System & Endpoint Audit Report

Every backend route controller has been audited for security, authentication requirements, and testing operational status:

| Route Controller File | Endpoint Prefix | Auth Level | Key Responsibilities & Audit Status |
| :--- | :--- | :--- | :--- |
| [auth.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/auth.routes.ts) | `/api/auth` | Public / Bearer JWT | Registration, Login, Token Refresh, Password Reset, User Profile. ✅ Tested |
| [sso.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/sso.routes.ts) | `/api/auth/sso` | Public / SSO Callback | Google, GitHub, LinkedIn OAuth 2.0 & Enterprise SAML 2.0 logins. ✅ Tested (With Mock Mode) |
| [contest-manager.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/contest-manager.routes.ts) | `/api/contests/manager` | Org Member / Admin | Exam creation, `.seb` config generator, live candidate control. ✅ Tested |
| [contests.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/contests.routes.ts) | `/api/contests` | Candidate / Student | Contest catalog, registration, problem listing, section details. ✅ Tested |
| [submissions.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/submissions.routes.ts) | `/api/submissions` | Student / Candidate | Code submission, evaluation queueing, submission history. ✅ Tested |
| [code.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/code.routes.ts) | `/api/code` | Authenticated | Direct code runner execution against testcases. ✅ Tested |
| [webdev.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/webdev.routes.ts) | `/api/webdev` | Student / Candidate | HTML/CSS/JS frontend challenge evaluation & screenshotting. ✅ Tested (Playwright + JSDOM Fallback) |
| [quiz.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/quiz.routes.ts) | `/api/quiz` | Student / Candidate | MCQ, Fill-in-the-blank, Hotspot grading & AES-256 payload retrieval. ✅ Tested |
| [question-governance.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/question-governance.routes.ts) | `/api/governance` | SME / Content Author | Global Question Bank, 4-Eyes Review workflow, versioning. ✅ Tested |
| [guard.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/guard.routes.ts) | `/api/guard` | Student Candidate | Tab-switch event logging, full-screen violations, webcam snapshots. ✅ Tested |
| [proctor.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/proctor.routes.ts) | `/api/proctor` | Proctor / Admin | Real-time candidate monitoring dashboard, session freeze/unfreeze. ✅ Tested |
| [leaderboard.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/leaderboard.routes.ts) | `/api/leaderboard` | Public / Student | Real-time ranked leaderboards (global, department, contest). ✅ Tested |
| [org.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/org.routes.ts) | `/api/org` | Org Admin | Tenant organization management, team invitations, SAML config. ✅ Tested |
| [org-request.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/org-request.routes.ts) | `/api/org-requests` | Public / Super Admin | Institution onboarding application submission & review. ✅ Tested |
| [admin.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/admin.routes.ts) | `/api/admin` | Super Admin | System-wide metrics, tenant management, global configuration. ✅ Tested |
| [analytics-viewer.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/analytics-viewer.routes.ts) | `/api/analytics` | Analytics Viewer | Read-only candidate scorecards, aggregate drive analytics. ✅ Tested |
| [compliance.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/compliance.routes.ts) | `/api/compliance` | Compliance Officer | GDPR Article 15 export, PII erasure, SOC2 audit log CSV export. ✅ Tested |
| [guest.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/guest.routes.ts) | `/api/guest` | Public Token | Ephemeral candidate guest access, token validation, instant score. ✅ Tested |
| [notification.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/notification.routes.ts) | `/api/notifications` | Authenticated / SSE | Real-time SSE alert streaming, notification mark as read. ✅ Tested |
| [evaluator.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/evaluator.routes.ts) | `/api/evaluator` | Evaluator | Manual grading queue for subjective answers & partial credit. ✅ Tested |
| [assignment.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/assignment.routes.ts) | `/api/assignments` | Org Admin / Teacher | Faculty contest drive assignments & role delegations. ✅ Tested |
| [billing.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/billing.routes.ts) | `/api/billing` | Org Admin | Subscription plan status, invoice history, usage limits. ✅ Tested |
| [plagiarism.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/plagiarism.routes.ts) | `/api/plagiarism` | Org Admin / Moderator | AST & MOSS code similarity detection reports. ✅ Tested |
| [playground.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/playground.routes.ts) | `/api/playground` | Authenticated | Multi-language code sandbox playground execution. ✅ Tested |
| [app.ts (Health)](file:///d:/New%20folder%20(3)/ContestOS/backend/src/app.ts) | `/api/health` | Public | Core API Engine & Database Connectivity Ping. ✅ Tested |

---

## 7. Future Risk Matrix & Error Troubleshooting Manual

This section details **10 potential failure modes** that can occur in staging/production environments, along with root causes, diagnostic signals, and step-by-step mitigations:

### ⚠️ Risk 1: Playwright Headless Browser Fails on Linux Container Deployments (e.g. Render / Docker)
- **Symptom**: WebDev submissions fail with `browser.launch: Host system missing dependencies: libnss3.so, libatk-bridge-2.0.so.0...`.
- **Root Cause**: Linux containers (Debian/Ubuntu) do not come with X11/GLib/NSS C-libraries required by Chromium.
- **Built-in System Protection**: In [webDevEvaluatorV2.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/services/webDevEvaluatorV2.ts), the engine automatically catches browser launch failure and **fails over to JSDOM in-process evaluation** (`webDevEvaluator.ts`) without crashing the server!
- **Permanent Solution**:
  If full Playwright screenshotting is required on Render, add a custom build command in Render settings:
  ```bash
  npm install && npx playwright install-deps chromium && npx playwright install chromium && npm run build
  ```

### ⚠️ Risk 2: SSE (Server-Sent Events) Connections Dropping Every 60 Seconds
- **Symptom**: Notifications disconnect intermittently; browser console shows `GET /api/notifications/stream net::ERR_HTTP2_PROTOCOL_ERROR`.
- **Root Cause**: Reverse proxies (Cloudflare, Nginx, Render proxy) automatically terminate idle HTTP requests after 60 seconds.
- **Built-in System Protection**: In [notification.routes.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/routes/notification.routes.ts), a `:keep-alive\n\n` comment ping is dispatched to every open SSE stream **every 30 seconds**.
- **Mitigation**: Ensure reverse proxy buffer is disabled (`X-Accel-Buffering: no` header is already set in response).

### ⚠️ Risk 3: CockroachDB Connection Pool Exhaustion (`P1001: Cannot connect to DB`)
- **Symptom**: High concurrency during contests causes database connections to fail with `connection limit reached`.
- **Root Cause**: Each Node.js server instance opens multiple connections. Serverless databases have default connection limits.
- **Mitigation**:
  1. Add connection pooling parameters to `DATABASE_URL`:
     ```env
     DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10&sslmode=verify-full"
     ```
  2. Use Prisma connection pooling (e.g., Prisma Accelerate or Supabase Transaction Bouncer on port 6543).

### ⚠️ Risk 4: CORS Preflight Blocked (`Access to XMLHttpRequest has been blocked by CORS policy`)
- **Symptom**: Frontend calls to API fail with 403 or CORS origin errors in browser console.
- **Root Cause**: `FRONTEND_URL` environment variable on backend does not match exact frontend Vercel origin.
- **Mitigation**:
  - Set `FRONTEND_URL` on backend to your exact Vercel URL (e.g. `https://kryptaviaos.vercel.app`).
  - In `app.ts`, the CORS middleware dynamically matches `localhost`, `*.vercel.app`, and `*.onrender.com`.

### ⚠️ Risk 5: External Code Runner Unavailable (Judge0 / Piston Rate Limits)
- **Symptom**: Candidate code runs fail with `503 Service Unavailable` or `429 Too Many Requests`.
- **Root Cause**: Public Judge0 / Piston APIs hit free-tier rate limits during large testing drives.
- **Mitigation**:
  - The system in [externalCodeExecutor.ts](file:///d:/New%20folder%20(3)/ContestOS/backend/src/services/externalCodeExecutor.ts) supports fallback provider chaining (`RapidAPI Judge0` → `Public Judge0` → `Piston` → `Local Execution Adapter`).
  - For high volume testing, provision a dedicated Judge0 container or set `JUDGE0_RAPID_API_KEY`.

### ⚠️ Risk 6: OAuth / SSO Redirect URI Domain Mismatches
- **Symptom**: Google / GitHub login fails with `redirect_uri_mismatch`.
- **Root Cause**: Google Cloud Console or GitHub OAuth App contains `http://localhost:5000/api/auth/sso/google/callback` instead of staging domain.
- **Mitigation**:
  - Add `https://your-backend.onrender.com/api/auth/sso/google/callback` to Authorized Redirect URIs in developer console.
  - If keys are missing, `sso.routes.ts` automatically operates in **Dev Mock Mode** for instant login testing!

### ⚠️ Risk 7: WebDev Sandbox Execution Memory Limits
- **Symptom**: Submitting heavy 3D or WebGL JavaScript challenges causes backend memory spike.
- **Root Cause**: V8 memory growth inside Playwright page instances.
- **Mitigation**:
  - Playwright contexts are forcibly closed after 8000ms timeout in `webDevEvaluatorV2.ts`.
  - Memory caps are enforced via Node `--max-old-space-size=512`.

### ⚠️ Risk 8: Safe Exam Browser (.seb) Key Validation Failures
- **Symptom**: Candidates opening exam in Safe Exam Browser receive "Invalid SEB Config Key".
- **Root Cause**: SEB Browser Exam Key (BEK) hash changes if `.seb` file is re-saved using different line endings (CRLF vs LF).
- **Mitigation**:
  - The SEB config generator in `contest-manager.routes.ts` normalizes XML payloads to LF line endings prior to SHA-256 hash generation.

### ⚠️ Risk 9: Missing JWT_SECRET Initialization Crash
- **Symptom**: Backend crashes on startup with `JWT_SECRET is required`.
- **Root Cause**: Forgetting to add `JWT_SECRET` in environment variables.
- **Mitigation**: Always set `JWT_SECRET` in Render/Railway environment configuration dashboard.

### ⚠️ Risk 10: In-Memory Rate Limiting Reset on Server Restart
- **Symptom**: Failed login attempt counters reset when backend container restarts.
- **Root Cause**: Default rate limiters use in-memory store.
- **Mitigation**: Provide `REDIS_URL` in production to persist rate-limiting state across container restarts.

---

## 8. Staging-to-Production Migration Blueprint

When moving from **Testing/Staging** to **Final Enterprise Production**:

1. **Database Tier**: Upgrade from Serverless Free Tier to Dedicated CockroachDB Dedicated Cluster or Managed AWS Aurora PostgreSQL with multi-AZ replication.
2. **Domain Setup**: Bind custom SSL domains (e.g. `app.kryptavia.com` for Frontend, `api.kryptavia.com` for Backend).
3. **Execution Sandboxing**: Containerize code execution engine into isolated Docker/gVisor microservices or dedicated Judge0 instances.
4. **Caching & SSE**: Provision dedicated Redis cluster (e.g. AWS ElastiCache / Redis Enterprise) for zero-latency leaderboards and global SSE pub/sub.
5. **Monitoring & Logging**: Integrate Sentry for error tracking and Datadog/Prometheus for APM metrics.
