import { CaseData } from '../types';
import { database } from './firebase';
import { ref, get, set, child, remove, update } from 'firebase/database';

export const fetchCommunityCases = async (): Promise<CaseData[]> => {
  console.log("[DEBUG] fetchCommunityCases: Fetching...");
  try {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, 'cases'));
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const cases = Object.values(data) as CaseData[];
      console.log(`[DEBUG] fetchCommunityCases: Retrieved ${cases.length} cases`);
      return cases;
    } else {
      console.log("[DEBUG] fetchCommunityCases: No data found");
      return [];
    }
  } catch (error) {
    console.warn("[DEBUG] fetchCommunityCases: Failed:", error);
    return [];
  }
};

export const publishCase = async (caseData: CaseData, authorId?: string): Promise<boolean> => {
  console.log(`[DEBUG] publishCase: Uploading "${caseData.title}" (${caseData.id})`);
  try {
    const caseRef = ref(database, `cases/${caseData.id}`);
    const dataToPublish = { 
      ...caseData, 
      isUploaded: true,
      version: caseData.version || 1,
      authorId: caseData.authorId || authorId
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

export const updateCase = async (caseId: string, updates: Partial<CaseData>): Promise<boolean> => {
  console.log(`[DEBUG] updateCase: Updating ${caseId}`, updates);
  try {
    const caseRef = ref(database, `cases/${caseId}`);
    
    // If we're updating the whole case or significant parts, increment version
    // But if it's just a feature toggle, maybe don't?
    // Let's check if 'suspects' or 'title' or 'description' are in updates
    const isMajorUpdate = updates.suspects || updates.title || updates.description || updates.initialEvidence;
    
    let finalUpdates = { ...updates };
    if (isMajorUpdate) {
      const snapshot = await get(caseRef);
      if (snapshot.exists()) {
        const currentData = snapshot.val() as CaseData;
        finalUpdates.version = (currentData.version || 1) + 1;
      }
    }

    await update(caseRef, finalUpdates);
    return true;
  } catch (error) {
    console.error("[DEBUG] updateCase: Error", error);
    return false;
  }
};
