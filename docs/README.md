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
| `npm run dev` | Start the dev server |
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
├── public/           # PWA assets (manifest, service worker, icons)
└── index.tsx         # App entry point
```

## PWA Mobile Testing

DetectiveML is an installable PWA on both Android and iOS. Both platforms open in **standalone mode** (no browser UI).

### Find Your PC's LAN IP

You'll need this for iOS testing. Run in a terminal:
```bash
# Windows
ipconfig
# Look for "IPv4 Address" under your active adapter (e.g. 192.168.86.244)

# macOS
ipconfig getifaddr en0
```

### Android (Chrome USB Port Forwarding)

Chrome on Android requires a secure context (`localhost` or HTTPS) for standalone PWA install. USB port forwarding maps your PC's `localhost:3000` to `localhost:3000` on your phone.

#### Prerequisites

1. **Install ADB** (one-time — required for Chrome to communicate with your phone):
   ```bash
   # Windows
   winget install Google.PlatformTools

   # macOS
   brew install android-platform-tools
   ```

2. **Enable Developer Mode on your Android phone:**
   - `Settings → About phone` → tap **Build number** 7 times

3. **Enable USB Debugging:**
   - `Settings → Developer options` → toggle on **USB debugging**

#### Testing Workflow

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Connect your phone via USB** (must be a data cable, not charge-only)
   - Accept the **"Allow USB debugging?"** prompt on your phone
   - Verify with `adb devices` — your device should show as `device` (not `unauthorized`)

3. **Set up port forwarding:**
   - On your computer, open Chrome → `chrome://inspect/#devices`
   - Your phone should appear (with a green dot if port forwarding is active)
   - Click **"Port forwarding..."** → add rule: `3000` → `localhost:3000`
   - Check **"Enable port forwarding"** → **Done**

4. **On your phone:**
   - Open Chrome → `localhost:3000`
   - Wait ~30 seconds → tap **Install**
   - The app opens in **standalone mode** (no address bar) ✅

#### Bonus: Remote Debugging

Click **"inspect"** next to your phone's tab in `chrome://inspect` to get full Chrome DevTools — Elements, Console, Network, and more.

### iOS (Safari over LAN)

Safari respects the `apple-mobile-web-app-capable` meta tag over HTTP, so you can install directly over your local network — no USB cable or HTTPS setup needed.

#### Testing Workflow

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **On your iPhone/iPad** (same WiFi network as your computer):
   - Open **Safari** → go to `http://<your-lan-ip>:3000` (e.g. `http://192.168.86.244:3000`)
   - Tap **Share** (square with arrow) → **"Add to Home Screen"** → **Add**
   - The app opens in **standalone mode** (no Safari UI) ✅

#### Voice Input on iOS

iOS Safari doesn't support the Web Speech API in non-secure contexts (HTTP over LAN). Instead, DetectiveML uses **iOS's built-in keyboard dictation** — tap the 🎙 microphone icon on your keyboard to speak your questions. This works reliably without any HTTPS certificates or additional setup.

#### Remote Debugging (macOS only)

1. On your iPhone: `Settings → Safari → Advanced → Web Inspector` → enable
2. Connect iPhone to Mac via USB
3. In Safari on Mac: `Develop → [Your iPhone] → [Your Page]`

### Troubleshooting

| Issue | Solution |
|-------|----------|
| **Android:** `adb devices` shows nothing | Unplug and replug the USB cable. Accept the debugging prompt on your phone. Try a different cable |
| **Android:** Phone shows "Offline" in `chrome://inspect` | Revoke USB debugging authorizations in Developer options, reconnect |
| **Android:** Install banner doesn't appear | Wait 30 seconds (Chrome engagement threshold). Ensure manifest and service worker are valid |
| **Android:** Port forwarding indicator isn't green | Make sure the dev server is running on port 3000 |
| **iOS:** Can't reach `http://<ip>:3000` | Ensure phone and computer are on the same network. Check your firewall allows Node.js (Windows Firewall / macOS firewall in System Settings → Network) |
| **iOS:** App opens in Safari instead of standalone | Delete the shortcut, clear Safari cache (`Settings → Safari → Clear History`), re-add |
| **Both:** App opens with browser UI after install | Uninstall/remove the app, clear site data, re-install |

## License

This project is not currently licensed for redistribution. All rights reserved.
