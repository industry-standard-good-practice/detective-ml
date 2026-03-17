import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const getDb = () => admin.database();

// Types mirrored from frontend
interface CaseStats {
  plays: number;
  successes: number;
  failures: number;
  upvotes: number;
  downvotes: number;
  totalEvidenceFound: number;
  totalSuspectsSpoken: number;
  totalTimelineFound: number;
}

const EMPTY_STATS: CaseStats = {
  plays: 0, successes: 0, failures: 0,
  upvotes: 0, downvotes: 0,
  totalEvidenceFound: 0, totalSuspectsSpoken: 0, totalTimelineFound: 0
};

/**
 * GET /api/stats
 * Returns all case stats.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getDb().ref('caseStats').get();
    if (snapshot.exists()) {
      res.json(snapshot.val());
    } else {
      res.json({});
    }
  } catch (error: any) {
    console.error('[Stats] fetchAllCaseStats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

/**
 * GET /api/stats/:id
 * Returns stats for a single case.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const snapshot = await getDb().ref(`caseStats/${id}`).get();
    if (snapshot.exists()) {
      res.json(snapshot.val());
    } else {
      res.json({ ...EMPTY_STATS });
    }
  } catch (error: any) {
    console.error(`[Stats] fetchCaseStats error for ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch case stats.' });
  }
});


/**
 * POST /api/stats/:id/results
 * Records a game result (play, success, failure + detail metrics).
 * Body: { result: 'SUCCESS' | 'PARTIAL' | 'FAILURE', detail: { evidenceFound, suspectsSpoken, timelineFound } }
 */
router.post('/:id/results', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { result, detail } = req.body;

  if (!result || !detail) {
    res.status(400).json({ error: 'Missing required fields: result, detail' });
    return;
  }

  if (!['SUCCESS', 'PARTIAL', 'FAILURE'].includes(result)) {
    res.status(400).json({ error: 'result must be SUCCESS, PARTIAL, or FAILURE' });
    return;
  }

  try {
    const statsRef = getDb().ref(`caseStats/${id}`);
    await statsRef.transaction((current: CaseStats | null) => {
      const stats = current || { ...EMPTY_STATS };
      stats.plays = (stats.plays || 0) + 1;
      if (result === 'SUCCESS') stats.successes = (stats.successes || 0) + 1;
      else stats.failures = (stats.failures || 0) + 1;
      stats.totalEvidenceFound = (stats.totalEvidenceFound || 0) + (detail.evidenceFound || 0);
      stats.totalSuspectsSpoken = (stats.totalSuspectsSpoken || 0) + (detail.suspectsSpoken || 0);
      stats.totalTimelineFound = (stats.totalTimelineFound || 0) + (detail.timelineFound || 0);
      return stats;
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error(`[Stats] recordGameResult error for ${id}:`, error);
    res.status(500).json({ error: 'Failed to record game result.' });
  }
});

/**
 * GET /api/stats/:id/vote
 * Gets the current authenticated user's vote on a case.
 * Returns: { vote: 'up' | 'down' | null }
 */
router.get('/:id/vote', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.uid;

  try {
    const snapshot = await getDb().ref(`caseVotes/${id}/${userId}`).get();
    if (snapshot.exists()) {
      res.json({ vote: snapshot.val() });
    } else {
      res.json({ vote: null });
    }
  } catch (error: any) {
    console.error(`[Stats] fetchUserVote error for ${id}/${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch user vote.' });
  }
});

/**
 * POST /api/stats/:id/vote
 * Submits or changes a vote.
 * Body: { vote: 'up' | 'down' }
 */
router.post('/:id/vote', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { vote } = req.body;
  const userId = req.user!.uid;

  if (!vote || !['up', 'down'].includes(vote)) {
    res.status(400).json({ error: 'vote must be "up" or "down"' });
    return;
  }

  try {
    // Read existing vote
    const voteRef = getDb().ref(`caseVotes/${id}/${userId}`);
    const existingSnapshot = await voteRef.get();
    const existingVote = existingSnapshot.exists() ? existingSnapshot.val() as string : null;

    // Update the vote record
    await voteRef.set(vote);

    // Update aggregate counts via transaction
    const statsRef = getDb().ref(`caseStats/${id}`);
    await statsRef.transaction((current: CaseStats | null) => {
      const stats = current || { ...EMPTY_STATS };
      // Undo old vote
      if (existingVote === 'up') stats.upvotes = Math.max(0, (stats.upvotes || 0) - 1);
      if (existingVote === 'down') stats.downvotes = Math.max(0, (stats.downvotes || 0) - 1);
      // Apply new vote
      if (vote === 'up') stats.upvotes = (stats.upvotes || 0) + 1;
      if (vote === 'down') stats.downvotes = (stats.downvotes || 0) + 1;
      return stats;
    });

    res.json({ success: true, previousVote: existingVote });
  } catch (error: any) {
    console.error(`[Stats] submitVote error for ${id}/${userId}:`, error);
    res.status(500).json({ error: 'Failed to submit vote.' });
  }
});

export default router;
