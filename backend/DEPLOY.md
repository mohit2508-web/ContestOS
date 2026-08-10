# Kryptavia OS Backend — Render Deployment Config
# Build Command: npm install && npm run build
# Start Command: node dist/app.js

# Required Environment Variables (set in Render dashboard):
# DATABASE_URL        = cockroachdb://...  (your CockroachDB connection string)
# DIRECT_URL          = cockroachdb://...  (your CockroachDB direct URL)
# JWT_SECRET          = <random 64-char hex string>
# FRONTEND_URL        = https://kryptaviaos.vercel.app (your Vercel URL)
# PORT                = 5000 (set by Render automatically)
