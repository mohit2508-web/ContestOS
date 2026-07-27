# ContestOS — Standalone B2B Assessment & Contest Platform

ContestOS is an enterprise-grade, high-performance online contest and assessment platform designed for universities, colleges, and companies.

## Features
- **Codeforces-Style Code Execution Engine**: Direct `stdin` / `stdout` testing for C++, Java, Python, JavaScript, Go, Rust, C#, etc.
- **Safe Exam Browser (SEB) Deep Integration**: Locked-down assessment environment with candidate-specific `.seb` config generator and seamless single-use token auto-login.
- **Advanced Anti-Cheat & Proctoring**: Real-time tab-switch detection, fullscreen enforcement, webcam snapshot proctoring, and MOSS/AST plagiarism similarity detection.
- **Real-Time Live Leaderboard**: Powered by Redis for instantaneous score updates under high concurrency.
- **Multi-Tenant SaaS Support**: Separate organization branding, teacher dashboards, and student candidate portals.

## Project Structure
```
ContestOS/
├── backend/          # Express + TypeScript + Prisma API & Execution Engine
├── frontend/         # React + Vite + TailwindCSS + Monaco Code Editor
└── README.md
```

## Quick Start

### Backend
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
