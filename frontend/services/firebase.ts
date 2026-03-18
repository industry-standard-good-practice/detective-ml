import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase (Auth only — DB and Storage now go through backend)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    return null;
  }
};

export const logout = () => signOut(auth);

// --- API HELPER ---

import { API_BASE } from './apiBase';

/**
 * Uploads a base64 image via the backend service.
 * The backend uses its service account to write to Firebase Storage.
 * 
 * Signature is preserved from the original Firebase SDK version so
 * all existing callers (geminiImages.ts, CaseReview.tsx) work unchanged.
 * 
 * @param base64 The base64 string of the image (can include data:image/png;base64, prefix)
 * @param path The storage path (e.g., 'images/uid/cases/case123/hero.png')
 */
export const uploadImage = async (base64: string, path: string): Promise<string> => {
  if (!base64 || base64.startsWith('http')) return base64; // Already a URL or empty

  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('[Firebase] uploadImage: No authenticated user, falling back to base64');
      return base64;
    }

    const token = await user.getIdToken();
    
    const sizeInBytes = Math.floor(((base64.includes(',') ? base64.split(',')[1] : base64).length * 3) / 4);
    console.log(`[DEBUG] Firebase: Uploading to ${path} (${(sizeInBytes / 1024).toFixed(2)} KB) via backend`);

    const response = await fetch(`${API_BASE}/api/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64, path }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[DEBUG] Firebase: Uploaded image to ${path} -> ${result.url}`);
    return result.url;
  } catch (error) {
    console.error(`[DEBUG] Firebase: Upload failed for ${path}`, error);
    // If it's a large base64, warn
    if (base64.length > 500000) {
      console.warn(`[DEBUG] Firebase: Falling back to large base64 string (${(base64.length / 1024).toFixed(2)} KB). This may exceed database limits.`);
    }
    return base64; // Fallback to base64 if upload fails
  }
};
