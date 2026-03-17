# DetectiveML Backend API

Express + TypeScript backend that proxies all Firebase operations for the DetectiveML frontend.

## Architecture

```
Client (Browser)                    Backend (Express)                Firebase
┌─────────────┐                     ┌──────────────────┐            ┌──────────┐
│ Firebase Auth│ ── ID Token ──────▶ │ Verify Token     │            │          │
│ (client SDK) │                     │ (Admin SDK)      │            │          │
│              │                     │                  │            │          │
│ fetch("/api")│ ── HTTP Request ──▶ │ Route Handler    │── Admin ─▶ │ RTDB     │
│ + Bearer     │                     │ (business logic) │  Service   │ Storage  │
│              │ ◀── JSON Response ─ │                  │◀ Account ─ │          │
└─────────────┘                     └──────────────────┘            └──────────┘
```

**Key:** The user's ID token is only used for **identity verification**. All Firebase reads/writes use the backend's **service account**.

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Firebase Service Account

Generate a service account key from the [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts → Generate new private key.

Then set one of:

```bash
# Option A: Path to JSON file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"

# Option B: JSON string (for cloud deployments)
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"detectiveml",...}'
```

### 3. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Backend server port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed frontend origin |
| `FIREBASE_DATABASE_URL` | `https://detectiveml-default-rtdb.firebaseio.com` | RTDB URL |
| `FIREBASE_STORAGE_BUCKET` | `detectiveml.firebasestorage.app` | Storage bucket |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to service account JSON |
| `FIREBASE_SERVICE_ACCOUNT` | — | Service account JSON string |

### 4. Run

```bash
npm run dev        # Development (with auto-reload)
npm start          # Production
```

API docs: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

---

## Endpoints

All endpoints (except `/api/health`) require authentication:

```
Authorization: Bearer <firebaseIdToken>
```

Get the token in the frontend via:
```typescript
const token = await auth.currentUser.getIdToken();
```

---

### System

#### `GET /api/health`
Health check (no auth required).

```bash
curl http://localhost:4000/api/health
```

```json
{ "status": "ok", "timestamp": "2026-03-17T15:00:00.000Z" }
```

---

### Cases

#### `GET /api/cases`
List all published community cases.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/cases
```

```json
[
  {
    "id": "case_abc123",
    "title": "The Missing Diamond",
    "type": "Larceny",
    "description": "A priceless diamond vanishes...",
    "difficulty": "Medium",
    "isUploaded": true,
    "authorId": "uid_user123",
    "authorDisplayName": "Detective Jane",
    "version": 3,
    "createdAt": 1710700000000,
    "updatedAt": 1710700500000,
    "suspects": [...],
    "initialEvidence": [...]
  }
]
```

#### `GET /api/cases?authorId=uid_user123`
List all cases (published + unpublished) for a specific user.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/cases?authorId=uid_user123"
```

#### `PUT /api/cases/:id`
Create or update a case.

```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "case_abc123",
    "title": "The Missing Diamond",
    "type": "Larceny",
    "description": "A priceless diamond vanishes...",
    "difficulty": "Medium",
    "authorId": "uid_user123",
    "authorDisplayName": "Detective Jane",
    "suspects": [],
    "initialEvidence": []
  }' \
  http://localhost:4000/api/cases/case_abc123
```

```json
{ "success": true }
```

#### `DELETE /api/cases/:id`
Delete a case.

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/cases/case_abc123
```

```json
{ "success": true }
```

#### `POST /api/cases/:id/publish`
Publish a case (requires valid author info).

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "case_abc123",
    "title": "The Missing Diamond",
    "authorId": "uid_user123",
    "authorDisplayName": "Detective Jane",
    "suspects": [],
    "initialEvidence": []
  }' \
  http://localhost:4000/api/cases/case_abc123/publish
```

```json
{ "success": true }
```

---

### Stats

#### `GET /api/stats`
Get all case stats (map of caseId → stats).

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/stats
```

```json
{
  "case_abc123": {
    "plays": 42,
    "successes": 28,
    "failures": 14,
    "upvotes": 35,
    "downvotes": 3,
    "totalEvidenceFound": 120,
    "totalSuspectsSpoken": 85,
    "totalTimelineFound": 60
  }
}
```

#### `GET /api/cases/:id/stats`
Get stats for a single case.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/cases/case_abc123/stats
```

```json
{
  "plays": 42,
  "successes": 28,
  "failures": 14,
  "upvotes": 35,
  "downvotes": 3,
  "totalEvidenceFound": 120,
  "totalSuspectsSpoken": 85,
  "totalTimelineFound": 60
}
```

#### `POST /api/cases/:id/results`
Record a game result.

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "result": "SUCCESS",
    "detail": {
      "evidenceFound": 4,
      "suspectsSpoken": 3,
      "timelineFound": 2
    }
  }' \
  http://localhost:4000/api/cases/case_abc123/results
```

```json
{ "success": true }
```

---

### Voting

#### `GET /api/cases/:id/vote`
Get current user's vote on a case.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/cases/case_abc123/vote
```

```json
{ "vote": "up" }
```

Or if no vote exists:
```json
{ "vote": null }
```

#### `POST /api/cases/:id/vote`
Submit or change a vote.

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "vote": "up" }' \
  http://localhost:4000/api/cases/case_abc123/vote
```

```json
{ "success": true, "previousVote": null }
```

---

### Images

#### `POST /api/images/upload`
Upload a base64 image to Firebase Storage.

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "base64": "data:image/png;base64,iVBORw0KGgo...",
    "path": "images/uid123/cases/case456/hero.png"
  }' \
  http://localhost:4000/api/images/upload
```

```json
{ "url": "https://storage.googleapis.com/detectiveml.firebasestorage.app/images/uid123/cases/case456/hero.png" }
```

---

## Error Responses

All errors follow the same format:

| Status | Meaning |
|--------|---------|
| `400` | Bad request (missing fields, invalid data) |
| `401` | Unauthorized (missing, expired, or invalid token) |
| `500` | Server error (Firebase operation failed) |

```json
{ "error": "Description of what went wrong." }
```
