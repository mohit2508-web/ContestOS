# 🔒 STRICT ARCHITECTURAL INVARIANTS: SEB LOCKDOWN & PROCTORING ENGINE

This document defines non-negotiable architectural invariants for the **Kryptavia OS (ContestOS)** exam platform. These rules must be strictly preserved across all future updates, refactorings, and feature additions.

---

## 1. 🛡️ SEB LOCKDOWN GATE INVARIANT (`ContestZonePage.tsx`)

> [!CAUTION]
> **NEVER MOVE SEB GATING LOGIC INSIDE CHILD TAB COMPONENTS (`OverviewTab`, `ProblemsTab`).**

- **Rule**:
  Safe Exam Browser (SEB) enforcement MUST ALWAYS be rendered at the top level of `ContestZoneLayout`, wrapping the `<Outlet />`.
- **Why**:
  Candidates entering an exam via `/contests/:contestId` are automatically redirected to `/contests/:contestId/problems`. If the SEB gate is placed only inside `OverviewTab`, candidates landing directly on `/problems` will completely bypass the SEB Lockdown launcher screen.
- **Enforcement Code**:
  ```tsx
  {contest?.requireSeb && !isSebBrowser && !bypassSeb && (
    <SebGateOverlay contest={contest} onBypass={() => setBypassSeb(true)} />
  )}
  ```
- **Requirements for SEB Gate**:
  1. Must display **"🚀 1-Click Launch SEB"** (`seb://` protocol launch token).
  2. Must display **"📥 Download .seb Config File"** (fetches `/api/contests/manager/:id/seb-config`).
  3. Must display **"⚡ Continue in Preview / Dev Mode"** button for quick developer testing.

---

## 2. 📡 PROCTOR ACTION SOCKET RELAY INVARIANT (`contest-manager.routes.ts`)

> [!IMPORTANT]
> **EVERY PROCTOR ACTION MUST BROADCAST A WEBSOCKET EVENT TO THE CANDIDATE'S SOCKET ROOM.**

- **Rule**:
  When a proctor issues a `WARN` / `NUDGE`, `PAUSE` / `BLOCK`, `RESUME` / `UNBLOCK`, or `TERMINATE` / `DISQUALIFY` action via REST API (`/api/contests/manager/:id/proctor-action`), the backend MUST:
  1. Normalize the action string using `String(action).toLowerCase()`.
  2. Create the Prisma database log row in `proctoringLog`.
  3. **IMMEDIATELY emit the WebSocket event `proctor:action` to room `user:${userId}:contest:${contestId}`** over namespace `/quiz-timer`.

- **Why**:
  Logging to the database without emitting WebSocket events leaves the candidate's browser completely unaware of the proctor's intervention, breaking the live warning modal and pausing UI.

---

## 3. 🚨 HIGH-IMPACT WARNING MODAL INVARIANT (`SecureContestWrapper.tsx`)

> [!NOTE]
> **CANDIDATE WARNINGS MUST ALWAYS TRIGGER THE FULL-SCREEN WARNING MODAL.**

- **Rule**:
  When the candidate's socket receives `action.action === 'WARNED'`, `SecureContestWrapper` MUST update the `warnings` state and set `showWarningModal(true)` with the 5-second countdown acknowledgement timer.

---

## 🧪 Compliance Checklist for Developers
- [x] SEB Lockdown Gate is evaluated at `ContestZoneLayout` level.
- [x] `proctor-action` handles both uppercase (`WARN`) and lowercase (`warn`) actions.
- [x] Socket broadcasts target `user:${userId}:contest:${contestId}` room.
- [x] `vite build` passes with 0 errors.
