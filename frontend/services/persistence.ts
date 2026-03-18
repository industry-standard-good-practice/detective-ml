import { CaseData, CaseStats } from '../types';
import { auth } from './firebase';
import toast from 'react-hot-toast';
import { API_BASE } from './apiBase';

/**
 * Makes an authenticated API call to the backend.
 * Automatically attaches the current user's Firebase ID token.
 */
async function apiCall<T = any>(method: string, path: string, body?: any): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `API call failed: ${response.status}`);
  }

  return response.json();
}

// --- CASES ---

export const fetchCommunityCases = async (): Promise<CaseData[]> => {
  console.log("[DEBUG] fetchCommunityCases: Fetching published cases only...");
  try {
    const cases = await apiCall<CaseData[]>('GET', '/api/cases');
    return cases;
  } catch (error) {
    console.warn("[DEBUG] fetchCommunityCases: Failed:", error);
    return [];
  }
};

/**
 * Fetches all cases owned by a specific user (both published and unpublished).
 */
export const fetchUserCases = async (userId: string): Promise<CaseData[]> => {
  console.log(`[DEBUG] fetchUserCases: Fetching cases for user ${userId}...`);
  if (!userId) {
    console.error('[CRITICAL] fetchUserCases called without userId');
    return [];
  }
  try {
    const cases = await apiCall<CaseData[]>('GET', `/api/cases?authorId=${encodeURIComponent(userId)}`);
    console.log(`[DEBUG] fetchUserCases: Found ${cases.length} cases for user ${userId}`);
    return cases;
  } catch (error) {
    console.warn("[DEBUG] fetchUserCases: Failed:", error);
    return [];
  }
};

export const publishCase = async (caseData: CaseData, authorId?: string, authorDisplayName?: string): Promise<boolean> => {
  const finalAuthorId = caseData.authorId || authorId;
  if (!finalAuthorId) {
    console.error('[CRITICAL] publishCase: REFUSED — no authorId available.');
    toast.error('Cannot publish: No creator ID found. Please log in and try again.');
    return false;
  }

  const finalDisplayName = caseData.authorDisplayName || authorDisplayName;
  const PLACEHOLDER_NAMES = ['unknown author', 'anonymous', ''];
  if (!finalDisplayName || PLACEHOLDER_NAMES.includes(finalDisplayName.trim().toLowerCase())) {
    console.error('[CRITICAL] publishCase: REFUSED — no valid authorDisplayName.');
    toast.error('Cannot publish: Author display name is missing. Please log in with a valid account.');
    return false;
  }

  console.log(`[DEBUG] publishCase: Publishing "${caseData.title}" (${caseData.id}) by ${finalAuthorId} (${finalDisplayName})`);
  try {
    await apiCall('POST', `/api/cases/${caseData.id}/publish`, {
      ...caseData,
      authorId: finalAuthorId,
      authorDisplayName: finalDisplayName,
    });
    console.log("[DEBUG] publishCase: Success");
    return true;
  } catch (error) {
    console.error("[DEBUG] publishCase: Error", error);
    toast.error('Failed to upload case. Please check your network connection.');
    return false;
  }
};

export const deleteCase = async (caseId: string): Promise<boolean> => {
  console.log(`[DEBUG] deleteCase: Deleting ${caseId}`);
  try {
    await apiCall('DELETE', `/api/cases/${caseId}`);
    return true;
  } catch (error) {
    console.error("[DEBUG] deleteCase: Error", error);
    return false;
  }
};

export const updateCase = async (caseId: string, updates: Partial<CaseData>): Promise<boolean> => {
  if (!updates.authorId) {
    console.error(`[CRITICAL] updateCase: REFUSED save for case ${caseId} — no authorId in updates.`);
    return false;
  }

  console.log(`[DEBUG] updateCase: Updating ${caseId} (author: ${updates.authorId})`);
  try {
    await apiCall('PUT', `/api/cases/${caseId}`, updates);
    return true;
  } catch (error) {
    console.error("[DEBUG] updateCase: Error", error);
    return false;
  }
};

// --- CASE STATS ---

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
    await apiCall('POST', `/api/stats/${caseId}/results`, { result, detail });
  } catch (error) {
    console.error("[DEBUG] recordGameResult: Error", error);
  }
};

export const fetchCaseStats = async (caseId: string): Promise<CaseStats> => {
  const EMPTY_STATS: CaseStats = {
    plays: 0, successes: 0, failures: 0,
    upvotes: 0, downvotes: 0,
    totalEvidenceFound: 0, totalSuspectsSpoken: 0, totalTimelineFound: 0
  };
  try {
    return await apiCall<CaseStats>('GET', `/api/stats/${caseId}`);
  } catch (error) {
    console.error("[DEBUG] fetchCaseStats: Error", error);
    return { ...EMPTY_STATS };
  }
};

export const fetchAllCaseStats = async (): Promise<Record<string, CaseStats>> => {
  try {
    return await apiCall<Record<string, CaseStats>>('GET', '/api/stats');
  } catch (error) {
    console.error("[DEBUG] fetchAllCaseStats: Error", error);
    return {};
  }
};

// --- VOTING ---

export const submitVote = async (caseId: string, userId: string, vote: 'up' | 'down'): Promise<void> => {
  try {
    await apiCall('POST', `/api/stats/${caseId}/vote`, { vote });
  } catch (error) {
    console.error("[DEBUG] submitVote: Error", error);
  }
};

export const fetchUserVote = async (caseId: string, userId: string): Promise<'up' | 'down' | null> => {
  try {
    const result = await apiCall<{ vote: 'up' | 'down' | null }>('GET', `/api/stats/${caseId}/vote`);
    return result.vote;
  } catch (error) {
    console.error("[DEBUG] fetchUserVote: Error", error);
    return null;
  }
};

// --- LOCAL DRAFTS (localStorage — unchanged) ---

const DRAFTS_KEY = 'detectiveml_drafts';

export const saveLocalDraft = (caseData: CaseData): void => {
  const drafts = fetchLocalDrafts();
  const toSave = { ...caseData, updatedAt: Date.now() };
  const existing = drafts.findIndex(d => d.id === caseData.id);
  if (existing >= 0) {
    drafts[existing] = toSave;
  } else {
    drafts.unshift(toSave);
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
