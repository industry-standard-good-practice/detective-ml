import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthenticatedUser {
  uid: string;
  email: string | undefined;
  displayName: string | undefined;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Auth middleware: validates Firebase ID tokens from the client.
 * 
 * Flow:
 * 1. Client logs in via Firebase Auth (Google sign-in) in the browser
 * 2. Client gets an ID token via `auth.currentUser.getIdToken()`
 * 3. Client sends `Authorization: Bearer <idToken>` with every API request
 * 4. This middleware verifies that token was issued by OUR Firebase project
 * 5. Extracts uid/email/displayName and attaches to `req.user`
 * 
 * All Firebase data operations (RTDB, Storage) are then performed by the
 * backend using the Admin SDK service account — NOT the user's token.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Expected: Bearer <firebaseIdToken>' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || decodedToken.email || 'Unknown'
    };

    next();
  } catch (error: any) {
    console.error('[Auth] Token verification failed:', error.message);
    
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({ error: 'Token expired. Please sign in again.' });
      return;
    }
    if (error.code === 'auth/id-token-revoked') {
      res.status(401).json({ error: 'Token revoked. Please sign in again.' });
      return;
    }
    
    res.status(401).json({ error: 'Invalid authentication token.' });
    return;
  }
}
