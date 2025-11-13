# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project summary
- FlashChat is a real-time chat and calling app using React (Vite) on the frontend, a small Node/Express + Socket.IO backend, and Firebase (Auth, Firestore, FCM). WebRTC is used for A/V calls; Socket.IO and Firestore are used for signaling/presence. See README.md for a user-facing overview; see docs/ for project-structure notes and backend/README.md for backend deployment.

Common commands
- Frontend (root)
  - Install: npm install
  - Dev server: npm run dev
  - Build: npm run build
  - Preview build: npm run preview
  - Lint: npm run lint
  - Environment setup helpers:
    - Interactive: npm run setup:env
    - Create .env template: npm run setup:env:create
    - Help: npm run setup:env:help
  - FCM utilities:
    - Debug/generate VAPID keys: npm run fcm:debug | npm run fcm:generate
- Backend (Node/Express + Socket.IO)
  - Install: cd backend && npm install
  - Dev: cd backend && npm run dev
  - Start: cd backend && npm start
- Firebase Functions (optional / not actively used per README)
  - Install: cd functions && npm install
  - Emulators: cd functions && npm run serve
  - Deploy: cd functions && npm run deploy

Testing
- No test runner is currently configured in package.json; there is no working npm test script in the root, and backend’s test script is a placeholder. Running single tests is not applicable until a test framework is added.

Environment and configuration
- Frontend uses Vite; environment variables are provided via .env (example: .env.example). For FCM, VITE_FCM_VAPID_KEY must be set; setup helpers are provided via scripts/setup-env.js (see the commands above).
- Vite path alias: '@' resolves to ./src (see vite.config.js). Use absolute imports from '@' for app-internal modules.
- Linting: ESLint is configured (eslint.config.js, modern flat config). A legacy .eslintrc.js also exists; npm run lint executes eslint . and will use the flat config.
- Formatting: .prettierrc exists, but Prettier is not listed in devDependencies at the root.

High-level architecture and structure
- Frontend (React + Vite + Tailwind)
  - Feature-first organization under src/ (see README.md and docs/README.md):
    - features/: auth, chat, call, notifications, user
    - shared/: reusable components/hooks/services/utils
    - config/: firebase config and app-level constants
  - Real-time UX: WebRTC for calls; Socket.IO client for real-time presence/call events; Firestore for messages and metadata. FCM enables push notifications via a service worker.
- Backend (Node/Express + Socket.IO)
  - Provides WebSocket signaling and real-time events; integrates with Firebase Admin (for FCM) and supports uploads (multer) and Google Cloud Storage (@google-cloud/storage). Defaults to port 3001 (or process.env.PORT). See backend/README.md.
- Firebase Functions (optional)
  - Scaffolded with firebase-admin and firebase-functions; Node 18 engine; not actively used per root README.

Notes for agents
- Preferred package manager is npm (package-lock.json present in root and backend). Install dependencies separately in each package.json-containing directory (root, backend, functions if in use).
- For backend deployments, backend/README.md documents Railway usage (railway up). For frontend hosting, the root README describes Firebase Hosting flow after npm run build.
- Documentation files present:
  - README.md (root): product/features overview and developer scripts; FCM setup expectations.
  - docs/README.md: feature-based structure guidance.
  - backend/README.md: local dev and Railway deployment.
