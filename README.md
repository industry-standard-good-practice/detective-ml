# Detective ML

A detective mystery game powered by AI. Players investigate crime scenes, interrogate suspects, gather evidence, and make accusations — all driven by Google's Gemini AI. Built as a monorepo with a React frontend and an Express backend.

## Project Structure

```
detective-ml/
├── frontend/     ← React + Vite web application (port 3000)
├── backend/      ← Express API server — Firebase proxy (port 4000)
├── docs/         ← Reference documentation
├── .env.local    ← Root env file (frontend vars, loaded by Vite)
└── package.json  ← npm workspaces root
```

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

> **Note:** Vite loads `.env.local` from the project root. The frontend workspace also symlinks to this file. Variables prefixed with `VITE_` are exposed to the browser; `GEMINI_API_KEY` is injected at build time via `vite.config.ts`.

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
| `CORS_ORIGIN` | — | `http://localhost:3000` | Allowed frontend origin for CORS |

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

### Backend returns CORS errors
Make sure `CORS_ORIGIN` in `backend/.env` matches the URL your frontend is running on (default: `http://localhost:3000`).

### Gemini AI features not working
Ensure `GEMINI_API_KEY` is set in `.env.local` and is a valid key from [Google AI Studio](https://aistudio.google.com/apikey).

---

## Documentation

- [Backend API Reference](./backend/README.md) — full endpoint docs with curl examples
- [API Spec (OpenAPI)](./backend/openapi.yaml) — machine-readable API specification
- [Firebase Migration Notes](./docs/FIREBASE_MIGRATION.md) — architecture decisions and migration history
