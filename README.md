# Detective ML

A detective mystery game where players investigate crime scenes, interrogate suspects, collect evidence, and build timelines to solve the case. Every conversation, suspect personality, and case is dynamic — no two playthroughs are alike.

## What Is It?

DetectiveML drops you into a noir-styled investigation. You play as a detective given a case briefing, a handful of initial evidence, and a room full of suspects. Your job: figure out who did it.

**Gameplay loop:**

1. **Browse cases** — pick from curated Featured cases, community-published Network cases, or your own creations.
2. **Review the briefing** — read the case description, study the initial evidence (photos, documents), and check the known timeline.
3. **Interrogate suspects** — have free-form AI conversations. Ask questions, present evidence, perform physical actions (search pockets, check alibis). Each suspect has a unique personality, backstory, and set of hidden evidence they may reveal — or hide.
4. **Manage aggravation** — push too hard and a suspect lawyers up. Use your partner's Good Cop / Bad Cop interventions (limited charges) to de-escalate or pressure them.
5. **Build the timeline** — as suspects mention specific times, those entries are automatically extracted and added to a shared interactive timeline you can cross-reference.
6. **Consult your Chief** — radio in for hints when you're stuck.
7. **Make your accusation** — select one or more suspects (or nobody) and close the case. Get graded on evidence collected, suspects spoken to, and timeline completeness.

**Case creation:**

Players can create their own cases by typing a prompt (e.g. *"A murder at a jazz club in 1920s New York"*) or hitting **I'm Feeling Lucky**. Gemini generates the full case — suspects, evidence, timelines, alibis, relationships, motives, and AI-generated pixel-art portraits. Cases can be edited in a full visual editor before publishing to the community.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Styled Components, Framer Motion |
| Build | Vite 6 |
| AI | Google Gemini (`@google/genai`) — chat, case generation, image generation, TTS |
| Auth | Firebase Auth (Google sign-in) |
| Backend | Express 5 (TypeScript) — API proxy for Firebase |
| Database | Firebase Realtime Database |
| Storage | Firebase Cloud Storage (images) |
| Monorepo | npm workspaces |

## Project Structure

```
detective-ml/
├── frontend/          ← React + Vite web app (port 3000)
│   ├── components/    ← Reusable UI (Layout, SuspectCard, CRT overlay, etc.)
│   ├── screens/       ← Full-screen views (CaseSelection, CaseHub, Interrogation, etc.)
│   ├── services/      ← AI services (geminiChat, geminiCase, geminiImages, TTS, persistence)
│   ├── contexts/      ← React contexts (onboarding)
│   ├── hooks/         ← Custom hooks
│   ├── App.tsx        ← Main orchestrator — game state, routing, all game logic
│   └── types.ts       ← TypeScript types for the full data model
├── backend/           ← Express API server — Firebase proxy (port 4000)
│   └── src/
│       ├── routes/    ← cases, stats, images endpoints
│       └── middleware/ ← Firebase Auth token verification
├── docs/              ← Reference documentation
├── .env.local         ← Root env file (frontend vars, loaded by Vite)
└── package.json       ← npm workspaces root
```

### Frontend Architecture

The frontend is a single-page app organized around **screens** and **services**:

| Screen | Purpose |
|--------|---------|
| `CaseSelection` | Browse Featured / Network / My Cases tabs with sorting and stats |
| `CreateCase` | Prompt-based AI case generation ("I'm Feeling Lucky" or custom prompt) |
| `CaseReview` | Full visual editor — edit suspects, evidence, timelines, portraits, then publish |
| `CaseHub` | Investigation HQ — evidence board, suspect cards, Chief radio, timeline, accuse button |
| `Interrogation` | Free-form AI chat with a suspect — talk, act, present evidence, partner interventions |
| `Accusation` | Select the guilty suspect(s) to close the case |
| `EndGame` | Results screen with stats, voting, and case review |

Key services:

| Service | What it does |
|---------|-------------|
| `geminiChat.ts` | Suspect interrogation — structured AI responses with emotion, aggravation, evidence reveals |
| `geminiCase.ts` | Full case generation from a prompt — suspects, evidence, alibis, timelines, relationships |
| `geminiImages.ts` | AI pixel-art portrait and evidence image generation |
| `geminiTTS.ts` | Text-to-speech for suspect/partner dialogue |
| `persistence.ts` | API client for backend (cases, stats, voting) + localStorage drafts |
| `apiBase.ts` | Smart API base URL — auto-rewrites `localhost` to LAN IP for mobile testing |

### Backend Architecture

The backend is a thin Express server that acts as a Firebase proxy. The frontend authenticates directly with Firebase Auth (Google sign-in), then sends the Firebase ID token with every API request. The backend verifies the token and performs all database/storage operations using a Firebase Admin SDK service account.

**Endpoints:**
- `GET /api/cases` — list published cases (or `?authorId=` for user-specific)
- `PUT /api/cases/:id` — create or update a case
- `POST /api/cases/:id/publish` — publish a case to the community
- `DELETE /api/cases/:id` — delete a case
- `GET /api/stats` — all case stats (plays, votes)
- `POST /api/stats/:id/results` — record a game result
- `POST /api/stats/:id/vote` — upvote/downvote
- `POST /api/images/upload` — upload base64 images to Firebase Storage
- `GET /api/health` — health check (unauthenticated)
- `GET /api-docs` — Swagger UI (unauthenticated)

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| **Node.js** | v18+ (v20 LTS recommended) | `node -v` |
| **npm** | v9+ (ships with Node 18+) | `npm -v` |
| **Git** | Any recent version | `git --version` |

You will also need accounts / access to:

- **Google Cloud / Firebase** — for authentication, Realtime Database, and Cloud Storage
- **Google AI Studio** — for a Gemini API key (powers AI game features)

---

## First-Time Setup

### 1. Clone the Repository

```bash
git clone <repo-url>
cd detective-ml
```

### 2. Install Dependencies

The project uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces). A single install from the root fetches dependencies for both `frontend/` and `backend/`:

```bash
npm install
```

### 3. Set Up Firebase Project

If you don't already have a Firebase project, create one:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**
2. Enable **Google sign-in** under **Authentication → Sign-in method**
3. Create a **Realtime Database** (start in test mode for local dev)
4. Enable **Cloud Storage** (start in test mode for local dev)

#### 3a. Get Firebase Web Config (for the frontend)

1. In Firebase Console → **Project Settings → General**
2. Under **Your apps**, click the web icon (`</>`) to register a web app (if not already registered)
3. Copy the config values — you'll need: `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`

#### 3b. Generate a Service Account Key (for the backend)

1. In Firebase Console → **Project Settings → Service Accounts**
2. Click **Generate new private key** → download the JSON file
3. Save it as `backend/.auth/serviceAccountKey.json`

> ⚠️ **Never commit this file.** It is already in `.gitignore`.

### 4. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API key**
3. Copy the key — you'll use it in the frontend env file

### 5. Configure Environment Files

The project requires **two** `.env` files — one for the frontend and one for the backend.

#### 5a. Frontend — `.env.local` (project root)

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Gemini API Key (required for AI-powered game features)
GEMINI_API_KEY=AIzaSy...your_key_here

# Firebase Configuration (Auth only — DB/Storage go through backend)
VITE_FIREBASE_API_KEY=AIzaSy...your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456

# Backend API URL (default works for local development)
VITE_API_BASE_URL=http://localhost:4000
```

> **Note:** Vite loads `.env.local` from the project root. Variables prefixed with `VITE_` are exposed to the browser; `GEMINI_API_KEY` is injected at build time via `vite.config.ts`.
>
> **LAN access:** You can keep `VITE_API_BASE_URL=http://localhost:4000` even when testing on a phone. The frontend automatically detects LAN access (e.g. `http://192.168.x.x:3000`) and rewrites API calls to use the correct host.

#### 5b. Backend — `backend/.env`

Copy the example and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Firebase Admin SDK — path to your service account key
GOOGLE_APPLICATION_CREDENTIALS=.auth/serviceAccountKey.json

# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# Server Configuration
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ | — | Path to service account JSON key file (relative to `backend/`) |
| `FIREBASE_SERVICE_ACCOUNT` | — | — | Alternative: JSON string of the service account (for cloud deploys) |
| `FIREBASE_DATABASE_URL` | ✅ | — | Firebase Realtime Database URL |
| `FIREBASE_STORAGE_BUCKET` | ✅ | — | Firebase Cloud Storage bucket name |
| `PORT` | — | `4000` | Backend server port |
| `CORS_ORIGIN` | — | `http://localhost:3000` | Allowed frontend origin for CORS (see below) |

**CORS auto-detection:** The backend automatically handles CORS based on the `CORS_ORIGIN` value:

- **`localhost` or `127.0.0.1`** (or not set) → **dev mode** — allows any localhost or private LAN IP origin, so phones and other devices on the same network work out of the box.
- **A real domain** (e.g. `https://detectiveml.com`) → **production mode** — strictly allows only that exact origin.

No manual toggling is needed when deploying. Just set `CORS_ORIGIN` to your production domain and it locks down automatically.

### 6. Verify Service Account Key

Make sure the service account key file exists at:

```
backend/.auth/serviceAccountKey.json
```

If you saved it somewhere else, update `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env` accordingly.

---

## Running the App

### Development (recommended)

Start both frontend and backend concurrently:

```bash
npm run dev:all
```

This runs:
- **Frontend** → [http://localhost:3000](http://localhost:3000)
- **Backend** → [http://localhost:4000](http://localhost:4000)
- **API Docs** → [http://localhost:4000/api-docs](http://localhost:4000/api-docs) (Swagger UI)

### Testing on a Phone (LAN)

Both servers bind to `0.0.0.0`, so they're accessible from any device on the same Wi-Fi network. Find your computer's local IP (e.g. `192.168.x.x`) and open `http://<your-ip>:3000` on your phone. The frontend and backend automatically handle the LAN origin — no config changes needed.

### Individual Services

```bash
# Frontend only
npm run dev

# Backend only
npm run dev:backend
```

### Health Check

Verify the backend is running:

```bash
curl http://localhost:4000/api/health
# → { "status": "ok", "timestamp": "..." }
```

---

## Environment Files Summary

| File | Purpose | Git-tracked? |
|------|---------|:------------:|
| `.env.example` | Template for root env vars | ✅ |
| `.env.local` | **Your** root env vars (frontend) | ❌ |
| `backend/.env.example` | Template for backend env vars | ✅ |
| `backend/.env` | **Your** backend env vars | ❌ |
| `backend/.auth/serviceAccountKey.json` | Firebase Admin service account key | ❌ |
| `frontend/.env.example` | Legacy template (same vars as root) | ✅ |

---

## Troubleshooting

### "Missing or invalid Authorization header"
The backend requires a Firebase ID token on every API request (except `/api/health`). Make sure:
- You're signed in on the frontend via Google
- The Firebase project config in `.env.local` matches your Firebase project

### "Firebase: Error (auth/configuration-not-found)"
Your `VITE_FIREBASE_*` variables are missing or incorrect. Double-check them against the values in Firebase Console → Project Settings.

### "Could not load default credentials"
The backend can't find your service account key. Ensure:
- `backend/.auth/serviceAccountKey.json` exists
- `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env` points to the correct path

### Cases don't load on mobile / phone
If you see no cases on iOS Safari or a phone browser, make sure:
- You're accessing the frontend via your computer's LAN IP (not `localhost`)
- The backend is running (`npm run dev:all`)
- Both the frontend (:3000) and backend (:4000) ports are accessible on your network

### Backend returns CORS errors
The backend auto-detects dev vs production based on `CORS_ORIGIN`. In dev mode (localhost), all LAN IPs are allowed. If you're in production and seeing CORS errors, verify `CORS_ORIGIN` matches your deployed frontend URL exactly.

### Gemini AI features not working
Ensure `GEMINI_API_KEY` is set in `.env.local` and is a valid key from [Google AI Studio](https://aistudio.google.com/apikey).

---

## Documentation

- [Backend API Reference](./backend/README.md) — full endpoint docs with curl examples
- [API Spec (OpenAPI)](./backend/openapi.yaml) — machine-readable API specification
- [Firebase Migration Notes](./docs/FIREBASE_MIGRATION.md) — architecture decisions and migration history
