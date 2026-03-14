import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { getDatabase, ref as dbRef, set, get, child } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const database = getDatabase(app);
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

/**
 * Uploads a base64 image to Firebase Storage and returns the download URL.
 * @param base64 The base64 string of the image (can include data:image/png;base64, prefix)
 * @param path The storage path (e.g., 'cases/case123/suspects/suspect456/neutral.png')
 */
export const uploadImage = async (base64: string, path: string): Promise<string> => {
  if (!base64 || base64.startsWith('http')) return base64; // Already a URL or empty
  
  try {
    const storageRef = ref(storage, path);
    // Remove data:image/png;base64, prefix if present
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    
    const sizeInBytes = Math.floor((data.length * 3) / 4);
    console.log(`[DEBUG] Firebase: Attempting upload to ${path} (${(sizeInBytes / 1024).toFixed(2)} KB)`);

    await uploadString(storageRef, data, 'base64', {
      contentType: 'image/png'
    });
    const url = await getDownloadURL(storageRef);
    console.log(`[DEBUG] Firebase: Uploaded image to ${path} -> ${url}`);
    return url;
  } catch (error) {
    console.error(`[DEBUG] Firebase: Upload failed for ${path}`, error);
    // If it's a large base64, warn that it might cause issues in the database
    if (base64.length > 500000) {
      console.warn(`[DEBUG] Firebase: Falling back to large base64 string (${(base64.length / 1024).toFixed(2)} KB). This may exceed database limits.`);
    }
    return base64; // Fallback to base64 if upload fails
  }
};
