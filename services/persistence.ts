import { CaseData, CaseStats } from '../types';
import { database } from './firebase';
import { ref, get, set, child, remove, update, runTransaction } from 'firebase/database';

export const fetchCommunityCases = async (): Promise<CaseData[]> => {
  console.log("[DEBUG] fetchCommunityCases: Fetching published cases only...");
  try {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, 'cases'));
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const allCases = Object.values(data) as CaseData[];
      // CRITICAL: Only return cases that have been explicitly published.
      // Unpublished cases saved to Firebase are private to the author.
      const publishedCases = allCases.filter(c => c.isUploaded === true);
      console.log(`[DEBUG] fetchCommunityCases: Retrieved ${allCases.length} total, ${publishedCases.length} published`);
      return publishedCases;
    } else {
      console.log("[DEBUG] fetchCommunityCases: No data found");
      return [];
    }
  } catch (error) {
    console.warn("[DEBUG] fetchCommunityCases: Failed:", error);
    return [];
  }
};

/**
 * Fetches all cases owned by a specific user (both published and unpublished).
 * This is the ONLY way unpublished Firebase-saved cases are loaded.
 */
export const fetchUserCases = async (userId: string): Promise<CaseData[]> => {
  console.log(`[DEBUG] fetchUserCases: Fetching cases for user ${userId}...`);
  if (!userId) {
    console.error('[CRITICAL] fetchUserCases called without userId');
    return [];
  }
  try {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, 'cases'));
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const allCases = Object.values(data) as CaseData[];
      const userCases = allCases.filter(c => c.authorId === userId);
      console.log(`[DEBUG] fetchUserCases: Found ${userCases.length} cases for user ${userId}`);
      return userCases;
    }
    return [];
  } catch (error) {
    console.warn("[DEBUG] fetchUserCases: Failed:", error);
    return [];
  }
};

export const publishCase = async (caseData: CaseData, authorId?: string, authorDisplayName?: string): Promise<boolean> => {
  // CRITICAL: Determine the final authorId — NEVER publish without one
  const finalAuthorId = caseData.authorId || authorId;
  if (!finalAuthorId) {
    console.error('[CRITICAL] publishCase: REFUSED — no authorId available. Case would be orphaned.');
    alert('Cannot publish: No creator ID found. Please log in and try again.');
    return false;
  }

  const finalDisplayName = caseData.authorDisplayName || authorDisplayName;
  if (!finalDisplayName) {
    console.warn('[WARN] publishCase: No display name available, but authorId is set. Proceeding.');
  }

  console.log(`[DEBUG] publishCase: Publishing "${caseData.title}" (${caseData.id}) by ${finalAuthorId}`);
  try {
    const caseRef = ref(database, `cases/${caseData.id}`);
    const dataToPublish = { 
      ...caseData, 
      isUploaded: true,
      version: caseData.version || 1,
      authorId: finalAuthorId,
      authorDisplayName: finalDisplayName || 'Unknown Author',
      createdAt: caseData.createdAt || Date.now()
    };
    await set(caseRef, dataToPublish);
    console.log("[DEBUG] publishCase: Success");
    return true;
  } catch (error) {
    console.error("[DEBUG] publishCase: Error", error);
    alert("Failed to upload case. Please check your network connection or API configuration.");
    return false;
  }
};

export const deleteCase = async (caseId: string): Promise<boolean> => {
  console.log(`[DEBUG] deleteCase: Deleting ${caseId}`);
  try {
    const caseRef = ref(database, `cases/${caseId}`);
    await remove(caseRef);
    return true;
  } catch (error) {
    console.error("[DEBUG] deleteCase: Error", error);
    return false;
  }
};

// Recursively strip undefined values (Firestore/RTDB rejects them)
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

export const updateCase = async (caseId: string, updates: Partial<CaseData>): Promise<boolean> => {
  // CRITICAL: Never save a case without an authorId.
  // The authorId links the case to its creator. Without it, the case is orphaned.
  if (!updates.authorId) {
    console.error(`[CRITICAL] updateCase: REFUSED save for case ${caseId} — no authorId in updates. This would orphan the case.`);
    return false;
  }

  console.log(`[DEBUG] updateCase: Updating ${caseId} (author: ${updates.authorId})`);
  try {
    const caseRef = ref(database, `cases/${caseId}`);
    
    const isMajorUpdate = updates.suspects || updates.title || updates.description || updates.initialEvidence;
    
    let finalUpdates = { ...updates };

    const snapshot = await get(caseRef);
    if (snapshot.exists()) {
      const currentData = snapshot.val() as CaseData;
      
      // CRITICAL: Preserve isUploaded from the existing record.
      // Only publishCase should set isUploaded to true.
      if (finalUpdates.isUploaded === undefined) {
        finalUpdates.isUploaded = currentData.isUploaded || false;
      }
      
      // Existing case — increment version on major updates
      if (isMajorUpdate) {
        finalUpdates.version = (currentData.version || 1) + 1;
      }
      // Strip undefined and update
      await update(caseRef, stripUndefined(finalUpdates));
    } else {
      // New case — use set() to create it
      // CRITICAL: New cases are NEVER published by default
      finalUpdates.version = finalUpdates.version || 1;
      finalUpdates.createdAt = finalUpdates.createdAt || Date.now();
      if (finalUpdates.isUploaded === undefined) {
        finalUpdates.isUploaded = false;
      }
      await set(caseRef, stripUndefined(finalUpdates));
    }

    return true;
  } catch (error) {
    console.error("[DEBUG] updateCase: Error", error);
    return false;
  }
};

// --- CASE STATS ---

const EMPTY_STATS: CaseStats = {
  plays: 0, successes: 0, failures: 0,
  upvotes: 0, downvotes: 0,
  totalEvidenceFound: 0, totalSuspectsSpoken: 0, totalTimelineFound: 0
};

export interface AttemptDetail {
  evidenceFound: number;
  suspectsSpoken: number;
  timelineFound: number;
}

export const recordGameResult = async (
  caseId: string,
  result: 'SUCCESS' | 'PARTIAL' | 'FAILURE',
  detail: AttemptDetail
): Promise<void> => {
  console.log(`[DEBUG] recordGameResult: ${caseId} -> ${result}`, detail);
  try {
    const statsRef = ref(database, `caseStats/${caseId}`);
    await runTransaction(statsRef, (current) => {
      const stats = current || { ...EMPTY_STATS };
      stats.plays = (stats.plays || 0) + 1;
      if (result === 'SUCCESS') stats.successes = (stats.successes || 0) + 1;
      else stats.failures = (stats.failures || 0) + 1;
      stats.totalEvidenceFound = (stats.totalEvidenceFound || 0) + detail.evidenceFound;
      stats.totalSuspectsSpoken = (stats.totalSuspectsSpoken || 0) + detail.suspectsSpoken;
      stats.totalTimelineFound = (stats.totalTimelineFound || 0) + detail.timelineFound;
      return stats;
    });
  } catch (error) {
    console.error("[DEBUG] recordGameResult: Error", error);
  }
};

export const fetchCaseStats = async (caseId: string): Promise<CaseStats> => {
  try {
    const snapshot = await get(ref(database, `caseStats/${caseId}`));
    if (snapshot.exists()) return snapshot.val() as CaseStats;
    return { ...EMPTY_STATS };
  } catch (error) {
    console.error("[DEBUG] fetchCaseStats: Error", error);
    return { ...EMPTY_STATS };
  }
};

export const fetchAllCaseStats = async (): Promise<Record<string, CaseStats>> => {
  try {
    const snapshot = await get(ref(database, 'caseStats'));
    if (snapshot.exists()) return snapshot.val() as Record<string, CaseStats>;
    return {};
  } catch (error) {
    console.error("[DEBUG] fetchAllCaseStats: Error", error);
    return {};
  }
};

// --- VOTING ---

export const submitVote = async (caseId: string, userId: string, vote: 'up' | 'down'): Promise<void> => {
  try {
    // Read existing vote first
    const voteRef = ref(database, `caseVotes/${caseId}/${userId}`);
    const existingSnapshot = await get(voteRef);
    const existingVote = existingSnapshot.exists() ? existingSnapshot.val() as string : null;

    // Update the vote record
    await set(voteRef, vote);

    // Update aggregate counts via transaction
    const statsRef = ref(database, `caseStats/${caseId}`);
    await runTransaction(statsRef, (current) => {
      const stats = current || { ...EMPTY_STATS };
      // Undo old vote
      if (existingVote === 'up') stats.upvotes = Math.max(0, (stats.upvotes || 0) - 1);
      if (existingVote === 'down') stats.downvotes = Math.max(0, (stats.downvotes || 0) - 1);
      // Apply new vote
      if (vote === 'up') stats.upvotes = (stats.upvotes || 0) + 1;
      if (vote === 'down') stats.downvotes = (stats.downvotes || 0) + 1;
      return stats;
    });
  } catch (error) {
    console.error("[DEBUG] submitVote: Error", error);
  }
};

export const fetchUserVote = async (caseId: string, userId: string): Promise<'up' | 'down' | null> => {
  try {
    const snapshot = await get(ref(database, `caseVotes/${caseId}/${userId}`));
    if (snapshot.exists()) return snapshot.val() as 'up' | 'down';
    return null;
  } catch (error) {
    console.error("[DEBUG] fetchUserVote: Error", error);
    return null;
  }
};

// --- LOCAL DRAFTS (localStorage) ---

const DRAFTS_KEY = 'detectiveml_drafts';

export const saveLocalDraft = (caseData: CaseData): void => {
  const drafts = fetchLocalDrafts();
  const existing = drafts.findIndex(d => d.id === caseData.id);
  if (existing >= 0) {
    drafts[existing] = caseData;
  } else {
    drafts.unshift(caseData);
  }
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

export const fetchLocalDrafts = (): CaseData[] => {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CaseData[];
  } catch {
    return [];
  }
};

export const deleteLocalDraft = (caseId: string): void => {
  const drafts = fetchLocalDrafts().filter(d => d.id !== caseId);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

