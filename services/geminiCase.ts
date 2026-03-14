
import { Type, ThinkingLevel } from "@google/genai";
import { CaseData } from "../types";
import { ai } from "./geminiClient";
import { getRandomVoice } from "../constants";
import { generateEvidenceImage } from "./geminiImages";

// --- HELPERS ---

export const calculateDifficulty = (caseData: Partial<CaseData>): "Easy" | "Medium" | "Hard" => {
    const aliveSuspects = caseData.suspects?.filter(s => !s.isDeceased) || [];
    const suspectCount = aliveSuspects.length;
    const initialEvidenceCount = caseData.initialEvidence?.length || 0;
    const hiddenEvidenceCount = caseData.suspects?.reduce((acc, s) => acc + (s.hiddenEvidence?.length || 0), 0) || 0;
    const initialTimelineCount = caseData.initialTimeline?.length || 0;
    const totalEvidence = initialEvidenceCount + hiddenEvidenceCount;
    
    // Difficulty: suspectCount is main weight. Initial timeline makes it easier.
    const points = (suspectCount * 2) + totalEvidence - (initialTimelineCount * 0.5);
    if (points > 28) return "Hard";
    if (points >= 20) return "Medium";
    return "Easy";
};

export const stripImagesFromCase = (caseData: CaseData): { stripped: any, imageMap: Record<string, string> } => {
    const imageMap: Record<string, string> = {};
    const clone = JSON.parse(JSON.stringify(caseData));

    (clone.initialEvidence || []).forEach((ev: any) => {
        if (ev.imageUrl) {
            imageMap[ev.id] = ev.imageUrl;
            ev.imageUrl = "PLACEHOLDER";
        }
    });
    
    // Strip support chars
    if (clone.officer?.portraitUrl) {
        imageMap['officer'] = clone.officer.portraitUrl;
        clone.officer.portraitUrl = "PLACEHOLDER";
    }

    if (clone.heroImageUrl) {
        imageMap['hero'] = clone.heroImageUrl;
        clone.heroImageUrl = "PLACEHOLDER";
    }
    
    // Support Characters: Handle portraits map for both
    if (clone.officer?.portraits) {
        Object.keys(clone.officer.portraits).forEach(key => {
            const pid = `officer-p-${key}`;
            imageMap[pid] = clone.officer.portraits[key];
            clone.officer.portraits[key] = "PLACEHOLDER";
        });
    }

    if (clone.partner?.portraits) {
        Object.keys(clone.partner.portraits).forEach(key => {
            const pid = `partner-p-${key}`;
            imageMap[pid] = clone.partner.portraits[key];
            clone.partner.portraits[key] = "PLACEHOLDER";
        });
    }

    (clone.suspects || []).forEach((s: any) => {
        if (s.portraits) {
            Object.keys(s.portraits).forEach(key => {
                const pid = `${s.id}-p-${key}`;
                imageMap[pid] = s.portraits[key];
                s.portraits[key] = "PLACEHOLDER";
            });
        }
        (s.hiddenEvidence || []).forEach((ev: any) => {
            if (ev.imageUrl) {
                imageMap[ev.id] = ev.imageUrl;
                ev.imageUrl = "PLACEHOLDER";
            }
        });
    });

    return { stripped: clone, imageMap };
};

export const hydrateImagesToCase = (strippedCase: any, imageMap: Record<string, string>): CaseData => {
    (strippedCase.initialEvidence || []).forEach((ev: any) => {
        if (imageMap[ev.id]) ev.imageUrl = imageMap[ev.id];
        else if (ev.imageUrl === "PLACEHOLDER") delete ev.imageUrl;
    });

    if (strippedCase.officer) {
        if (strippedCase.officer.portraits) {
            Object.keys(strippedCase.officer.portraits).forEach(key => {
                const pid = `officer-p-${key}`;
                if (imageMap[pid]) strippedCase.officer.portraits[key] = imageMap[pid];
            });
        }
    }
    
    if (strippedCase.partner) {
        if (strippedCase.partner.portraits) {
            Object.keys(strippedCase.partner.portraits).forEach(key => {
                const pid = `partner-p-${key}`;
                if (imageMap[pid]) strippedCase.partner.portraits[key] = imageMap[pid];
            });
        }
    }

    (strippedCase.suspects || []).forEach((s: any) => {
        if (s.portraits) {
            Object.keys(s.portraits).forEach(key => {
                const pid = `${s.id}-p-${key}`;
                if (imageMap[pid]) s.portraits[key] = imageMap[pid];
            });
        }
        (s.hiddenEvidence || []).forEach((ev: any) => {
            if (imageMap[ev.id]) ev.imageUrl = imageMap[ev.id];
            else if (ev.imageUrl === "PLACEHOLDER") delete ev.imageUrl;
        });
    });

    return strippedCase as CaseData;
};

// Helper to enforce relationships exist after generation/check
export const enforceRelationships = (caseData: any) => {
    if (!caseData.suspects || !Array.isArray(caseData.suspects)) {
        console.warn("[DEBUG] enforceRelationships: No suspects array found, skipping.");
        return caseData;
    }

    const victim = caseData.suspects.find((s: any) => s.isDeceased);
    const victimName = victim?.name.trim();
    const aliveSuspectNames = caseData.suspects.filter((s: any) => !s.isDeceased).map((s: any) => s.name.trim());
    
    caseData.suspects.forEach((s: any) => {
        if (!s.relationships) s.relationships = [];
        const currentName = s.name.trim();
        const isDeceased = s.isDeceased;

        // 1. Canonicalize "The Victim" relationship
        if (!isDeceased && victimName) {
            // If they have a relationship with the victim's name, rename it to "The Victim"
            s.relationships.forEach((r: any) => {
                if (r.targetName.trim() === victimName) {
                    r.targetName = "The Victim";
                }
            });
        }

        // 2. Define targets for this specific suspect
        const targets: string[] = [];
        
        if (!isDeceased) {
            // Alive suspects need "The Victim" + other alive suspects
            targets.push("The Victim");
            aliveSuspectNames.forEach(name => {
                if (name !== currentName) targets.push(name);
            });
        } else {
            // The victim needs all alive suspects
            aliveSuspectNames.forEach(name => targets.push(name));
        }
        
        // 3. Ensure relationships with all targets
        targets.forEach((name: string) => {
            const hasRel = s.relationships.some((r: any) => r.targetName.trim() === name);
            if (!hasRel) {
                s.relationships.push({
                    targetName: name,
                    type: "Acquaintance",
                    description: name === "The Victim" 
                        ? "I didn't know them personally, just another face in the crowd."
                        : "I've seen them around, but we don't talk much. I don't really have an opinion on them one way or the other."
                });
            }
        });
    });
    return caseData;
};

// --- SCHEMAS ---

const CASE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        type: { type: Type.STRING },
        description: { type: Type.STRING },
        officer: { 
            type: Type.OBJECT, 
            properties: { 
                id: { type: Type.STRING },
                name: { type: Type.STRING }, 
                role: { type: Type.STRING }, 
                gender: { type: Type.STRING } 
            } 
        },
        partner: { 
            type: Type.OBJECT, 
            properties: { 
                id: { type: Type.STRING },
                name: { type: Type.STRING }, 
                role: { type: Type.STRING }, 
                gender: { type: Type.STRING } 
            } 
        },
        initialEvidence: { 
            type: Type.ARRAY, 
            items: { 
                type: Type.OBJECT, 
                properties: { 
                    id: { type: Type.STRING }, 
                    title: { type: Type.STRING }, 
                    description: { type: Type.STRING } 
                },
                required: ["id", "title", "description"]
            } 
        },
        initialTimeline: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    time: { type: Type.STRING },
                    activity: { type: Type.STRING }
                },
                required: ["time", "activity"]
            }
        },
        suspects: { 
            type: Type.ARRAY, 
            items: { 
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    gender: { type: Type.STRING },
                    age: { type: Type.NUMBER },
                    role: { type: Type.STRING },
                    bio: { type: Type.STRING },
                    personality: { type: Type.STRING },
                    secret: { type: Type.STRING },
                    physicalDescription: { type: Type.STRING },
                    isGuilty: { type: Type.BOOLEAN },
                    isDeceased: { type: Type.BOOLEAN },
                    baseAggravation: { type: Type.NUMBER },
                    motive: { type: Type.STRING },
                    alibi: { type: Type.OBJECT, properties: {
                        statement: { type: Type.STRING },
                        isTrue: { type: Type.BOOLEAN },
                        location: { type: Type.STRING },
                        witnesses: { type: Type.ARRAY, items: { type: Type.STRING }}
                    }},
                    relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                        targetName: { type: Type.STRING },
                        type: { type: Type.STRING },
                        description: { type: Type.STRING }
                    }}},
                    timeline: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                        time: { type: Type.STRING },
                        activity: { type: Type.STRING }
                    }}},
                    knownFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    professionalBackground: { type: Type.STRING },
                    witnessObservations: { type: Type.STRING },
                    hiddenEvidence: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["id", "title", "description"]
                        }
                    }
                },
                required: [
                    "id", "name", "gender", "age", "role", "bio", "personality", 
                    "secret", "physicalDescription", "isGuilty", "isDeceased", 
                    "baseAggravation", "motive", "alibi", "relationships", 
                    "timeline", "knownFacts", "professionalBackground", 
                    "witnessObservations", "hiddenEvidence"
                ]
            } 
        }
    },
    required: ["id", "title", "type", "description", "officer", "partner", "initialEvidence", "suspects"]
};

const REPORT_SCHEMA = { 
    type: Type.OBJECT,
    properties: {
        issuesFound: { type: Type.STRING, description: "A markdown list of bullet points detailing the logical gaps, timeline errors, or motive inconsistencies found." },
        changesMade: { 
            type: Type.ARRAY, 
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "A clear, concise description of the specific change made." },
                    evidenceId: { type: Type.STRING, description: "The ID of the evidence item if this change specifically added or modified it. Null otherwise." }
                },
                required: ["description"]
            },
            description: "A list of specific changes made to fix the issues." 
        },
        conclusion: { type: Type.STRING, description: "A final paragraph summarizing the case's current state of consistency." }
    },
    required: ["issuesFound", "changesMade", "conclusion"]
};

// --- CORE FUNCTIONS ---

export const checkCaseConsistency = async (caseData: CaseData, onProgress?: (msg: string) => void): Promise<{ updatedCase: CaseData, report: any }> => {
  console.log(`[DEBUG] checkCaseConsistency: Starting for case "${caseData.title}"`);
  
  if (onProgress) onProgress("Stripping visual assets for analysis...");
  const { stripped: lightweightCase, imageMap } = stripImagesFromCase(caseData);

  const guiltySuspects = caseData.suspects.filter(s => s.isGuilty);
  const guiltyNames = guiltySuspects.length > 0 ? guiltySuspects.map(s => s.name).join(', ') : "Unknown";

  if (onProgress) onProgress("Initializing Narrative Audit...");

  // Detailed loading sequence
  const progressSteps = [
      "Auditing suspect alibis...",
      "Verifying timeline continuity...",
      "Checking motive consistency...",
      "Cross-referencing evidence links...",
      "Identifying logical narrative gaps...",
      "Synthesizing forensic findings..."
  ];

  let stepIdx = 0;
  const progressInterval = setInterval(() => {
      if (onProgress && stepIdx < progressSteps.length) {
          onProgress(progressSteps[stepIdx]);
          stepIdx++;
      }
  }, 2500);

  try {
    const result = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are a Master Mystery Editor and Narrative Architect.
    I will provide a JSON object representing a detective mystery game case.
    
    YOUR MISSION:
    Perform a deep narrative audit and structural repair. The case must be perfectly consistent, logically sound, and satisfyingly solvable.
    
    1. **NARRATIVE INTEGRITY & SOLVABILITY (CRITICAL):**
       - **GROUND TRUTH:** The 'isGuilty' flags in the provided JSON are the ABSOLUTE SOURCE OF TRUTH.
       - The suspects currently marked as 'isGuilty: true' (${guiltyNames}) MUST remain the killers. 
       - **DO NOT CHANGE WHO IS GUILTY.** If the user has changed the killers, you must RE-ALIGN the entire narrative (Bio, Role, Motive, Secret, Evidence, Alibis, Relationships, Witness Observations) to support this new reality.
       - Ensure the crime is actually solvable based on the evidence provided.
       - The 'Guilty' suspects MUST have a logical path to being caught (via hidden evidence, alibi cracks, or witness testimony).
       - **IF YOU ADD NEW EVIDENCE, YOU MUST INCLUDE IT IN THE \`updatedCase\` JSON OBJECT.**
       - If the crime type is "Murder", ensure the victim's cause of death aligns with the evidence.
       
    2. **TIMELINE RECONCILIATION:**
       - Audit every suspect's 'timeline'. Times and locations MUST match up across suspects.
       - If Suspect A says they were with Suspect B at 9:00 PM, Suspect B's timeline MUST reflect this.
       - Ensure the victim's time of death is consistent with all witness observations and forensic evidence.
       
    3. **MOTIVE & CHARACTER ALIGNMENT:**
       - Ensure motives are compelling and consistent with the character's bio and secret.
       - If a suspect has a secret, ensure there is a way for the player to discover it.
       
    4. **OUTPUT FORMAT:**
       - You must return a JSON object with two fields:
         - 'updatedCase': The complete, repaired CaseData object.
         - 'report': A structured object containing 'issuesFound', 'changesMade' (array of {description, evidenceId}), and 'conclusion'.
    
    CASE DATA:
    ${JSON.stringify(lightweightCase, null, 2)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    updatedCase: CASE_SCHEMA,
                    report: REPORT_SCHEMA
                },
                required: ["updatedCase", "report"]
            },
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
    });

    clearInterval(progressInterval);
    if (onProgress) onProgress("Finalizing Narrative Repair...");

    const text = result.text;
    if (!text) {
        console.warn("[DEBUG] checkCaseConsistency: No text returned");
        return { updatedCase: caseData, report: "No changes needed." };
    }
    const parsed = JSON.parse(text);
    const aiCase = parsed.updatedCase;
    const reportObj = parsed.report;
    
    console.log("[DEBUG] checkCaseConsistency: Success");
    
    if (!aiCase) {
        console.warn("[DEBUG] checkCaseConsistency: No updatedCase returned");
        return { updatedCase: caseData, report: reportObj || "Consistency check failed to return case data." };
    }

    // --- HYDRATE IMAGES BACK INTO THE AI CASE ---
    const hydratedCase = hydrateImagesToCase(aiCase, imageMap);

    // Ensure we don't lose non-narrative fields
    hydratedCase.suspects.forEach(s => {
        const origSuspect = caseData.suspects.find(os => os.id === s.id);
        if (origSuspect) {
            if (s.avatarSeed === undefined) s.avatarSeed = origSuspect.avatarSeed;
            if (s.voice === undefined) s.voice = origSuspect.voice;
            if (!s.portraits || Object.keys(s.portraits).length === 0) s.portraits = origSuspect.portraits;
        }
    });

    const finalData = enforceRelationships(hydratedCase);

    // Generate images for any NEW evidence added by the AI
    if (onProgress) onProgress("Generating images for new evidence...");
    const userId = caseData.authorId || "anonymous";
    const newEvidenceTasks: Promise<void>[] = [];

    const allEvidence = [
        ...(finalData.initialEvidence || []),
        ...(finalData.suspects || []).flatMap(s => s.hiddenEvidence || [])
    ];

    allEvidence.forEach(ev => {
        if (!ev.imageUrl) {
            newEvidenceTasks.push((async () => {
                try {
                    const url = await generateEvidenceImage(ev, finalData.id, userId);
                    if (url) ev.imageUrl = url;
                } catch (e) {
                    console.error(`Failed to generate image for new evidence ${ev.id}:`, e);
                }
            })());
        }
    });

    if (newEvidenceTasks.length > 0) {
        await Promise.all(newEvidenceTasks);
    }

    return { updatedCase: finalData, report: reportObj };
  } catch (e) {
    clearInterval(progressInterval);
    console.error("Consistency Check Failed:", e);
    return { updatedCase: caseData, report: "Consistency check failed." };
  }
};

/**
 * Allows the user to request broad, AI-driven edits to an entire case.
 * Handles everything from theme changes to suspect management.
 */
export const editCaseWithPrompt = async (caseData: CaseData, userPrompt: string, onProgress?: (msg: string) => void): Promise<{ updatedCase: CaseData, report: any }> => {
    console.log(`[DEBUG] editCaseWithPrompt: Starting with prompt "${userPrompt}"`);
    
    if (onProgress) onProgress("Stripping visual assets for transformation...");
    const { stripped: lightweightCase, imageMap } = stripImagesFromCase(caseData);

    if (onProgress) onProgress("Initializing Case Transformation...");

    // Detailed loading sequence
    const progressSteps = [
        "Re-imagining suspect roles...",
        "Adjusting narrative setting...",
        "Recalibrating motives and secrets...",
        "Updating evidence descriptions...",
        "Re-mapping character relationships...",
        "Finalizing case structure..."
    ];

    let stepIdx = 0;
    const progressInterval = setInterval(() => {
        if (onProgress && stepIdx < progressSteps.length) {
            onProgress(progressSteps[stepIdx]);
            stepIdx++;
        }
    }, 3000);

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: `You are a Master Narrative Architect.
      I will provide a JSON object representing a detective mystery game case and a USER REQUEST for modification.
      
      YOUR MISSION:
      Transform the case according to the user's request. This can range from minor tweaks to a complete overhaul of the setting, characters, and plot.
      
      USER REQUEST: "${userPrompt}"
      
      GUIDELINES:
      1. **COMPREHENSIVE TRANSFORMATION:**
         - If the user wants to change the setting (e.g., from 1920s to Sci-Fi), you must update EVERYTHING: titles, descriptions, suspect bios, roles, personality, secrets, alibis, evidence, etc.
         - If the user wants more killers, update 'isGuilty' flags and adjust the narrative to support a conspiracy.
         - If the user wants to change a name, ensure it's updated everywhere (bios, relationships, alibis).
         
      2. **SUSPECT MANAGEMENT:**
         - You MAY add new suspects if the request implies it (e.g., "add a butler").
         - You MAY remove suspects if requested.
         - You MAY change which suspects are guilty.
         
      3. **EVIDENCE MANAGEMENT:**
         - You MUST update initialEvidence and hiddenEvidence to fit the new narrative.
         - Ensure all evidence is logically linked to the crime and the suspects.
         
      4. **CONSISTENCY (CRITICAL):**
         - After making the requested changes, perform a full consistency check.
         - Timelines MUST align.
         - Motives MUST be logical.
         - The case MUST be solvable.
         
      5. **OUTPUT FORMAT:**
         - You must return a JSON object with two fields:
           - 'updatedCase': The complete, transformed CaseData object.
           - 'report': A structured object containing 'issuesFound' (what was changed to fit the prompt), 'changesMade' (array of {description, evidenceId}), and 'conclusion'.
      
      CASE DATA:
      ${JSON.stringify(lightweightCase, null, 2)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        updatedCase: CASE_SCHEMA,
                        report: REPORT_SCHEMA
                    },
                    required: ["updatedCase", "report"]
                },
                thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
            }
        });

        clearInterval(progressInterval);
        if (onProgress) onProgress("Finalizing Case Transformation...");

        const text = result.text;
        if (!text) throw new Error("No response from AI");

        const parsed = JSON.parse(text);
        const aiCase = parsed.updatedCase;
        const reportObj = parsed.report;

        // --- HYDRATE IMAGES ---
        const hydratedCase = hydrateImagesToCase(aiCase, imageMap);

        const themeChanged = hydratedCase.type !== caseData.type;
        if (themeChanged) {
            console.log(`[DEBUG] Theme changed from ${caseData.type} to ${hydratedCase.type}. Forcing full image regeneration.`);
            // Clear hero image if it was derived from evidence/victim
            delete hydratedCase.heroImageUrl;
        }

        // 1. Check Support Characters for changes
        ['officer', 'partner'].forEach(key => {
            const char = (hydratedCase as any)[key];
            const origChar = (caseData as any)[key];
            if (char && origChar) {
                const roleChanged = char.role !== origChar.role;
                const personalityChanged = char.personality !== origChar.personality;
                const nameChanged = char.name !== origChar.name;
                if (themeChanged || roleChanged || personalityChanged || nameChanged) {
                    char.portraits = {};
                    char.avatarSeed = Math.floor(Math.random() * 1000000);
                } else {
                    char.portraits = origChar.portraits;
                    char.avatarSeed = origChar.avatarSeed;
                }
                if (!char.voice) char.voice = origChar.voice || (char.gender === 'Female' ? 'Kore' : 'Zephyr');
            }
        });

        // 2. Check Suspects for changes
        hydratedCase.suspects.forEach(s => {
            const origSuspect = caseData.suspects.find(os => os.id === s.id);
            if (origSuspect) {
                const roleChanged = s.role !== origSuspect.role;
                const descChanged = s.physicalDescription !== origSuspect.physicalDescription;
                const nameChanged = s.name !== origSuspect.name;
                
                if (themeChanged || roleChanged || descChanged || nameChanged) {
                    s.portraits = {};
                    s.avatarSeed = Math.floor(Math.random() * 1000000);
                } else {
                    s.portraits = origSuspect.portraits;
                    s.avatarSeed = origSuspect.avatarSeed;
                }
                if (s.voice === undefined) s.voice = origSuspect.voice;
            } else {
                // NEW SUSPECT: Needs default values
                s.id = s.id || `s-new-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                s.avatarSeed = Math.floor(Math.random() * 1000000);
                s.voice = s.gender === 'Female' ? 'Kore' : 'Zephyr';
                s.portraits = {};
                s.hiddenEvidence = s.hiddenEvidence || [];
                s.hiddenEvidence.forEach((ev: any, i: number) => {
                    ev.id = ev.id || `he-${s.id}-${i}`;
                });
            }
        });

        // 3. Check Evidence for changes
        const checkEvidence = (evList: any[], origList: any[]) => {
            evList.forEach(ev => {
                const orig = origList.find(o => o.id === ev.id);
                if (orig) {
                    const titleChanged = ev.title !== orig.title;
                    const descChanged = ev.description !== orig.description;
                    if (themeChanged || titleChanged || descChanged) {
                        delete ev.imageUrl;
                    }
                } else {
                    // New evidence item
                    delete ev.imageUrl;
                }
            });
        };
        checkEvidence(hydratedCase.initialEvidence || [], caseData.initialEvidence || []);
        hydratedCase.suspects.forEach(s => {
            const orig = caseData.suspects.find(os => os.id === s.id);
            if (orig) {
                checkEvidence(s.hiddenEvidence || [], orig.hiddenEvidence || []);
            }
        });

        const finalData = enforceRelationships(hydratedCase);

        // Generate images for NEW or CHANGED content
        if (onProgress) onProgress("Generating visual assets for updated content...");
        const userId = caseData.authorId || "anonymous";
        const generationTasks: Promise<void>[] = [];

        // 1. Support Character Portraits
        ['officer', 'partner'].forEach(key => {
            const char = (finalData as any)[key];
            if (char && (!char.portraits || Object.keys(char.portraits).length === 0)) {
                generationTasks.push((async () => {
                    try {
                        const { regenerateSingleSuspect } = await import('./geminiImages');
                        const updatedChar = await regenerateSingleSuspect(char, finalData.id, userId, finalData.type);
                        if (updatedChar.portraits) char.portraits = updatedChar.portraits;
                    } catch (e) {
                        console.error(`Failed to generate portraits for ${key}:`, e);
                    }
                })());
            }
        });

        // 2. Suspect Portraits
        finalData.suspects.forEach(s => {
            if (!s.portraits || Object.keys(s.portraits).length === 0) {
                generationTasks.push((async () => {
                    try {
                        const { regenerateSingleSuspect } = await import('./geminiImages');
                        const updatedSuspect = await regenerateSingleSuspect(s, finalData.id, userId, finalData.type);
                        if (updatedSuspect.portraits) s.portraits = updatedSuspect.portraits;
                    } catch (e) {
                        console.error(`Failed to generate portraits for suspect ${s.name}:`, e);
                    }
                })());
            }
        });

        // 3. Evidence Images
        const allEvidence = [
            ...(finalData.initialEvidence || []),
            ...(finalData.suspects || []).flatMap(s => s.hiddenEvidence || [])
        ];

        allEvidence.forEach(ev => {
            if (!ev.imageUrl) {
                generationTasks.push((async () => {
                    try {
                        const url = await generateEvidenceImage(ev, finalData.id, userId);
                        if (url) ev.imageUrl = url;
                    } catch (e) {
                        console.error(`Failed to generate image for evidence ${ev.id}:`, e);
                    }
                })());
            }
        });

        if (generationTasks.length > 0) {
            await Promise.all(generationTasks);
        }

        return { updatedCase: finalData, report: reportObj };
    } catch (e) {
        clearInterval(progressInterval);
        console.error("Edit Case Failed:", e);
        throw e;
    }
};

export const generateCaseFromPrompt = async (userPrompt: string, isLucky: boolean = false): Promise<CaseData> => {
  let finalPrompt = userPrompt;

  // If user hit "I'm Feeling Lucky" without a prompt, ask AI to generate a random theme
  if (!finalPrompt && isLucky) {
      finalPrompt = "Generate a completely unique, creative, and random mystery theme. It could be any genre (Sci-Fi, Fantasy, Historical, Cyberpunk, Western, Horror, Comedy, etc). Do not use a generic noir theme unless random chance dictates it.";
  }

  // Fallback if still empty
  finalPrompt = finalPrompt || "A classic noir murder mystery";

  const seed = Math.floor(Math.random() * 1000000); 
  console.log(`[DEBUG] generateCaseFromPrompt: "${finalPrompt}" (Lucky: ${isLucky}, Seed: ${seed})`);
  
  const systemPrompt = `
    Create a detective case JSON.
    Theme: ${finalPrompt}.
    Difficulty: Calculated automatically based on complexity.
    Generation Seed: ${seed} (Use this to randomize names and scenarios).
    
    CRITICAL INSTRUCTION - INITIAL TIMELINE:
    You must generate an 'initialTimeline' array of events that are known at the start of the case.
    - For a Murder: Include when the murder occurred (e.g. "Body discovered at 10:00 PM", "Estimated time of death 9:00 PM").
    - For a Break-in: Include camera footage or witness reports of the entry (e.g. "Security cameras show figure at back door at 2:00 AM").
    - These events should be general facts, not attributed to a specific suspect yet.
    
    CRITICAL INSTRUCTION - SUPPORT CHARACTERS:
    You must generate two support characters that fit the THEME:
    1. 'officer': The quest giver / boss. (e.g. For Fantasy: "Captain of the Guard"; For Sci-Fi: "Station Commander").
    2. 'partner': The player's sidekick. (e.g. For Fantasy: "Novice Mage"; For Sci-Fi: "Droid Unit").
    
    CRITICAL INSTRUCTION - NAMES:
    - **STRICT CONSTRAINT:** Do NOT use "cool", "edgy", or "YA Novel" names unless explicitly requested by the user prompt.
    - **BANNED NAMES:** Jarek, Zara, Vane, Kael, Rian, Elias, Silas, Elara, Lyra, Orion, Nova, Zephyr, Thorne, Nyx, Jax, Kai, Luna, Raven, Shadow, Talon, Blaze.
    - **PREFERRED STYLE:** Use grounded, realistic, mundane names suitable for a gritty police report. (e.g. Frank, Martha, David, Sarah, Robert, Chen, Rodriguez, Kowalski, Smith, Jones, Patel, Nguyen).
    - If the setting is historical or specific (e.g. 1920s), use period-accurate names.
    
    CRITICAL INSTRUCTION - CRIME TYPE:
    - 'type' MUST be specific legal classification.
    
    CRITICAL INSTRUCTION: Include the EXACT number of suspects requested in the Theme/Prompt.
    If the user does not specify a number, default to 5 suspects.
    One or more suspects must be Guilty.
    
    **VICTIM GENERATION RULE:**
    If the crime involves a death or a body (e.g. Murder, Homicide), YOU MUST GENERATE "THE VICTIM" AS A SUSPECT CARD.
    - Name: A realistic full name for the victim.
    - Role: "The Victim".
    - **isDeceased: true**.
    - hiddenEvidence: Must contain 2-3 physical clues found on the body (e.g. "Bruise on wrist", "Watch frozen at 9pm", "Pocket lint").
    - Alibi/Motive: Set to "N/A (Deceased)".
    - Bio: Description of the body's state and their life before death.
    
    Each suspect needs 'hiddenEvidence' (items they have that prove guilt or secrets).
    Ensure the guilty party has damning hidden evidence.
    
    Create detailed profiles:
    - GENDER: Explicitly state Male, Female, or Non-binary.
    - BIO: **PUBLIC KNOWLEDGE ONLY**.
    - SECRET: The hidden truth they are trying to hide.
    - ALIBI: Where they were, who with, and is it true?
    - RELATIONSHIPS: **MANDATORY**:
      1. If the suspect is alive, they MUST have an entry for "The Victim" and every other alive suspect.
      2. If the suspect is the victim, they MUST have an entry for every alive suspect by name.
      3. **CONTEXTUAL**: If the crime is Theft/Larceny, include a relationship to the "Owner" or "Target" if they are not a suspect.
      *INSTRUCTION*: Descriptions must be detailed (2-3 sentences).
    - KNOWN FACTS: 2-3 specific facts they know about the crime.
    - MOTIVE: A clear reason they might be suspected.
    - TIMELINE: A step-by-step list of their movements (at least 3 entries).
    - PROFESSIONAL BACKGROUND: A valid job or skill set.
    - WITNESS OBSERVATIONS: Something specific they saw or heard.
    
    Output JSON structure matching CaseData interface.

    CRITICAL: 
    - You MUST populate 'alibi', 'motive', 'relationships', 'knownFacts', 'timeline', 'professionalBackground', and 'witnessObservations' for EVERY suspect.
    - Do NOT return null for array fields. Use empty arrays [] if no data.
  `;
  
  const res = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: systemPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            type: { type: Type.STRING },
            description: { type: Type.STRING },
            officer: { type: Type.OBJECT, properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                gender: { type: Type.STRING },
                role: { type: Type.STRING },
                personality: { type: Type.STRING }
            }, required: ["name", "gender", "role", "personality"] },
            partner: { type: Type.OBJECT, properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                gender: { type: Type.STRING },
                role: { type: Type.STRING },
                personality: { type: Type.STRING }
            }, required: ["name", "gender", "role", "personality"] },
            initialEvidence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING }
            }, required: ["title", "description"] }},
            initialTimeline: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                time: { type: Type.STRING },
                activity: { type: Type.STRING }
            }, required: ["time", "activity"] }},
            suspects: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                gender: { type: Type.STRING },
                age: { type: Type.NUMBER },
                role: { type: Type.STRING },
                bio: { type: Type.STRING },
                personality: { type: Type.STRING },
                secret: { type: Type.STRING },
                physicalDescription: { type: Type.STRING },
                professionalBackground: { type: Type.STRING },
                isGuilty: { type: Type.BOOLEAN },
                isDeceased: { type: Type.BOOLEAN },
                baseAggravation: { type: Type.NUMBER },
                avatarSeed: { type: Type.NUMBER },
                motive: { type: Type.STRING },
                witnessObservations: { type: Type.STRING },
                alibi: { type: Type.OBJECT, properties: {
                    statement: { type: Type.STRING },
                    isTrue: { type: Type.BOOLEAN },
                    location: { type: Type.STRING },
                    witnesses: { type: Type.ARRAY, items: { type: Type.STRING }}
                }, required: ["statement", "isTrue", "location", "witnesses"] },
                relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                    targetName: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING }
                }, required: ["targetName", "type", "description"] }},
                timeline: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                    time: { type: Type.STRING },
                    activity: { type: Type.STRING }
                }, required: ["time", "activity"] }},
                knownFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                hiddenEvidence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                }, required: ["title", "description"] }}
            }, required: ["name", "gender", "role", "bio", "personality", "secret", "isGuilty", "baseAggravation", "motive", "alibi", "relationships", "knownFacts", "hiddenEvidence", "timeline", "professionalBackground", "witnessObservations"] }}
        },
        required: ["title", "description", "initialEvidence", "suspects", "officer", "partner"]
      }
    }
  });

  const data = JSON.parse(res.text!);
  console.log(`[DEBUG] generateCaseFromPrompt: Parsed JSON`, data);
  
  // Post-process to ensure IDs and defaults if AI missed something despite schema
  data.id = `custom-${Date.now()}`;
  data.initialEvidence = data.initialEvidence || [];
  data.initialEvidence.forEach((e: any, i: number) => e.id = `ie-${i}`);
  
  // Robustness for Support Characters
  data.initialTimeline = data.initialTimeline || [];
  data.difficulty = calculateDifficulty(data);
  if (!data.officer) data.officer = { id: 'officer', name: "Chief", gender: "Male", role: "Police Chief", personality: "Gruff" };
  data.officer.id = 'officer';
  data.officer.avatarSeed = Math.floor(Math.random() * 100000);
  data.officer.portraits = {};

  if (!data.partner) data.partner = { id: 'partner', name: "Al", gender: "Male", role: "Junior Detective", personality: "Eager" };
  data.partner.id = 'partner';
  data.partner.avatarSeed = Math.floor(Math.random() * 100000);
  data.partner.portraits = {};

  data.suspects = data.suspects || [];
  data.suspects.forEach((s: any, i: number) => {
      s.id = `s-${i}`;
      s.portraits = {};
      s.hiddenEvidence = s.hiddenEvidence || [];
      s.hiddenEvidence.forEach((e: any, j: number) => e.id = `he-${s.id}-${j}`);
      
      // Assign voice
      if (s.isDeceased) {
          s.voice = "None";
      } else if (!s.voice || s.voice === "None") {
          s.voice = getRandomVoice(s.gender);
      }
      
      // Fallbacks for robustness
      if (!s.gender) s.gender = "Unknown";
      if (!s.alibi) s.alibi = { statement: "I was home.", isTrue: true, location: "Home", witnesses: [] };
      if (!s.knownFacts) s.knownFacts = [];
      if (!s.timeline) s.timeline = [];
      if (!s.motive) s.motive = "Unknown";
      if (!s.professionalBackground) s.professionalBackground = "Unknown";
      if (!s.witnessObservations) s.witnessObservations = "None";
  });
  
  // Run logic to enforce relationships existence (Suspects only, as victim is a suspect)
  const finalData = enforceRelationships(data);
  return finalData as CaseData;
};
