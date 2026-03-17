import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const getBucket = () => admin.storage().bucket();

/**
 * POST /api/images/upload
 * Uploads a base64-encoded image to Firebase Storage.
 * 
 * Body: { base64: string, path: string }
 *   - base64: The image data (may include data:image/png;base64, prefix)
 *   - path: Storage path (e.g., 'images/uid123/cases/case456/hero.png')
 * 
 * Returns: { url: string } — the public download URL
 */
router.post('/upload', async (req: Request, res: Response) => {
  const { base64, path } = req.body;

  if (!base64 || !path) {
    res.status(400).json({ error: 'Missing required fields: base64, path' });
    return;
  }

  // If the base64 is already a URL, just return it
  if (base64.startsWith('http')) {
    res.json({ url: base64 });
    return;
  }

  try {
    // Remove data:image/...;base64, prefix if present
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(data, 'base64');

    const sizeKB = (buffer.length / 1024).toFixed(2);
    console.log(`[Images] Uploading to ${path} (${sizeKB} KB)`);

    const file = getBucket().file(path);
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make the file publicly readable and get the download URL
    await file.makePublic();
    const url = `https://storage.googleapis.com/${getBucket().name}/${path}`;

    console.log(`[Images] Uploaded to ${path} -> ${url}`);
    res.json({ url });
  } catch (error: any) {
    console.error(`[Images] Upload failed for ${path}:`, error);

    // If the base64 is very large, warn
    if (base64.length > 500000) {
      console.warn(`[Images] Large payload (${(base64.length / 1024).toFixed(2)} KB) may have caused issues.`);
    }

    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

export default router;
