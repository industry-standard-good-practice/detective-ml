
import { Type, ThinkingLevel } from "@google/genai";
import { CaseData } from "../types";
import { ai } from "./geminiClient";
import { getRandomVoice } from "../constants";
import { generateEvidenceImage } from "./geminiImages";
import { GEMINI_MODELS } from "./geminiModels";

// --- HELPERS ---

export const calculateDifficulty = (caseData: Partial<CaseData>): "Easy" | "Medium" | "Hard" => {
    const suspects = caseData.suspects || [];
    const aliveSuspects = suspects.filter(s => !s.isDeceased);
    const suspectCount = aliveSuspects.length;
    const initialEvidenceCount = caseData.initialEvidence?.length || 0;
    const hiddenEvidenceCount = suspects.reduce((acc, s) => acc + (s.hiddenEvidence?.length || 0), 0);
    const initialTimelineCount = caseData.initialTimeline?.length || 0;
    const totalEvidence = initialEvidenceCount + hiddenEvidenceCount;
    
    // Multiple victims and multiple guilty suspects significantly increase difficulty
    const victimCount = suspects.filter(s => s.isDeceased).length;
    const guiltyCount = suspects.filter(s => s.isGuilty).length;
    
    // Base complexity from suspect count and evidence
    let points = (suspectCount * 2) + totalEvidence - (initialTimelineCount * 0.5);
    
    // Extra victims add complexity (each additional victim beyond 1 adds +4)
    if (victimCount > 1) points += (victimCount - 1) * 4;
    
    // Multiple guilty suspects make deduction harder (each additional beyond 1 adds +5)
    if (guiltyCount > 1) points += (guiltyCount - 1) * 5;
    
    if (points > 28) return "Hard";
    if (points >= 20) return "Medium";
    return "Easy";
};

/**
 * Computes a diff between a baseline case (last AI-generated version) and the current draft.
 * Returns a structured object describing what the user manually changed.
 */
export const computeUserDiff = (baseline: CaseData, current: CaseData): Record<string, any> => {
    const diff: Record<string, any> = {};
    
    // Top-level case fields
    const topFields = ['title', 'type', 'description'] as const;
    topFields.forEach(f => {
        if ((baseline as any)[f] !== (current as any)[f]) {
            diff[f] = (current as any)[f];
        }
    });
    
    // Support characters
    ['officer', 'partner'].forEach(key => {
        const baseChar = (baseline as any)[key];
        const currChar = (current as any)[key];
        if (baseChar && currChar) {
            const charDiff: Record<string, any> = {};
            ['name', 'gender', 'role', 'personality'].forEach(f => {
                if (baseChar[f] !== currChar[f]) charDiff[f] = currChar[f];
            });
            if (Object.keys(charDiff).length > 0) diff[`_${key}`] = charDiff;
        }
    });
    
    // Suspects — field-level diff for each suspect by ID
    const suspectDiffs: Record<string, Record<string, any>> = {};
    const suspectFields = [
        'name', 'gender', 'age', 'role', 'bio', 'personality', 'secret', 'motive',
        'physicalDescription', 'professionalBackground', 'witnessObservations',
        'isGuilty', 'isDeceased', 'baseAggravation'
    ];
    current.suspects.forEach(s => {
        const bs = baseline.suspects.find(b => b.id === s.id);
        if (!bs) return; // Newly added suspect, no baseline to compare
        const fieldDiff: Record<string, any> = {};
        suspectFields.forEach(f => {
            if (JSON.stringify((bs as any)[f]) !== JSON.stringify((s as any)[f])) {
                fieldDiff[f] = (s as any)[f];
            }
        });
        // Check alibi (deep compare)
        if (JSON.stringify(bs.alibi) !== JSON.stringify(s.alibi)) {
            fieldDiff.alibi = s.alibi;
        }
        if (Object.keys(fieldDiff).length > 0) {
            suspectDiffs[s.id] = fieldDiff;
        }
    });
    if (Object.keys(suspectDiffs).length > 0) diff._suspects = suspectDiffs;
    
    console.log('[DEBUG] computeUserDiff: User manually changed:', Object.keys(diff).length > 0 ? diff : 'nothing');
    return diff;
};

/**
 * Converts a user diff into a human-readable change log that can be injected
 * into AI prompts. The AI uses this to understand what the user changed and
 * MUST propagate those changes throughout the entire narrative.
 */
export const formatUserChangeLog = (diff: Record<string, any>, baseline: CaseData): string => {
    if (Object.keys(diff).length === 0) return '';
    
    const lines: string[] = [];
    
    // Top-level case fields
    if (diff.title) lines.push(`- Case title changed to: "${diff.title}"`);
    if (diff.type) lines.push(`- Case type changed to: "${diff.type}"`);
    if (diff.description) lines.push(`- Case description was rewritten by the user`);
    
    // Support characters
    ['officer', 'partner'].forEach(key => {
        const charDiff = diff[`_${key}`];
        if (charDiff) {
            const label = key === 'officer' ? 'Officer/Chief' : 'Partner';
            Object.entries(charDiff).forEach(([field, value]) => {
                const origChar = (baseline as any)[key];
                const oldVal = origChar?.[field] || 'unknown';
                lines.push(`- ${label}'s ${field} changed from "${oldVal}" to "${value}"`);
            });
        }
    });
    
    // Suspects
    const suspectDiffs = diff._suspects as Record<string, Record<string, any>> | undefined;
    if (suspectDiffs) {
        Object.entries(suspectDiffs).forEach(([suspectId, fields]) => {
            const baselineSuspect = baseline.suspects.find(s => s.id === suspectId);
            const suspectLabel = baselineSuspect?.name || suspectId;
            
            Object.entries(fields).forEach(([field, value]) => {
                const oldVal = baselineSuspect ? (baselineSuspect as any)[field] : 'unknown';
                
                if (field === 'name') {
                    lines.push(`- Suspect "${oldVal}" was RENAMED to "${value}" — update ALL references to this character everywhere (description, bios, relationships, alibis, evidence, timeline, motives, secrets, witness observations)`);
                } else if (field === 'isGuilty') {
                    lines.push(`- Suspect "${suspectLabel}" guilt status changed to: ${value ? 'GUILTY' : 'INNOCENT'}`);
                } else if (field === 'isDeceased') {
                    lines.push(`- Suspect "${suspectLabel}" deceased status changed to: ${value ? 'DECEASED (victim)' : 'ALIVE'}`);
                } else if (field === 'alibi' && typeof value === 'object') {
                    lines.push(`- Suspect "${suspectLabel}"'s alibi was modified by the user`);
                } else if (typeof value === 'string' && value.length > 100) {
                    lines.push(`- Suspect "${suspectLabel}"'s ${field} was rewritten by the user`);
                } else {
                    lines.push(`- Suspect "${suspectLabel}"'s ${field} changed from "${oldVal}" to "${value}"`);
                }
            });
        });
    }
    
    return lines.join('\n');
};

/**
 * Simple safety-net: re-applies user's manual field-level edits onto an AI-generated case.
 * This ensures the AI didn't accidentally revert any explicit user values.
 * The AI prompt handles narrative propagation; this just enforces raw field values.
 */
export const applyUserDiff = (aiCase: CaseData, userDiff: Record<string, any>): void => {
    // Top-level fields
    ['title', 'type', 'description'].forEach(f => {
        if (userDiff[f] !== undefined) {
            (aiCase as any)[f] = userDiff[f];
        }
    });
    
    // Support characters
    ['officer', 'partner'].forEach(key => {
        const charDiff = userDiff[`_${key}`];
        if (charDiff && (aiCase as any)[key]) {
            Object.entries(charDiff).forEach(([field, value]) => {
                (aiCase as any)[key][field] = value;
            });
        }
    });
    
    // Suspects
    const suspectDiffs = userDiff._suspects as Record<string, Record<string, any>> | undefined;
    if (suspectDiffs) {
        Object.entries(suspectDiffs).forEach(([suspectId, fields]) => {
            const suspect = aiCase.suspects.find(s => s.id === suspectId);
            if (suspect) {
                Object.entries(fields).forEach(([field, value]) => {
                    (suspect as any)[field] = value;
                });
            }
        });
    }
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

// Helper to fix timeline entries where time+activity are mashed together in the time field
export const enforceTimelines = (caseData: any) => {
    const fixTimeline = (timeline: any[]): any[] => {
        if (!timeline || !Array.isArray(timeline)) return [];
        
        // First pass: try to fix entries
        timeline.forEach((entry: any) => {
            if (!entry.time && !entry.activity) return; // Will be stripped
            
            // If time is missing but activity exists — try to extract time from activity
            if ((!entry.time || entry.time.trim().length === 0) && entry.activity) {
                const actStr = entry.activity.trim();
                const match = actStr.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM|GTS|EST|PST|UTC|[A-Z]{2,4})?)\s*[:\-–—]\s*(.+)$/i);
                if (match) {
                    entry.time = match[1].trim();
                    entry.activity = match[2].trim();
                } else {
                    // Activity has no extractable time — give it a placeholder
                    entry.time = "??:?? ??";
                }
            }
            
            // If activity is missing but time has a description mashed in
            if (entry.time) {
                const timeStr = entry.time.trim();
                if (!entry.activity || entry.activity.trim().length === 0) {
                    const match = timeStr.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM|GTS|EST|PST|UTC|[A-Z]{2,4})?)\s*[:\-–—]\s*(.+)$/i);
                    if (match) {
                        entry.time = match[1].trim();
                        entry.activity = match[2].trim();
                    }
                }
            }
            
            // Fix if activity is just a duplicate of the time
            if (entry.activity && entry.time && entry.activity.trim() === entry.time.trim()) {
                entry.activity = '';
            }
        });
        
        // Second pass: strip entries that are completely empty (no time AND no activity)
        return timeline.filter((entry: any) => {
            const hasTime = entry.time && entry.time.trim().length > 0;
            const hasActivity = entry.activity && entry.activity.trim().length > 0;
            return hasTime || hasActivity;
        });
    };

    // Fix suspect timelines
    if (caseData.suspects && Array.isArray(caseData.suspects)) {
        caseData.suspects.forEach((s: any) => {
            s.timeline = fixTimeline(s.timeline);
        });
    }

    // Fix initial timeline
    caseData.initialTimeline = fixTimeline(caseData.initialTimeline);

    return caseData;
};

/**
 * Comprehensive post-processor that validates and fixes EVERY field on every suspect.
 * Comprehensive post-processor that validates every field on every suspect.
 * Instead of patching with placeholder defaults, it CARRIES FORWARD the original
 * data from the pre-edit case. If a field existed before and the AI dropped it,
 * the original value is preserved. 100% data completeness, zero placeholders.
 * 
 * Call this AFTER enforceRelationships and enforceTimelines.
 * 
 * @param caseData - The AI-generated case data to validate
 * @param originalCase - The original case data to carry forward from (if available)
 */
export const enforceSuspectSchema = (caseData: any, originalCase?: any) => {
    if (!caseData.suspects || !Array.isArray(caseData.suspects)) return caseData;
    const origSuspects: any[] = originalCase?.suspects || [];

    caseData.suspects.forEach((s: any) => {
        const orig = origSuspects.find((os: any) => os.id === s.id) || {};

        // --- REQUIRED STRING FIELDS: carry forward from original if AI dropped ---
        const stringFields = [
            'name', 'gender', 'bio', 'role', 'personality', 'secret', 'motive',
            'professionalBackground', 'witnessObservations', 'physicalDescription'
        ];
        stringFields.forEach(f => {
            if (!s[f] || typeof s[f] !== 'string' || s[f].trim().length === 0) {
                if (orig[f] && typeof orig[f] === 'string' && orig[f].trim().length > 0) {
                    s[f] = orig[f];
                }
            }
        });

        // --- REQUIRED NUMBER FIELDS: carry forward ---
        if (typeof s.age !== 'number' || isNaN(s.age)) s.age = orig.age ?? s.age;
        if (typeof s.baseAggravation !== 'number' || isNaN(s.baseAggravation)) s.baseAggravation = orig.baseAggravation ?? s.baseAggravation;
        if (typeof s.avatarSeed !== 'number' || isNaN(s.avatarSeed)) s.avatarSeed = orig.avatarSeed ?? Math.floor(Math.random() * 999999);

        // --- REQUIRED BOOLEAN FIELDS: carry forward ---
        if (typeof s.isGuilty !== 'boolean') s.isGuilty = orig.isGuilty ?? false;
        if (s.isDeceased === undefined && orig.isDeceased !== undefined) s.isDeceased = orig.isDeceased;

        // --- ALIBI: carry forward entire alibi if AI mangled it ---
        if (!s.alibi || typeof s.alibi !== 'object') {
            s.alibi = orig.alibi ? JSON.parse(JSON.stringify(orig.alibi)) : { statement: '', isTrue: true, location: '', witnesses: [] };
        } else {
            if (!s.alibi.statement && orig.alibi?.statement) s.alibi.statement = orig.alibi.statement;
            if (typeof s.alibi.isTrue !== 'boolean') s.alibi.isTrue = orig.alibi?.isTrue ?? true;
            if (!s.alibi.location && orig.alibi?.location) s.alibi.location = orig.alibi.location;
            if (!Array.isArray(s.alibi.witnesses)) s.alibi.witnesses = orig.alibi?.witnesses || [];
            s.alibi.witnesses = s.alibi.witnesses.filter((w: any) => typeof w === 'string' && w.trim().length > 0);
        }

        // --- TIMELINE: carry forward original if AI returned nothing ---
        if (!Array.isArray(s.timeline)) {
            s.timeline = orig.timeline ? JSON.parse(JSON.stringify(orig.timeline)) : [];
        } else {
            // Strip entries missing the required time field
            s.timeline = s.timeline.filter((entry: any) => {
                if (!entry || typeof entry !== 'object') return false;
                return entry.time && typeof entry.time === 'string' && entry.time.trim().length > 0;
            });
            // Recover missing activity from original by matching time
            s.timeline.forEach((entry: any) => {
                if (!entry.activity || typeof entry.activity !== 'string' || entry.activity.trim().length === 0) {
                    const origEntry = (orig.timeline || []).find((oe: any) => oe.time === entry.time);
                    if (origEntry?.activity) entry.activity = origEntry.activity;
                }
            });
            // If AI returned empty timeline but original had one, carry forward
            if (s.timeline.length === 0 && orig.timeline && orig.timeline.length > 0) {
                s.timeline = JSON.parse(JSON.stringify(orig.timeline));
            }
        }

        // --- RELATIONSHIPS: carry forward from original if AI dropped ---
        if (!Array.isArray(s.relationships)) {
            s.relationships = orig.relationships ? JSON.parse(JSON.stringify(orig.relationships)) : [];
        } else {
            s.relationships = s.relationships.filter((r: any) => {
                if (!r || typeof r !== 'object') return false;
                return r.targetName && typeof r.targetName === 'string' && r.targetName.trim().length > 0;
            });
            // Recover missing type/description from original
            s.relationships.forEach((r: any) => {
                const origRel = (orig.relationships || []).find((or: any) => or.targetName === r.targetName);
                if (!r.type || typeof r.type !== 'string') r.type = origRel?.type || 'Acquaintance';
                if (!r.description || typeof r.description !== 'string' || r.description.trim().length === 0) {
                    if (origRel?.description) r.description = origRel.description;
                }
            });
        }

        // --- KNOWN FACTS: carry forward if AI dropped ---
        if (!Array.isArray(s.knownFacts)) {
            s.knownFacts = orig.knownFacts ? [...orig.knownFacts] : [];
        } else {
            s.knownFacts = s.knownFacts.filter((f: any) => typeof f === 'string' && f.trim().length > 0);
            if (s.knownFacts.length === 0 && orig.knownFacts && orig.knownFacts.length > 0) {
                s.knownFacts = [...orig.knownFacts];
            }
        }

        // --- HIDDEN EVIDENCE: carry forward images + descriptions from original ---
        if (!Array.isArray(s.hiddenEvidence)) {
            s.hiddenEvidence = orig.hiddenEvidence ? JSON.parse(JSON.stringify(orig.hiddenEvidence)) : [];
        } else {
            s.hiddenEvidence = s.hiddenEvidence.filter((ev: any) => {
                if (!ev || typeof ev !== 'object') return false;
                return ev.title && typeof ev.title === 'string' && ev.title.trim().length > 0;
            });
            s.hiddenEvidence.forEach((ev: any, i: number) => {
                if (!ev.id || typeof ev.id !== 'string') ev.id = `he-${s.id}-${i}`;
                if (!ev.description || typeof ev.description !== 'string') {
                    const origEv = (orig.hiddenEvidence || []).find((oe: any) => oe.id === ev.id || oe.title === ev.title);
                    ev.description = origEv?.description || ev.title;
                }
            });
        }

        // --- PORTRAITS & VOICE: always carry forward (AI never generates these) ---
        if (!s.portraits || Object.keys(s.portraits).length === 0) s.portraits = orig.portraits || {};
        if (!s.voice) s.voice = orig.voice;
    });

    // --- INITIAL EVIDENCE: carry forward descriptions from original ---
    if (Array.isArray(caseData.initialEvidence)) {
        const origEvidence = originalCase?.initialEvidence || [];
        caseData.initialEvidence = caseData.initialEvidence.filter((ev: any) => {
            if (!ev || typeof ev !== 'object') return false;
            return ev.title && typeof ev.title === 'string' && ev.title.trim().length > 0;
        });
        caseData.initialEvidence.forEach((ev: any, i: number) => {
            if (!ev.id || typeof ev.id !== 'string') ev.id = `ie-${i}`;
            if (!ev.description || typeof ev.description !== 'string') {
                const origEv = origEvidence.find((oe: any) => oe.id === ev.id || oe.title === ev.title);
                ev.description = origEv?.description || ev.title;
            }
        });
    }

    // --- INITIAL TIMELINE: carry forward activity from original ---
    if (Array.isArray(caseData.initialTimeline)) {
        const origTimeline = originalCase?.initialTimeline || [];
        caseData.initialTimeline = caseData.initialTimeline.filter((entry: any) => {
            if (!entry || typeof entry !== 'object') return false;
            return entry.time && typeof entry.time === 'string' && entry.time.trim().length > 0;
        });
        caseData.initialTimeline.forEach((entry: any) => {
            if (!entry.activity || typeof entry.activity !== 'string' || entry.activity.trim().length === 0) {
                const origEntry = origTimeline.find((oe: any) => oe.time === entry.time);
                if (origEntry?.activity) entry.activity = origEntry.activity;
            }
        });
    }

    console.log('[DEBUG] enforceSuspectSchema: Validated all suspects and case-level data');
    return caseData;
};

// --- SHARED PROMPT RULES (Single source of truth for all AI prompts) ---

const PROMPT_RULES = {
    /** Rules for relationship quality — used in generation, consistency, and edit */
    RELATIONSHIP_QUALITY: `**RELATIONSHIP QUALITY (CRITICAL):**
- Every suspect's 'relationships' array must have an entry for the victim and every other alive suspect.
- Each relationship 'description' field MUST be a rich, narrative description (2-3 sentences minimum) that describes how they feel about the person, their history, and any tension or closeness.
- The 'description' MUST NOT simply repeat the 'type' label (e.g. if type is "Acquaintance", description cannot just say "Acquaintance").
- Descriptions should reveal character personality and hint at dynamics relevant to the mystery.`,

    /** Rules for timeline entry format — used in generation, consistency, and edit */
    TIMELINE_FORMAT: `**TIMELINE FORMAT (CRITICAL):**
- Every timeline entry has TWO separate fields: 'time' and 'activity'.
- The 'time' field must contain ONLY the timestamp (e.g. "8:00 PM", "11:30 AM"). Do NOT put the activity description in the time field.
- The 'activity' field must contain the description of what happened (e.g. "Arrived at the lab to begin shift").
- **12-HOUR FORMAT ONLY:** ALL times MUST use 12-hour AM/PM format. NEVER use 24-hour military time (e.g. "20:00", "23:30"). Always write "8:00 PM", not "20:00". Always write "11:30 PM", not "23:30".
- WRONG: { time: "8:00 PM: Arrived at the lab", activity: "" }
- WRONG: { time: "20:00", activity: "Arrived at the lab" }
- CORRECT: { time: "8:00 PM", activity: "Arrived at the lab to begin shift" }
- This applies to BOTH suspect timelines AND the case-level initialTimeline.`,

    /** Rules for keeping initial timeline spoiler-free — used in generation, consistency, and edit */
    INITIAL_TIMELINE_SPOILER_PROTECTION: `**INITIAL TIMELINE — SPOILER PROTECTION (CRITICAL):**
- The 'initialTimeline' represents facts documented by PATROL OFFICERS and FIRST RESPONDERS before the case is handed to a detective (the player).
- It is the PLAYER'S STARTING POINT. It must NEVER reveal or strongly imply who is guilty.
- **ABSOLUTELY FORBIDDEN in initialTimeline:**
  * Naming any guilty suspect in connection with suspicious activity
  * Describing incriminating actions by the guilty party (e.g. "John seen fleeing the scene")
  * Revealing motive or opportunity specific to the guilty suspect
  * Any entry that makes the solution obvious before investigation begins
- **ALLOWED in initialTimeline:**
  * When the crime was discovered ("Body found at 10:00 PM by security guard")
  * When emergency services arrived ("Police arrived on scene at 10:15 PM")
  * Estimated time of death or crime window ("Coroner estimates TOD between 8-9 PM")
  * Neutral environmental observations ("Back door found unlocked", "Security cameras offline since 7 PM")
  * General witness reports that don't name guilty suspects ("Neighbors report hearing an argument around 8:30 PM")
- If the existing initialTimeline contains entries that reveal guilt, REWRITE them to be neutral.`,

    /** Naming constraints — used in generation and edit (when changing themes) */
    NAMING_RULES: `**NAMING RULES:**
- **STRICT CONSTRAINT:** Do NOT use "cool", "edgy", or "YA Novel" names unless explicitly requested by the user prompt.
- **BANNED NAMES:** Jarek, Zara, Vane, Kael, Rian, Elias, Silas, Elara, Lyra, Orion, Nova, Zephyr, Thorne, Nyx, Jax, Kai, Luna, Raven, Shadow, Talon, Blaze.
- **PREFERRED STYLE:** Use grounded, realistic, mundane names suitable for a gritty police report. (e.g. Frank, Martha, David, Sarah, Robert, Chen, Rodriguez, Kowalski, Smith, Jones, Patel, Nguyen).
- If the setting is historical or specific (e.g. 1920s), use period-accurate names.`,

    /** Victim generation rule — used in generation and edit */
    VICTIM_GENERATION: `**VICTIM GENERATION RULE:**
If the crime involves a death or a body (e.g. Murder, Homicide), YOU MUST GENERATE "THE VICTIM" AS A SUSPECT CARD.
- Name: A realistic full name for the victim.
- Role: "The Victim".
- **isDeceased: true**.
- hiddenEvidence: Must contain 2-3 physical clues found on the body (e.g. "Bruise on wrist", "Watch frozen at 9pm", "Pocket lint").
- Alibi/Motive: Set to "N/A (Deceased)".
- Bio: Description of the body's state and their life before death.`,

    /** Suspect profile requirements — used in generation and consistency */
    SUSPECT_PROFILES: `**SUSPECT PROFILE REQUIREMENTS:**
- GENDER: Explicitly state Male, Female, or Non-binary.
- BIO: **PUBLIC PROFILE ONLY — SPOILER-FREE** (see BIO SPOILER PROTECTION rules below).
- SECRET: The hidden truth they are trying to hide.
- ALIBI: Where they were, who with, and is it true?
- RELATIONSHIPS: **MANDATORY**:
  1. If the suspect is alive, they MUST have an entry for "The Victim" and every other alive suspect.
  2. If the suspect is the victim, they MUST have an entry for every alive suspect by name.
  3. **CONTEXTUAL**: If the crime is Theft/Larceny, include a relationship to the "Owner" or "Target" if they are not a suspect.
  *INSTRUCTION*: Descriptions must be detailed (2-3 sentences).
- KNOWN FACTS: 2-3 specific facts they know about the crime.
- MOTIVE: A clear reason they might be suspected.
- TIMELINE: A step-by-step list of their movements (at least 3 entries). Each entry has TWO fields:
  * 'time': ONLY the timestamp (e.g. "8:00 PM"). Do NOT include the activity here.
  * 'activity': The description of what happened (e.g. "Arrived at the restaurant for dinner").
- PROFESSIONAL BACKGROUND: A valid job or skill set.
- WITNESS OBSERVATIONS: Something specific they saw or heard.
- hiddenEvidence: Items they have that prove guilt or secrets. The guilty party MUST have damning hidden evidence.`,

    /** Data completeness requirement — used in all three */
    DATA_COMPLETENESS: `**DATA COMPLETENESS (CRITICAL):**
- You MUST populate 'alibi', 'motive', 'relationships', 'knownFacts', 'timeline', 'professionalBackground', and 'witnessObservations' for EVERY suspect.
- Do NOT return null or empty strings for required fields.
- Do NOT return empty arrays [] for timeline, relationships, or knownFacts — generate real content.`,

    /** Output format for consistency/edit modes — NOT used in generation */
    OUTPUT_FORMAT_WITH_REPORT: `**OUTPUT FORMAT:**
- You must return a JSON object with two fields:
  - 'updatedCase': The complete CaseData object.
  - 'report': A structured object containing 'issuesFound', 'changesMade' (array of {description, evidenceId}), and 'conclusion'.`,

    /** Bio spoiler protection — used in generation, consistency, and edit */
    BIO_SPOILER_PROTECTION: `**BIO / PUBLIC PROFILE — SPOILER PROTECTION (CRITICAL):**
- The 'bio' field is displayed prominently on the BACK of each suspect's card. It is the FIRST thing the player reads about a suspect BEFORE any interrogation.
- It must read like a PUBLIC DOSSIER — what a detective would know from a background check, NOT from the investigation.
- **ABSOLUTELY FORBIDDEN in bio:**
  * Any statement that the suspect committed the crime (e.g. "she chose to end her abuse permanently")
  * Explicit references to the suspect's guilt, confessions, or incriminating actions
  * Descriptions of the suspect's motive phrased as fact (e.g. "driven to kill by jealousy")
  * Any language that makes the solution obvious before investigation begins
  * Phrases like "seized the opportunity", "snapped", "took matters into their own hands", "decided to act", "couldn't take it anymore and..."
- **REQUIRED in bio:**
  * Their public background (job, social standing, reputation)
  * Their known connection to the victim or the location
  * General personality traits observable by others
  * Optionally, subtle hints about tension or conflict — but NEVER revealing who did it
- EXAMPLE BAD BIO: "A talented performer who was cornered by Thomas. When threatened, she chose to seize the opportunity to end her abuse permanently."
- EXAMPLE GOOD BIO: "A talented jazz singer and regular performer at The Blue Note. Known for her captivating stage presence and sharp wit, she has been a fixture of the local music scene for five years. Recently rumored to be in a dispute with the club's management over her contract."
- This rule applies to ALL suspects — both guilty and innocent. Bios must be indistinguishable in tone between guilty and innocent suspects.`,
} as const;

// --- SCHEMAS ---

const CASE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        type: { type: Type.STRING },
        description: { type: Type.STRING },
        startTime: { type: Type.STRING },
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
                    }, required: ["statement", "isTrue", "location", "witnesses"]},
                    relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                        targetName: { type: Type.STRING },
                        type: { type: Type.STRING },
                        description: { type: Type.STRING }
                    }, required: ["targetName", "type", "description"]}},
                    timeline: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                        time: { type: Type.STRING },
                        activity: { type: Type.STRING }
                    }, required: ["time", "activity"]}},
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

export const checkCaseConsistency = async (caseData: CaseData, onProgress?: (msg: string) => void, baseline?: CaseData): Promise<{ updatedCase: CaseData, report: any }> => {
  console.log(`[DEBUG] checkCaseConsistency: Starting for case "${caseData.title}"`);
  
  // Compute user changes from baseline for the AI prompt
  let userChangeLog = '';
  if (baseline) {
      const userDiff = computeUserDiff(baseline, caseData);
      userChangeLog = formatUserChangeLog(userDiff, baseline);
      if (userChangeLog) {
          console.log('[DEBUG] checkCaseConsistency: User change log:\n' + userChangeLog);
      }
  }
  
  if (onProgress) onProgress("Stripping visual assets for analysis...");
  const { stripped: lightweightCase, imageMap } = stripImagesFromCase(caseData);

  const guiltySuspects = caseData.suspects.filter(s => s.isGuilty);
  const guiltyNames = guiltySuspects.length > 0 ? guiltySuspects.map(s => s.name).join(', ') : "Unknown";

  // Build dynamic user-edits prompt section
  const userEditsSection = userChangeLog ? `
    **0. USER MANUAL EDITS (HIGHEST PRIORITY — DO NOT REVERT):**
       The user has made the following manual changes to the case since the last save.
       These changes are IMMUTABLE and MUST be respected as ground truth.
       You MUST propagate these changes throughout the ENTIRE case narrative — update every reference, relationship, description, bio, alibi, motive, secret, timeline entry, evidence description, and witness observation to be consistent with these user-requested changes.
       DO NOT revert any of these. DO NOT suggest reverting them in the report.
       
       USER CHANGES:
${userChangeLog}
` : '';

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
        model: GEMINI_MODELS.CASE_ENGINE,
        contents: `You are a Master Mystery Editor and Narrative Architect.
    I will provide a JSON object representing a detective mystery game case.
    
    YOUR MISSION:
    Perform a deep narrative audit and structural repair. The case must be perfectly consistent, logically sound, and satisfyingly solvable.
    ${userEditsSection}
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
       
    4. ${PROMPT_RULES.RELATIONSHIP_QUALITY}
        
    5. ${PROMPT_RULES.TIMELINE_FORMAT}
        
    6. ${PROMPT_RULES.INITIAL_TIMELINE_SPOILER_PROTECTION}
        
    7. ${PROMPT_RULES.DATA_COMPLETENESS}
    
    8. ${PROMPT_RULES.BIO_SPOILER_PROTECTION}
    
    9. **START TIME VALIDATION:**
       - The 'startTime' field is an ISO datetime string (e.g. "2030-09-12T23:30") representing when the player begins their investigation.
       - Ensure the startTime makes narrative sense for the case. A gritty noir murder should start late at night, not at 9:00 AM.
       - The startTime should be AFTER the crime has occurred but close enough that the trail is still warm.
       - If the current startTime doesn't fit the narrative, update it to something appropriate.
    
    10. ${PROMPT_RULES.OUTPUT_FORMAT_WITH_REPORT}
    
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

    // CRITICAL: Preserve original case identity — AI generates a new ID but we must keep the original
    hydratedCase.id = caseData.id;
    hydratedCase.authorId = caseData.authorId;
    hydratedCase.version = caseData.version;
    hydratedCase.isUploaded = caseData.isUploaded;
    if (!hydratedCase.startTime && caseData.startTime) hydratedCase.startTime = caseData.startTime;
    if (!hydratedCase.heroImageUrl && caseData.heroImageUrl) hydratedCase.heroImageUrl = caseData.heroImageUrl;

    // Ensure we don't lose non-narrative fields

    // Merge support characters — AI only returns {id, name, role, gender}
    ['officer', 'partner'].forEach(key => {
        const aiChar = (hydratedCase as any)[key];
        const origChar = (caseData as any)[key];
        if (aiChar && origChar) {
            const merged = { ...origChar };
            if (aiChar.name) merged.name = aiChar.name;
            if (aiChar.role) merged.role = aiChar.role;
            if (aiChar.gender) merged.gender = aiChar.gender;
            if (aiChar.personality) merged.personality = aiChar.personality;
            (hydratedCase as any)[key] = merged;
        }
    });

    // Merge suspects
    hydratedCase.suspects.forEach(s => {
        const origSuspect = caseData.suspects.find(os => os.id === s.id);
        if (origSuspect) {
            if (s.avatarSeed === undefined) s.avatarSeed = origSuspect.avatarSeed;
            if (s.voice === undefined) s.voice = origSuspect.voice;
            if (!s.portraits || Object.keys(s.portraits).length === 0) s.portraits = origSuspect.portraits;
        }
    });

    const finalData = enforceSuspectSchema(enforceTimelines(enforceRelationships(hydratedCase)), caseData);
    
    // --- SAFETY NET: Re-apply user's field-level edits ---
    // The AI was instructed to respect these, but we enforce them as a fallback
    if (baseline) {
        const userDiff = computeUserDiff(baseline, caseData);
        if (Object.keys(userDiff).length > 0) {
            applyUserDiff(finalData, userDiff);
            console.log('[DEBUG] checkCaseConsistency: Safety-net re-applied user field values');
        }
    }

    // Generate images for any NEW evidence added by the AI
    if (onProgress) onProgress("Generating images for new evidence...");
    const userId = caseData.authorId;
    if (!userId) throw new Error('[CRITICAL] checkCaseConsistency: caseData.authorId is required');
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
export const editCaseWithPrompt = async (caseData: CaseData, userPrompt: string, onProgress?: (msg: string) => void, baseline?: CaseData): Promise<{ updatedCase: CaseData, report: any }> => {
    console.log(`[DEBUG] editCaseWithPrompt: Starting with prompt "${userPrompt}"`);
    
    // Compute user changes from baseline for the AI prompt
    let userChangeLog = '';
    if (baseline) {
        const userDiff = computeUserDiff(baseline, caseData);
        userChangeLog = formatUserChangeLog(userDiff, baseline);
        if (userChangeLog) {
            console.log('[DEBUG] editCaseWithPrompt: User change log:\n' + userChangeLog);
        }
    }
    
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

    // Build dynamic user-edits prompt section for edit
    const userEditsSection = userChangeLog ? `
      **IMPORTANT — USER MANUAL EDITS (DO NOT REVERT):**
      The user has also made the following manual changes to the case.
      These changes are IMMUTABLE. Preserve them and propagate them throughout the narrative.
      
      USER CHANGES:
${userChangeLog}
` : '';

    try {
        const result = await ai.models.generateContent({
            model: GEMINI_MODELS.CASE_ENGINE,
            contents: `You are a Master Narrative Architect.
      I will provide a JSON object representing a detective mystery game case and a USER REQUEST for modification.
      
      YOUR MISSION:
      Transform the case according to the user's request. This can range from minor tweaks to a complete overhaul of the setting, characters, and plot.
      
      USER REQUEST: "${userPrompt}"
      ${userEditsSection}
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
         
      4. **BASIC CONSISTENCY:**
         - Make a reasonable effort to keep timelines, names, and relationships consistent with your changes.
         - A separate, thorough consistency check will run after your edits, so focus on the transformation.
         
      5. ${PROMPT_RULES.RELATIONSHIP_QUALITY}
          
      6. ${PROMPT_RULES.TIMELINE_FORMAT}
          
      7. ${PROMPT_RULES.INITIAL_TIMELINE_SPOILER_PROTECTION}
      
      8. ${PROMPT_RULES.NAMING_RULES}

      9. ${PROMPT_RULES.DATA_COMPLETENESS}

      10. ${PROMPT_RULES.BIO_SPOILER_PROTECTION}
           
      11. ${PROMPT_RULES.OUTPUT_FORMAT_WITH_REPORT}
      
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

        // CRITICAL: Preserve original case identity
        hydratedCase.id = caseData.id;
        hydratedCase.authorId = caseData.authorId;
        hydratedCase.version = caseData.version;
        hydratedCase.isUploaded = caseData.isUploaded;
        if (!hydratedCase.startTime && caseData.startTime) hydratedCase.startTime = caseData.startTime;

        const themeChanged = hydratedCase.type !== caseData.type;
        if (themeChanged) {
            console.log(`[DEBUG] Theme changed from ${caseData.type} to ${hydratedCase.type}. Forcing full image regeneration.`);
            // Clear hero image if it was derived from evidence/victim
            delete hydratedCase.heroImageUrl;
        }

        // 1. Check Support Characters for changes
        ['officer', 'partner'].forEach(key => {
            const aiChar = (hydratedCase as any)[key];
            const origChar = (caseData as any)[key];
            if (aiChar && origChar) {
                // The AI schema only returns {id, name, role, gender} for support chars.
                // We must merge the original's full data first, then overlay AI's narrative changes.
                const merged = { ...origChar };
                
                // Overlay AI fields that are in the schema
                if (aiChar.name) merged.name = aiChar.name;
                if (aiChar.role) merged.role = aiChar.role;
                if (aiChar.gender) merged.gender = aiChar.gender;
                if (aiChar.personality) merged.personality = aiChar.personality;
                
                const roleChanged = merged.role !== origChar.role;
                const personalityChanged = merged.personality !== origChar.personality;
                const nameChanged = merged.name !== origChar.name;
                
                if (themeChanged || roleChanged || personalityChanged || nameChanged) {
                    // Character meaningfully changed — clear portraits for regeneration
                    merged.portraits = {};
                    merged.avatarSeed = Math.floor(Math.random() * 1000000);
                }
                // Otherwise merged already has origChar.portraits, avatarSeed, voice, etc.
                
                (hydratedCase as any)[key] = merged;
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

        const finalData = enforceSuspectSchema(enforceTimelines(enforceRelationships(hydratedCase)), caseData);

        // --- SAFETY NET: Re-apply user's field-level edits ---
        if (baseline) {
            const userDiff = computeUserDiff(baseline, caseData);
            if (Object.keys(userDiff).length > 0) {
                applyUserDiff(finalData, userDiff);
                console.log('[DEBUG] editCaseWithPrompt: Safety-net re-applied user field values');
            }
        }

        // Generate images for NEW or CHANGED content
        if (onProgress) onProgress("Generating visual assets for updated content...");
        const userId = caseData.authorId;
        if (!userId) throw new Error('[CRITICAL] editCaseWithPrompt: caseData.authorId is required');
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
    
    ${PROMPT_RULES.INITIAL_TIMELINE_SPOILER_PROTECTION}
    
    ${PROMPT_RULES.TIMELINE_FORMAT}
    
    CRITICAL INSTRUCTION - SUPPORT CHARACTERS:
    You must generate two support characters that fit the THEME:
    1. 'officer': The quest giver / boss. (e.g. For Fantasy: "Captain of the Guard"; For Sci-Fi: "Station Commander").
    2. 'partner': The player's sidekick. (e.g. For Fantasy: "Novice Mage"; For Sci-Fi: "Droid Unit").
    
    ${PROMPT_RULES.NAMING_RULES}
    
    CRITICAL INSTRUCTION - CRIME TYPE:
    - 'type' MUST be specific legal classification.
    
    CRITICAL INSTRUCTION: Include the EXACT number of suspects requested in the Theme/Prompt.
    If the user does not specify a number, default to 5 suspects.
    One or more suspects must be Guilty.
    
    ${PROMPT_RULES.VICTIM_GENERATION}
    
    ${PROMPT_RULES.SUSPECT_PROFILES}
    
    ${PROMPT_RULES.RELATIONSHIP_QUALITY}
    
    ${PROMPT_RULES.DATA_COMPLETENESS}
    
    ${PROMPT_RULES.BIO_SPOILER_PROTECTION}
    
    CRITICAL INSTRUCTION - START TIME:
    - Generate a 'startTime' field as an ISO datetime string (e.g. "2030-09-12T23:30").
    - Choose a time that fits the case's atmosphere and theme. Noir cases should be late night, daytime crimes can start in the morning, etc.
    
    Output JSON structure matching CaseData interface.
  `;
  
  const res = await ai.models.generateContent({
    model: GEMINI_MODELS.CASE_GENERATION,
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
            startTime: { type: Type.STRING },
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
  if (!data.startTime) data.startTime = '2030-09-12T23:30';
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
  const finalData = enforceSuspectSchema(enforceTimelines(enforceRelationships(data)));
  return finalData as CaseData;
};
