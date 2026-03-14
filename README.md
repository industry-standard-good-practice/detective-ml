# 🔍 DetectiveML

**DetectiveML** is an AI-powered murder mystery game where you play as a detective solving procedurally generated cases. Interrogate suspects, gather evidence, uncover contradictions, and make your accusation.

## How It Works

### 🎮 Gameplay

1. **Select a Case** — Browse featured cases or community-created mysteries from the Network. You can also create your own.
2. **Review the Evidence Board** — Read the mission briefing, examine initial evidence, and study the crime scene.
3. **Interrogate Suspects** — Question persons of interest using natural language. Each suspect has a unique personality, backstory, secrets, and an AI-driven conversational engine.
4. **Discover Hidden Evidence** — Push suspects with the right questions to unlock hidden clues. Present evidence to challenge alibis and expose lies.
5. **Monitor Aggravation** — Be careful how hard you push. If a suspect's aggravation meter hits 100%, they'll call their lawyer and shut down.
6. **Use Your Partner** — Your junior detective partner can run interference. Use "Good Cop" to calm suspects or "Bad Cop" to force evidence (at a cost).
7. **Build a Timeline** — Track everyone's movements and spot contradictions between alibis.
8. **Make Your Accusation** — When you're ready, accuse a suspect and present your evidence.

### 🛠️ Case Creation

DetectiveML includes a full case editor where you can:
- Design crime scenarios with custom suspects, evidence, and timelines
- Generate pixel art portraits and crime scene images via AI
- Set difficulty levels, hidden evidence chains, and partner characters
- Publish to the Network for other players

## Tech Stack

- **Frontend**: React, TypeScript, Styled Components, Framer Motion
- **AI**: Google Gemini (interrogation, TTS, case generation, image generation)
- **Backend**: Express + Vite dev server
- **Database**: Firebase (Realtime Database, Auth, Storage)
- **Art Style**: Retro CRT terminal aesthetic with pixel art

## Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- A [Firebase project](https://console.firebase.google.com/) (for auth, database, and storage)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/detective-ml.git
   cd detective-ml
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env.local` file in the root directory with the following:

   ```env
   GEMINI_API_KEY=your_gemini_api_key

   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the dev server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`.

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Type-check with TypeScript |

## Project Structure

```
detective-ml/
├── components/       # Reusable UI components (SuspectCard, OnboardingTour, etc.)
├── contexts/         # React contexts (Onboarding, Game State)
├── hooks/            # Custom hooks (useDragScroll, etc.)
├── screens/          # Main screens (CaseHub, Interrogation, CaseSelection, etc.)
├── services/         # API clients (Gemini, Firebase, TTS, persistence)
├── types.ts          # TypeScript type definitions
├── server.ts         # Express + Vite dev server
└── index.tsx         # App entry point
```

## License

This project is not currently licensed for redistribution. All rights reserved.
