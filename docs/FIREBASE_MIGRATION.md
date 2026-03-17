# Firebase Migration Plan

> **Goal:** Externalize all direct Firebase SDK calls from the client into a standalone backend, and update the frontend to call that backend via REST/HTTP instead.

---

## Current State

The app makes **direct Firebase SDK calls** from the browser across **3 services**:

| Service | SDK Packages Used | Purpose |
|---------|-------------------|---------|
| **Auth** | `firebase/auth` | Google sign-in, session listener, sign-out |
| **Realtime Database** | `firebase/database` | Case CRUD, stats, voting |
| **Cloud Storage** | `firebase/storage` | Image uploads (portraits, evidence, hero images) |

All Firebase logic lives in **3 service files** and is consumed by **3 UI files**:

```
services/
├── firebase.ts        ← Firebase init, Auth helpers, Storage upload
├── persistence.ts     ← All Realtime Database reads/writes
└── geminiImages.ts    ← Generates images via Gemini AI, uploads to Storage

components/
└── Login.tsx          ← Calls signInWithGoogle()

screens/
└── CaseReview.tsx     ← Calls uploadImage() + updateCase()

App.tsx                ← Auth listener, all persistence calls, logout
```

---

## Files That Need Updating

### Tier 1 — Must Be Rewritten (Service Layer)

These files contain the actual Firebase SDK calls. They would be **replaced** with HTTP client wrappers that call your new backend.

| File | Current Role | Migration Work |
|------|-------------|----------------|
| **`services/firebase.ts`** | Firebase init, `signInWithGoogle()`, `logout()`, `uploadImage()` | Replace `uploadImage()` with a backend endpoint (e.g. `POST /api/images/upload`). Auth may stay client-side (see note below) or move to backend-issued tokens. |
| **`services/persistence.ts`** | 12 functions — all RTDB reads/writes | **Heaviest migration.** Every function becomes an HTTP call to your backend. See the full function inventory below. |

#### `persistence.ts` — Full Function Inventory

| Function | Firebase Op | Suggested Backend Endpoint |
|----------|------------|---------------------------|
| `fetchCommunityCases()` | `get("cases")` → filter published | `GET /api/cases?published=true` |
| `fetchUserCases(userId)` | `get("cases")` → filter by author | `GET /api/cases?authorId={userId}` |
| `publishCase(caseData, authorId, displayName)` | `set("cases/{id}")` | `POST /api/cases/{id}/publish` |
| `updateCase(caseId, updates)` | `get` then `update`/`set` on `"cases/{id}"` | `PUT /api/cases/{id}` |
| `deleteCase(caseId)` | `remove("cases/{id}")` | `DELETE /api/cases/{id}` |
| `recordGameResult(caseId, result, detail)` | `runTransaction("caseStats/{id}")` | `POST /api/cases/{id}/results` |
| `fetchCaseStats(caseId)` | `get("caseStats/{id}")` | `GET /api/cases/{id}/stats` |
| `fetchAllCaseStats()` | `get("caseStats")` | `GET /api/stats` |
| `submitVote(caseId, userId, vote)` | `get` + `set` + `runTransaction` | `POST /api/cases/{id}/vote` |
| `fetchUserVote(caseId, userId)` | `get("caseVotes/{caseId}/{userId}")` | `GET /api/cases/{id}/vote?userId={uid}` |
| `saveLocalDraft(caseData)` | `localStorage` only | No change needed (stays client-side) |
| `fetchLocalDrafts()` | `localStorage` only | No change needed |
| `deleteLocalDraft(caseId)` | `localStorage` only | No change needed |

> [!NOTE]
> The 3 `localStorage` functions (`saveLocalDraft`, `fetchLocalDrafts`, `deleteLocalDraft`) don't touch Firebase and can stay as-is.

#### `firebase.ts` — Function Inventory

| Function/Export | Firebase Op | Migration |
|----------------|------------|-----------|
| `uploadImage(base64, path)` | `uploadString()` + `getDownloadURL()` | `POST /api/images/upload` — backend receives base64, stores in S3/GCS/Firebase, returns URL |
| `signInWithGoogle()` | `signInWithPopup(auth, googleProvider)` | **Decision needed** (see Auth section below) |
| `logout()` | `signOut(auth)` | Depends on auth approach |
| `auth` (instance) | Used by `onAuthStateChanged` in App.tsx | Depends on auth approach |
| `storage` (instance) | Used by `uploadImage` | Removed — backend handles storage |
| `database` (instance) | Used by `persistence.ts` | Removed — backend handles database |

---

### Tier 2 — Must Be Updated (Consumers)

These files import and call the Tier 1 service functions. Their imports and call patterns need updating to use the new HTTP-based service layer.

| File | What Changes | Impact |
|------|-------------|--------|
| **`services/geminiImages.ts`** | 15 calls to `uploadImage()` | Change `import { uploadImage } from "./firebase"` → new backend upload function. Every `await uploadImage(b64, path)` becomes `await backendUpload(b64, path)`. |
| **`App.tsx`** | Imports from `firebase.ts` (`auth`, `logout`) and from `persistence.ts` (10 functions). Auth listener via `onAuthStateChanged`. | Update all persistence imports to new HTTP service. Auth listener pattern may change depending on approach. |
| **`screens/CaseReview.tsx`** | Dynamic import of `uploadImage` (line 754) and `updateCase`/`saveLocalDraft` (line 944) | Update dynamic imports to point at new service modules. |
| **`components/Login.tsx`** | Imports `signInWithGoogle` from `firebase.ts` | Update to new auth approach. |

---

### Tier 3 — No Changes Needed

These files have **zero Firebase interaction** and won't need any updates:

| File | Reason |
|------|--------|
| `services/geminiCase.ts` | Pure AI prompt logic, no Firebase |
| `services/geminiChat.ts` | Chat AI logic, no Firebase |
| `services/geminiClient.ts` | Gemini SDK init only |
| `services/geminiModels.ts` | Model constants |
| `services/geminiStyles.ts` | Style prompt constants |
| `services/geminiTTS.ts` | Text-to-speech, no Firebase |
| `services/gameHelpers.ts` | Avatar URL helpers |
| `screens/CaseSelection.tsx` | Receives data via props |
| `screens/CaseHub.tsx` | Receives data via props |
| `screens/Interrogation.tsx` | Receives data via props |
| `screens/Accusation.tsx` | Receives data via props |
| `screens/EndGame.tsx` | Receives data via props |
| `screens/CreateCase.tsx` | Receives data via props |
| `components/Layout.tsx` | Pure UI |
| `components/CRTOverlay.tsx` | Pure UI |
| `components/BootSequence.tsx` | Pure UI |
| `components/SuspectCard.tsx` | Pure UI |
| `components/SuspectCardDock.tsx` | Pure UI |
| `components/SuspectPortrait.tsx` | Pure UI |
| `components/TimelineModal.tsx` | Pure UI |
| `components/EvidenceEditor.tsx` | Pure UI |
| `components/ExitCaseDialog.tsx` | Pure UI |
| `components/ImageEditorModal.tsx` | Pure UI |
| `components/OnboardingTour.tsx` | Pure UI |
| `components/AsciiCelebration.tsx` | Pure UI |
| `contexts/OnboardingContext.tsx` | React context, no Firebase |
| `hooks/useDragScroll.ts` | DOM hook, no Firebase |
| `types.ts` | Type definitions |
| `constants.ts` | Constants |
| `index.tsx` | App entry point |
| `server.ts` | Existing Vite server |

---

## Auth Strategy Decision

> [!IMPORTANT]
> Authentication requires a design decision before migration.

### Option A: Keep Firebase Auth Client-Side
- `signInWithGoogle()` and `onAuthStateChanged` stay in the browser
- The backend validates Firebase ID tokens on each request (`Authorization: Bearer <idToken>`)
- Simplest migration — minimal frontend auth changes
- **Recommended for first pass**

### Option B: Move Auth Entirely to Backend
- Backend handles OAuth flow, issues session cookies or JWTs
- Frontend calls `POST /api/auth/google` and stores the returned token
- More work, but fully decouples from Firebase client SDK

### Recommendation
Start with **Option A**. It lets you keep `firebase/auth` in the client (it's lightweight) and focus the migration on database + storage. You can always move auth later.

---

## Migration Checklist

```
Phase 1 — Backend
  [ ] Create backend project (Express/Fastify/etc.)
  [ ] Set up Firebase Admin SDK on backend
  [ ] Implement auth middleware (verify Firebase ID token)
  [ ] Implement case CRUD endpoints (6 endpoints)
  [ ] Implement stats/voting endpoints (4 endpoints)
  [ ] Implement image upload endpoint (1 endpoint)

Phase 2 — Frontend Service Layer
  [ ] Create services/api.ts (HTTP client with auth headers)
  [ ] Rewrite persistence.ts to use api.ts (10 functions)
  [ ] Rewrite uploadImage in firebase.ts to use api.ts
  [ ] Remove firebase/database and firebase/storage imports

Phase 3 — Frontend Consumer Updates
  [ ] Update geminiImages.ts (15 uploadImage calls)
  [ ] Update App.tsx (persistence + auth imports)
  [ ] Update CaseReview.tsx (dynamic imports)
  [ ] Update Login.tsx (if moving auth)

Phase 4 — Cleanup
  [ ] Remove unused Firebase SDK packages (database, storage)
  [ ] Update .env to point at backend URL
  [ ] Update security rules / remove auth-rules.bak
  [ ] Test all flows end-to-end
```

---

## Impact Summary

| | Files | Functions | Call Sites |
|-|:-----:|:---------:|:----------:|
| **Must rewrite** | 2 | 15 | — |
| **Must update** | 4 | — | ~30 |
| **No changes** | 28+ | — | — |

**Total files requiring changes: 6 out of 34+ source files.**
