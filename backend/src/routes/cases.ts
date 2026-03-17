import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const getDb = () => admin.database();

// Recursively strip undefined values (RTDB rejects them)
const stripUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
};

const PLACEHOLDER_NAMES = ['unknown author', 'anonymous', ''];

/**
 * GET /api/cases
 * Returns published community cases OR user-specific cases.
 * Query params:
 *   ?authorId=<uid>  → returns ALL cases for that user (published + unpublished)
 *   (no params)      → returns only published cases with valid authors
 */
router.get('/', async (req: Request, res: Response) => {
  const { authorId } = req.query;

  try {
    const snapshot = await getDb().ref('cases').get();
    if (!snapshot.exists()) {
      res.json([]);
      return;
    }

    const data = snapshot.val();
    const allCases = Object.values(data) as any[];

    if (authorId) {
      // Fetch all cases for a specific user
      const userCases = allCases.filter((c: any) => c.authorId === authorId);
      res.json(userCases);
    } else {
      // Fetch published community cases only
      const publishedCases = allCases.filter((c: any) =>
        c.isUploaded === true &&
        c.authorId &&
        c.authorDisplayName &&
        !PLACEHOLDER_NAMES.includes(c.authorDisplayName.trim().toLowerCase())
      );
      res.json(publishedCases);
    }
  } catch (error: any) {
    console.error('[Cases] GET /api/cases error:', error);
    res.status(500).json({ error: 'Failed to fetch cases.' });
  }
});

/**
 * PUT /api/cases/:id
 * Creates or updates a case. 
 * Preserves author identity from existing data, protects publish state.
 * Body: full or partial CaseData object
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  if (!updates.authorId) {
    res.status(400).json({ error: 'authorId is required in the request body.' });
    return;
  }

  try {
    const caseRef = getDb().ref(`cases/${id}`);
    const snapshot = await caseRef.get();

    // Strip isUploaded from incoming data — only publishCase controls publish state
    const { isUploaded: _stripped, ...safeUpdates } = updates;
    let finalUpdates: any = { ...safeUpdates };

    const isMajorUpdate = updates.suspects || updates.title || updates.description || updates.initialEvidence;

    if (snapshot.exists()) {
      const currentData = snapshot.val();

      // Preserve original author identity from database
      if (currentData.authorId) finalUpdates.authorId = currentData.authorId;
      if (currentData.authorDisplayName) finalUpdates.authorDisplayName = currentData.authorDisplayName;

      // Preserve existing publish state
      finalUpdates.isUploaded = currentData.isUploaded || false;

      // Guard: if published without valid authorDisplayName, force unpublish
      if (finalUpdates.isUploaded === true && !finalUpdates.authorDisplayName) {
        finalUpdates.isUploaded = false;
      }

      // Increment version on major updates
      if (isMajorUpdate) {
        finalUpdates.version = (currentData.version || 1) + 1;
      }

      await caseRef.update(stripUndefined({ ...finalUpdates, updatedAt: Date.now() }));
    } else {
      // New case — never published
      finalUpdates.version = finalUpdates.version || 1;
      finalUpdates.createdAt = finalUpdates.createdAt || Date.now();
      finalUpdates.isUploaded = false;
      finalUpdates.updatedAt = Date.now();

      // Require authorDisplayName for new cases
      if (!finalUpdates.authorDisplayName) {
        res.status(400).json({ error: 'authorDisplayName is required for new cases.' });
        return;
      }

      await caseRef.set(stripUndefined(finalUpdates));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error(`[Cases] PUT /api/cases/${id} error:`, error);
    res.status(500).json({ error: 'Failed to update case.' });
  }
});

/**
 * DELETE /api/cases/:id
 * Removes a case from the database.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await getDb().ref(`cases/${id}`).remove();
    res.json({ success: true });
  } catch (error: any) {
    console.error(`[Cases] DELETE /api/cases/${id} error:`, error);
    res.status(500).json({ error: 'Failed to delete case.' });
  }
});

/**
 * POST /api/cases/:id/publish
 * Publishes a case (sets isUploaded: true) with author validation.
 * Body: full CaseData object
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  const { id } = req.params;
  const caseData = req.body;

  // Determine final authorId
  const finalAuthorId = caseData.authorId;
  if (!finalAuthorId) {
    res.status(400).json({ error: 'Cannot publish: no authorId provided.' });
    return;
  }

  const finalDisplayName = caseData.authorDisplayName;
  if (!finalDisplayName || PLACEHOLDER_NAMES.includes(finalDisplayName.trim().toLowerCase())) {
    res.status(400).json({ error: 'Cannot publish: valid authorDisplayName is required.' });
    return;
  }

  try {
    const caseRef = getDb().ref(`cases/${id}`);
    const dataToPublish = {
      ...caseData,
      isUploaded: true,
      version: caseData.version || 1,
      authorId: finalAuthorId,
      authorDisplayName: finalDisplayName,
      createdAt: caseData.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await caseRef.set(stripUndefined(dataToPublish));
    res.json({ success: true });
  } catch (error: any) {
    console.error(`[Cases] POST /api/cases/${id}/publish error:`, error);
    res.status(500).json({ error: 'Failed to publish case.' });
  }
});

export default router;
