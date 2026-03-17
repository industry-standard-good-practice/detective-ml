import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

import { authMiddleware } from './middleware/auth.js';
import casesRouter from './routes/cases.js';
import statsRouter from './routes/stats.js';
import imagesRouter from './routes/images.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase Admin Initialization ---
// Uses service account credentials to perform all Firebase operations.
// The user's Firebase ID token is ONLY used for identity verification.
function initFirebase() {
  // Option 1: GOOGLE_APPLICATION_CREDENTIALS env var (path to JSON key file)
  // Option 2: FIREBASE_SERVICE_ACCOUNT env var (JSON string, for cloud deployments)
  // Option 3: Default credentials (e.g., on GCP)
  
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://detectiveml-default-rtdb.firebaseio.com';
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'detectiveml.firebasestorage.app';

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
      storageBucket,
    });
    console.log('[Firebase] Initialized with service account JSON.');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      databaseURL,
      storageBucket,
    });
    console.log(`[Firebase] Initialized with GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  } else {
    // Fallback: default credentials
    admin.initializeApp({
      databaseURL,
      storageBucket,
    });
    console.log('[Firebase] Initialized with default credentials.');
  }
}

// --- Express Server ---
function createServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 4000;

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));
  // Increase body size limit for base64 image uploads (up to 50MB)
  app.use(express.json({ limit: '50mb' }));

  // Health check (unauthenticated)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Swagger UI (unauthenticated)
  try {
    const swaggerDoc = YAML.load(path.resolve(__dirname, '../openapi.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
      customSiteTitle: 'DetectiveML API Docs',
    }));
    console.log('[Swagger] API docs available at /api-docs');
  } catch (err) {
    console.warn('[Swagger] Could not load openapi.yaml — skipping Swagger UI.');
  }

  // Auth middleware for all /api routes (except health + docs)
  app.use('/api/cases', authMiddleware, casesRouter);
  app.use('/api/stats', authMiddleware, statsRouter);
  app.use('/api/images', authMiddleware, imagesRouter);

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🔍 DetectiveML Backend running on http://0.0.0.0:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`❤️  Health:   http://localhost:${PORT}/api/health\n`);
  });
}

// --- Entry Point ---
initFirebase();
createServer();
