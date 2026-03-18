
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

    // Higher base aggravation = more hostile/uncooperative suspects = harder to extract info
    if (aliveSuspects.length > 0) {
        const avgAggravation = aliveSuspects.reduce((sum, s) => sum + (s.baseAggravation || 0), 0) / aliveSuspects.length;
        points += (avgAggravation / 100) * 6;
    }

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
                    lines.push(`- Suspect "${oldVal}" was RENAMED to "${value}" — this is the COMPLETE new name. Use "${value}" EXACTLY and COMPLETELY. Do NOT keep any part of the old name "${oldVal}". Update ALL references to this character everywhere (description, bios, relationships, alibis, evidence, timeline, motives, secrets, witness observations).`);
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

    const hasVictim = caseData.hasVictim !== false; // default true for backwards compat
    const victim = caseData.suspects.find((s: any) => s.isDeceased);
    const victimName = victim?.name.trim();
    const aliveSuspectNames = caseData.suspects.filter((s: any) => !s.isDeceased).map((s: any) => s.name.trim());

    caseData.suspects.forEach((s: any) => {
        if (!s.relationships) s.relationships = [];
        const currentName = s.name.trim();
        const isDeceased = s.isDeceased;

        // 1. Canonicalize "The Victim" relationship (only if hasVictim)
        if (hasVictim && !isDeceased && victimName) {
            // If they have a relationship with the victim's name, rename it to "The Victim"
            s.relationships.forEach((r: any) => {
                if (r.targetName.trim() === victimName) {
                    r.targetName = "The Victim";
                }
            });
        }

        // If hasVictim is false, strip any "The Victim" relationships that may have been generated
        if (!hasVictim) {
            s.relationships = s.relationships.filter((r: any) => r.targetName.trim() !== "The Victim");
        }

        // 2. Define targets for this specific suspect
        const targets: string[] = [];

        if (!isDeceased) {
            // Alive suspects need "The Victim" (if applicable) + other alive suspects
            if (hasVictim) {
                targets.push("The Victim");
            }
            aliveSuspectNames.forEach(name => {
                if (name !== currentName) targets.push(name);
            });
        } else {
            // The victim has relationships with all ALIVE suspects
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
 * Validates and fixes the startTime to ensure it falls after all same-day timeline events.
 * If the startTime is before the latest event on today (dayOffset 0), it is shifted forward.
 */
export const enforceStartTimeAlignment = (caseData: any) => {
    if (!caseData.startTime) return caseData;

    const startDate = new Date(caseData.startTime);
    if (isNaN(startDate.getTime())) return caseData; // Invalid date, skip

    // Helper: parse a 12-hour time string (e.g. "10:30 PM") into hours and minutes
    const parseTime12h = (timeStr: string): { hours: number; minutes: number } | null => {
        if (!timeStr) return null;
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        if (period === 'AM' && hours === 12) hours = 0;
        if (period === 'PM' && hours !== 12) hours += 12;
        return { hours, minutes };
    };

    // Collect all today's timeline events (dayOffset === 0)
    const crimeDayEvents: { hours: number; minutes: number }[] = [];

    // From initialTimeline
    (caseData.initialTimeline || []).forEach((entry: any) => {
        if ((entry.dayOffset ?? 0) === 0) {
            const parsed = parseTime12h(entry.time);
            if (parsed) crimeDayEvents.push(parsed);
        }
    });

    // From suspect timelines
    (caseData.suspects || []).forEach((s: any) => {
        (s.timeline || []).forEach((entry: any) => {
            if ((entry.dayOffset ?? 0) === 0) {
                const parsed = parseTime12h(entry.time);
                if (parsed) crimeDayEvents.push(parsed);
            }
        });
    });

    if (crimeDayEvents.length === 0) return caseData;

    // Find the latest crime-day event
    const latestEvent = crimeDayEvents.reduce((latest, ev) => {
        const evMinutes = ev.hours * 60 + ev.minutes;
        const latestMinutes = latest.hours * 60 + latest.minutes;
        return evMinutes > latestMinutes ? ev : latest;
    });

    const latestEventMinutes = latestEvent.hours * 60 + latestEvent.minutes;
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();

    // If startTime is before or equal to the latest crime-day event, shift it forward by 30 min
    if (startMinutes <= latestEventMinutes) {
        const newMinutes = latestEventMinutes + 30;
        const newHours = Math.floor(newMinutes / 60);
        const newMins = newMinutes % 60;

        if (newHours < 24) {
            startDate.setHours(newHours, newMins, 0, 0);
        } else {
            // Rolls past midnight — move to next day
            startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(newHours - 24, newMins, 0, 0);
        }

        // Format back to a human-readable string
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formatted = startDate.toLocaleDateString('en-US', options)
            + ' at ' + startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        caseData.startTime = formatted;

        console.log(`[DEBUG] enforceStartTimeAlignment: Shifted startTime to ${caseData.startTime} (latest same-day event was at ${latestEvent.hours}:${String(latestEvent.minutes).padStart(2, '0')})`);
    }

    return caseData;
};

/**
 * Ensures the initialTimeline always ends with a "suspects brought in for questioning" entry.
 * If missing, one is appended. If present but not last, it's moved to the end.
 * The entry's time is guaranteed to be AFTER all other dayOffset 0 events.
 */
export const ensureBroughtInEntry = (caseData: any) => {
    if (!caseData.initialTimeline) caseData.initialTimeline = [];

    // Helper: parse "8:30 PM" → minutes-since-midnight (or null)
    const parseTime12h = (t: string): number | null => {
        if (!t) return null;
        const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return null;
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const period = m[3].toUpperCase();
        if (period === 'AM' && h === 12) h = 0;
        if (period === 'PM' && h !== 12) h += 12;
        return h * 60 + min;
    };

    // Helper: minutes-since-midnight → "10:30 PM"
    const formatTime = (mins: number): string => {
        let h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        return `${h}:${String(m).padStart(2, '0')} ${period}`;
    };

    // Try to extract a time string from startTime
    let timeStr = ''; // will be determined below
    if (caseData.startTime) {
        // Try parsing as a real date first
        const parsed = new Date(caseData.startTime);
        if (!isNaN(parsed.getTime())) {
            timeStr = parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else {
            // Try extracting a time pattern like "10:00 PM" from the string
            const timeMatch = caseData.startTime.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
            if (timeMatch) {
                timeStr = timeMatch[1].trim();
            } else {
                // Try to extract descriptive time like "late evening", "midnight", etc.
                const descriptiveMatch = caseData.startTime.match(/(late\s+evening|early\s+morning|midnight|dawn|dusk|noon|midday|evening|morning|afternoon|night)/i);
                if (descriptiveMatch) {
                    timeStr = descriptiveMatch[1].charAt(0).toUpperCase() + descriptiveMatch[1].slice(1);
                }
            }
        }
    }

    // Find the latest time among all OTHER dayOffset 0 events in initialTimeline
    const broughtInPatterns = /brought in|gathered.*for.*question|assembled.*for.*interview|arrive.*for.*question|called in.*for.*question/i;
    let latestMinutes = -1;
    for (const entry of caseData.initialTimeline) {
        if ((entry.dayOffset ?? 0) !== 0) continue;
        if (broughtInPatterns.test(entry.activity || '')) continue; // skip existing brought-in entries
        const mins = parseTime12h(entry.time);
        if (mins !== null && mins > latestMinutes) {
            latestMinutes = mins;
        }
    }

    // Ensure brought-in time is AFTER all other dayOffset 0 events
    const broughtInMinutes = parseTime12h(timeStr);
    if (latestMinutes >= 0) {
        if (broughtInMinutes === null || broughtInMinutes <= latestMinutes) {
            // The extracted time is earlier than or equal to existing events — shift forward
            timeStr = formatTime(Math.min(latestMinutes + 30, 23 * 60 + 59));
        }
    }

    // If we still don't have a parseable time, use a sensible fallback
    if (!timeStr) {
        timeStr = latestMinutes >= 0 ? formatTime(Math.min(latestMinutes + 30, 23 * 60 + 59)) : 'Late Evening';
    }

    // Check if a "brought in" entry already exists
    const existingIdx = caseData.initialTimeline.findIndex((e: any) =>
        broughtInPatterns.test(e.activity || '')
    );

    if (existingIdx !== -1) {
        // Entry exists — ensure it's last, has correct day/dayOffset, and time is correct
        const entry = caseData.initialTimeline[existingIdx];
        entry.day = 'Today';
        entry.dayOffset = 0;
        entry.time = timeStr;
        // Move to end if not already last
        if (existingIdx !== caseData.initialTimeline.length - 1) {
            caseData.initialTimeline.splice(existingIdx, 1);
            caseData.initialTimeline.push(entry);
        }
    } else {
        // No entry exists — add one
        caseData.initialTimeline.push({
            time: timeStr,
            activity: 'All persons of interest brought in for questioning by detective',
            day: 'Today',
            dayOffset: 0
        });
    }

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
- Every timeline entry has FOUR separate fields: 'time', 'activity', 'day', and 'dayOffset'.
- The 'time' field must contain ONLY the timestamp (e.g. "8:00 PM", "11:30 AM"). Do NOT put the activity description in the time field.
- The 'activity' field must contain the description of what happened (e.g. "Arrived at the lab to begin shift").
- **DAY LABELS — RELATIVE TO THE INVESTIGATION, NOT THE CRIME (CRITICAL):**
  The 'day' field labels when an event occurred relative to TODAY — the day the detective is questioning people. NOT relative to when the crime happened.
  - dayOffset 0 = "Today" (the day of questioning — this is always the anchor point)
  - dayOffset -1 = "Yesterday"
  - dayOffset -2 = "2 Days Ago"
  - dayOffset -7 = "Last Week"
  - dayOffset -30 = "Last Month"
  - dayOffset -365 = "1 Year Ago"
  - Use natural, conversational labels. Negative numbers = past.
  - The crime itself may have happened today, yesterday, last week, or even years ago — the day labels should reflect when events occurred relative to the day of questioning, NOT relative to the crime.
  - Example: If the crime happened yesterday and the detective is questioning people today, then crime events should have day="Yesterday" (dayOffset=-1), and anything the suspect did today should have day="Today" (dayOffset=0).
- **MIGRATION — RENAME OLD LABELS:** If any existing timeline entries use old crime-relative labels like "Day of the Crime", "1 Day Before", "2 Days Before", "1 Week Before", etc., you MUST convert them to investigation-relative labels:
  - "Day of the Crime" → determine when the crime occurred relative to the investigation's startTime, then use the appropriate label (e.g. "Today" if same day, "Yesterday" if day before, etc.)
  - "1 Day Before" → one day before the crime, which is two days before today if the crime was yesterday, etc.
  - Use the case's startTime and description to infer the correct mapping.
  - When in doubt, assume the crime happened the same day as the investigation (dayOffset 0 = "Today" for crime events).
- The 'dayOffset' field is a NUMBER used for sorting. Must be consistent with the 'day' label.
- **12-HOUR FORMAT ONLY:** ALL times MUST use 12-hour AM/PM format. NEVER use 24-hour military time (e.g. "20:00", "23:30"). Always write "8:00 PM", not "20:00".
- WRONG: { time: "8:00 PM: Arrived at the lab", activity: "", day: "", dayOffset: 0 }
- WRONG: { time: "20:00", activity: "Arrived at the lab", day: "Today", dayOffset: 0 }
- WRONG: { day: "Day of the Crime", dayOffset: 0 } ← OLD FORMAT, do not use
- CORRECT: { time: "8:00 PM", activity: "Arrived at the lab to begin shift", day: "Today", dayOffset: 0 }
- CORRECT: { time: "3:00 PM", activity: "Had a heated argument with the victim", day: "Yesterday", dayOffset: -1 }
- CORRECT: { time: "10:00 AM", activity: "Signed the insurance policy", day: "2 Weeks Ago", dayOffset: -14 }
- **MULTI-DAY TIMELINES:** Cases SHOULD span multiple days when it makes narrative sense. Suspects' timelines should include events from before today that establish motive, opportunity, and alibi. The initialTimeline should include key events leading up to discovery.
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
- If the existing initialTimeline contains entries that reveal guilt, REWRITE them to be neutral.
- **FINAL ENTRY — SUSPECTS BROUGHT IN (MANDATORY):**
  The LAST entry in the initialTimeline must ALWAYS be about the suspects/persons of interest being brought in for questioning by the detective. This entry:
  * Must have dayOffset 0 and day "Today" — this is the day of questioning, and it should be the chronologically latest event on the timeline
  * Its 'time' field should match (or be derived from) the case's 'startTime' field. Extract just the time portion (e.g. if startTime is "Friday, March 14, 1924 at 10:00 PM", use "10:00 PM"). If startTime is a non-standard format (e.g. "5 ABY, late evening"), use the most reasonable time you can infer, or just "Late Evening".
  * Its 'day' field should be "Today" with dayOffset 0 (this IS the day of questioning)
  * Its 'activity' should describe the suspects/persons of interest being assembled for questioning (e.g. "All persons of interest brought in for questioning by Detective", "Suspects gathered at the station for interviews")
  * If this entry already exists, ensure it is LAST and its time matches the startTime. If it doesn't exist, ADD it.`,

    /** Naming constraints — used in generation and edit (when changing themes) */
    NAMING_RULES: `**NAMING RULES:**
- **STRICT CONSTRAINT:** Do NOT use "cool", "edgy", or "YA Novel" names unless explicitly requested by the user prompt.
- **BANNED NAMES:** Jarek, Zara, Vane, Kael, Rian, Elias, Silas, Elara, Lyra, Orion, Nova, Zephyr, Thorne, Nyx, Jax, Kai, Luna, Raven, Shadow, Talon, Blaze.
- **PREFERRED STYLE:** Use grounded, realistic, mundane names suitable for a gritty police report. (e.g. Frank, Martha, David, Sarah, Robert, Chen, Rodriguez, Kowalski, Smith, Jones, Patel, Nguyen).
- If the setting is historical or specific (e.g. 1920s), use period-accurate names.`,

    /** Victim generation rule — used in generation and edit */
    VICTIM_GENERATION: `**VICTIM GENERATION RULE:**
If the crime involves a death or a body (e.g. Murder, Homicide), YOU MUST GENERATE "THE VICTIM" AS A SUSPECT CARD AND SET hasVictim to true.
- Name: A realistic full name for the victim.
- Role: "The Victim".
- **isDeceased: true**.
- hiddenEvidence: Must contain 2-3 physical clues found on the body (e.g. "Bruise on wrist", "Watch frozen at 9pm", "Pocket lint").
- Alibi/Motive: Set to "N/A (Deceased)".
- Bio: Description of the body's state and their life before death.
If the crime does NOT involve a death or a body (e.g. Theft, Fraud, Arson, Espionage), set hasVictim to false. Do NOT generate a deceased suspect card.`,

    /** Suspect profile requirements — used in generation and consistency */
    SUSPECT_PROFILES: `**SUSPECT PROFILE REQUIREMENTS:**
- GENDER: Explicitly state Male, Female, or Non-binary.
- BIO: **PUBLIC PROFILE ONLY — SPOILER-FREE** (see BIO SPOILER PROTECTION rules below).
- SECRET: The hidden truth they are trying to hide.
- ALIBI: Where they were, who with, and is it true?
- RELATIONSHIPS: **MANDATORY**:
  1. If hasVictim is true AND the suspect is alive, they MUST have an entry for "The Victim" and every other alive suspect.
  2. If hasVictim is true AND the suspect is the victim, they MUST have an entry for every alive suspect by name.
  3. If hasVictim is false (e.g. theft, fraud, arson with no body), suspects should NOT have a "The Victim" relationship entry. They should only have entries for other alive suspects.
  4. **CONTEXTUAL**: If the crime is Theft/Larceny, include a relationship to the "Owner" or "Target" if they are not a suspect.
  *INSTRUCTION*: Descriptions must be detailed (2-3 sentences).
- KNOWN FACTS: 2-3 specific facts they know about the crime.
- MOTIVE: A clear reason they might be suspected.
- TIMELINE: A step-by-step list of their movements (at least 3 entries). Each entry has FOUR fields:
  * 'time': ONLY the timestamp (e.g. "8:00 PM"). Do NOT include the activity here.
  * 'activity': The description of what happened (e.g. "Arrived at the restaurant for dinner").
  * 'day': Which day relative to the investigation (e.g. "Today", "Yesterday", "2 Days Ago"). Must be a human-readable label. "Today" = the day of questioning.
  * 'dayOffset': Numeric offset for sorting (0 = today, -1 = yesterday, -2 = 2 days ago, etc.).
  The timeline SHOULD span multiple days when relevant — include events from days before that establish motive or opportunity.
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

    /** Start time alignment with timeline — used in generation, consistency, and edit */
    START_TIME_ALIGNMENT: `**START TIME — TIMELINE ALIGNMENT (CRITICAL):**
- The 'startTime' field is a human-readable string representing when the player begins their investigation (e.g. "Friday, September 12, 1924 at 11:30 PM", "Late evening, the night of the gala", "October 3, 2030 at 9:00 PM").
- **ERA / SETTING AWARENESS (CRITICAL):** The startTime MUST match the time period, setting, and universe of the case. Infer the correct era and dating system from the case title, description, type, and suspect bios:
  * If the case is set in the 1920s → use a 1920s date (e.g. "Friday, March 14, 1924 at 10:00 PM")
  * If the case is futuristic → use a future date (e.g. "November 22, 2150 at 11:00 PM")
  * If the case is contemporary → use a near-future date (e.g. "September 12, 2030 at 11:30 PM")
  * **FICTIONAL UNIVERSES:** If the case is set in a fictional universe with its own dating system, USE THAT SYSTEM:
    - Star Wars → use ABY/BBY dating (e.g. "5 ABY, late evening aboard the Corellian station")
    - Star Trek → use Stardates (e.g. "Stardate 47634.4, 2100 hours")
    - Fantasy settings → use the world's own calendar (e.g. "Third Age 3019, evening of March 15")
    - Any other fictional universe → adopt whatever dating convention fits that universe
  * NEVER default to the current real-world date unless the case is explicitly set in the present day.
- The startTime MUST be AFTER all events on the day of questioning (dayOffset: 0) in the initialTimeline and suspect timelines. The detective cannot arrive before the crime is discovered.
- Cross-reference the latest initialTimeline entry on today (dayOffset: 0). The startTime MUST be at least 30 minutes after this event.
- Cross-reference suspect timeline entries for today. The startTime should be after the crime window.
- If any timeline events today have times LATER than startTime, either:
  (a) Adjust the startTime to be after those events, OR
  (b) Move those events to earlier times if narratively appropriate.
- Choose a startTime that fits the case atmosphere: noir murders → late night; corporate crimes → evening; daytime incidents → afternoon.
- The startTime should be close enough to the crime that the trail is still warm.
- When outputting startTime, prefer a fully spelled out human-readable format appropriate to the universe rather than ISO format.`,

    /** Evidence description style — used in generation, consistency, and edit */
    EVIDENCE_DESCRIPTION_STYLE: `**WRITING STYLE RULES (CRITICAL — TWO DISTINCT RULES):**

**RULE 1 — EVIDENCE DESCRIPTIONS (Full Names Required):**
- Applies ONLY to 'description' fields on initialEvidence and hiddenEvidence items.
- These fields must NEVER use pronouns (he, she, they, him, her, his, hers, their, them).
- ALWAYS use the FULL NAME of the person being referenced.
- WRONG: "A letter found in his desk revealing he had been embezzling funds."
- CORRECT: "A letter found in Robert Chen's desk revealing Robert Chen had been embezzling funds."

**RULE 2 — ALL OTHER NARRATIVE FIELDS (Natural Prose Required):**
- Applies to: suspect relationship descriptions, suspect timeline activities, initialTimeline activities, bios, alibis, secrets, motive, witnessObservations, and knownFacts.
- These fields MUST be written in natural, flowing prose using pronouns (he, she, they, etc.) after the first mention of a name.
- Do NOT repeat a character's full name multiple times in the same field — use their name once, then switch to pronouns.
- WRONG (too many names): "Martha Rodriguez went to Martha Rodriguez's office. Martha Rodriguez locked the door behind Martha Rodriguez."
- CORRECT (natural): "Martha Rodriguez went to her office. She locked the door behind her."
- WRONG (robotic): "Robert Chen claims Robert Chen was at Robert Chen's apartment during the time of the murder."
- CORRECT (natural): "Robert Chen claims he was at his apartment during the time of the murder."
- If fixing existing text that overuses full names, rewrite it to sound natural by replacing repeated names with appropriate pronouns.`,
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
        hasVictim: { type: Type.BOOLEAN },
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
                    activity: { type: Type.STRING },
                    day: { type: Type.STRING },
                    dayOffset: { type: Type.NUMBER }
                },
                required: ["time", "activity", "day", "dayOffset"]
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
                    alibi: {
                        type: Type.OBJECT, properties: {
                            statement: { type: Type.STRING },
                            isTrue: { type: Type.BOOLEAN },
                            location: { type: Type.STRING },
                            witnesses: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }, required: ["statement", "isTrue", "location", "witnesses"]
                    },
                    relationships: {
                        type: Type.ARRAY, items: {
                            type: Type.OBJECT, properties: {
                                targetName: { type: Type.STRING },
                                type: { type: Type.STRING },
                                description: { type: Type.STRING }
                            }, required: ["targetName", "type", "description"]
                        }
                    },
                    timeline: {
                        type: Type.ARRAY, items: {
                            type: Type.OBJECT, properties: {
                                time: { type: Type.STRING },
                                activity: { type: Type.STRING },
                                day: { type: Type.STRING },
                                dayOffset: { type: Type.NUMBER }
                            }, required: ["time", "activity", "day", "dayOffset"]
                        }
                    },
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

export const checkCaseConsistency = async (caseData: CaseData, onProgress?: (msg: string) => void, baseline?: CaseData, editContext?: string): Promise<{ updatedCase: CaseData, report: any }> => {
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
       These changes are IMMUTABLE and MUST be respected as the EXACT ground truth.
       You MUST propagate these changes throughout the ENTIRE case narrative — update every reference, relationship, description, bio, alibi, motive, secret, timeline entry, evidence description, and witness observation to be consistent with these user-requested changes.
       DO NOT revert any of these. DO NOT suggest reverting them in the report.
       **CRITICAL: When a field value has been changed, the NEW value is COMPLETE and EXACT. Do NOT merge, blend, or combine parts of the old value with the new value. The new value REPLACES the old value entirely. For example, if a name was changed from "John Smith" to "Marco", the new name is "Marco" — NOT "Marco Smith".**
       
       USER CHANGES:
${userChangeLog}
` : `
    **0. CURRENT DATA IS AUTHORITATIVE:**
       The case JSON provided below represents the CURRENT, latest version of the case.
       All field values in this JSON are the source of truth. Do NOT change field values (names, descriptions, bios, etc.) unless there is an actual narrative inconsistency that must be fixed.
       Focus on fixing logical/narrative gaps, timeline conflicts, and structural issues — not on rewriting content that is already consistent.
`;

    // If this consistency check is running after an AI edit, include the user's original request
    const editContextSection = editContext ? `
    **IMPORTANT — EDIT CONTEXT (DO NOT REVERT INTENTIONAL CHANGES):**
       This case was JUST transformed by an AI edit with the following user request:
       "${editContext}"
       
       All changes made by that edit are INTENTIONAL and should be PRESERVED. Do NOT flag them as issues.
       For example, if the user asked to change the setting to a different time period, do NOT flag the startTime as "too far in the past".
       Your job is to ensure the EDITED case is internally consistent — not to undo the edit.
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
    ${editContextSection}
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
    
    9. ${PROMPT_RULES.START_TIME_ALIGNMENT}
    
    10. ${PROMPT_RULES.EVIDENCE_DESCRIPTION_STYLE}
    
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

        // CRITICAL: Preserve original case identity & metadata — AI only returns narrative fields
        hydratedCase.id = caseData.id;
        hydratedCase.authorId = caseData.authorId;
        hydratedCase.authorDisplayName = caseData.authorDisplayName;
        hydratedCase.version = caseData.version;
        hydratedCase.isUploaded = caseData.isUploaded;
        hydratedCase.isFeatured = caseData.isFeatured;
        hydratedCase.createdAt = caseData.createdAt;
        hydratedCase.difficulty = caseData.difficulty;
        // Prefer the AI's startTime if it returned one (it may have corrected alignment);
        // only fall back to original if AI returned nothing
        if (!hydratedCase.startTime && caseData.startTime) hydratedCase.startTime = caseData.startTime;
        if (!hydratedCase.heroImageUrl && caseData.heroImageUrl) hydratedCase.heroImageUrl = caseData.heroImageUrl;

        // Auto-compute hasVictim: if AI returned it, use it; otherwise derive from isDeceased suspects
        if (hydratedCase.hasVictim === undefined) {
            hydratedCase.hasVictim = hydratedCase.suspects?.some((s: any) => s.isDeceased) ?? false;
        }

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

        const finalData = ensureBroughtInEntry(enforceStartTimeAlignment(enforceSuspectSchema(enforceTimelines(enforceRelationships(hydratedCase)), caseData)));

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
      **CRITICAL: When a field value has been changed, the NEW value is COMPLETE and EXACT. Do NOT merge, blend, or combine parts of the old value with the new value. The new value REPLACES the old value entirely.**
      
      USER CHANGES:
${userChangeLog}
` : `
      **CURRENT DATA IS AUTHORITATIVE:**
      The case JSON provided below is the latest version. All field values are the source of truth. Only change values that need to change to fulfill the user's request.
`;

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

      11. ${PROMPT_RULES.START_TIME_ALIGNMENT}
           
      12. ${PROMPT_RULES.EVIDENCE_DESCRIPTION_STYLE}
      
      13. ${PROMPT_RULES.OUTPUT_FORMAT_WITH_REPORT}
      
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

        // CRITICAL: Preserve original case identity & metadata — AI only returns narrative fields
        hydratedCase.id = caseData.id;
        hydratedCase.authorId = caseData.authorId;
        hydratedCase.authorDisplayName = caseData.authorDisplayName;
        hydratedCase.version = caseData.version;
        hydratedCase.isUploaded = caseData.isUploaded;
        hydratedCase.isFeatured = caseData.isFeatured;
        hydratedCase.createdAt = caseData.createdAt;
        hydratedCase.difficulty = caseData.difficulty;
        // Prefer the AI's startTime if it returned one (it may have corrected alignment);
        // only fall back to original if AI returned nothing
        if (!hydratedCase.startTime && caseData.startTime) hydratedCase.startTime = caseData.startTime;

        // Auto-compute hasVictim: if AI returned it, use it; otherwise derive from isDeceased suspects
        if (hydratedCase.hasVictim === undefined) {
            hydratedCase.hasVictim = hydratedCase.suspects?.some((s: any) => s.isDeceased) ?? false;
        }

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

        const finalData = ensureBroughtInEntry(enforceStartTimeAlignment(enforceSuspectSchema(enforceTimelines(enforceRelationships(hydratedCase)), caseData)));

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
    ${PROMPT_RULES.START_TIME_ALIGNMENT}
    
    ${PROMPT_RULES.EVIDENCE_DESCRIPTION_STYLE}
    
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
                    hasVictim: { type: Type.BOOLEAN },
                    officer: {
                        type: Type.OBJECT, properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            gender: { type: Type.STRING },
                            role: { type: Type.STRING },
                            personality: { type: Type.STRING }
                        }, required: ["name", "gender", "role", "personality"]
                    },
                    partner: {
                        type: Type.OBJECT, properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            gender: { type: Type.STRING },
                            role: { type: Type.STRING },
                            personality: { type: Type.STRING }
                        }, required: ["name", "gender", "role", "personality"]
                    },
                    initialEvidence: {
                        type: Type.ARRAY, items: {
                            type: Type.OBJECT, properties: {
                                id: { type: Type.STRING },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING }
                            }, required: ["title", "description"]
                        }
                    },
                    initialTimeline: {
                        type: Type.ARRAY, items: {
                            type: Type.OBJECT, properties: {
                                time: { type: Type.STRING },
                                activity: { type: Type.STRING },
                                day: { type: Type.STRING },
                                dayOffset: { type: Type.NUMBER }
                            }, required: ["time", "activity", "day", "dayOffset"]
                        }
                    },
                    suspects: {
                        type: Type.ARRAY, items: {
                            type: Type.OBJECT, properties: {
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
                                alibi: {
                                    type: Type.OBJECT, properties: {
                                        statement: { type: Type.STRING },
                                        isTrue: { type: Type.BOOLEAN },
                                        location: { type: Type.STRING },
                                        witnesses: { type: Type.ARRAY, items: { type: Type.STRING } }
                                    }, required: ["statement", "isTrue", "location", "witnesses"]
                                },
                                relationships: {
                                    type: Type.ARRAY, items: {
                                        type: Type.OBJECT, properties: {
                                            targetName: { type: Type.STRING },
                                            type: { type: Type.STRING },
                                            description: { type: Type.STRING }
                                        }, required: ["targetName", "type", "description"]
                                    }
                                },
                                timeline: {
                                    type: Type.ARRAY, items: {
                                        type: Type.OBJECT, properties: {
                                            time: { type: Type.STRING },
                                            activity: { type: Type.STRING },
                                            day: { type: Type.STRING },
                                            dayOffset: { type: Type.NUMBER }
                                        }, required: ["time", "activity", "day", "dayOffset"]
                                    }
                                },
                                knownFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                                hiddenEvidence: {
                                    type: Type.ARRAY, items: {
                                        type: Type.OBJECT, properties: {
                                            id: { type: Type.STRING },
                                            title: { type: Type.STRING },
                                            description: { type: Type.STRING }
                                        }, required: ["title", "description"]
                                    }
                                }
                            }, required: ["name", "gender", "role", "bio", "personality", "secret", "isGuilty", "baseAggravation", "motive", "alibi", "relationships", "knownFacts", "hiddenEvidence", "timeline", "professionalBackground", "witnessObservations"]
                        }
                    }
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

    // Auto-compute hasVictim: if AI returned it, use it; otherwise derive from isDeceased suspects
    if (data.hasVictim === undefined) {
        data.hasVictim = (data.suspects || []).some((s: any) => s.isDeceased);
    }

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
    const finalData = ensureBroughtInEntry(enforceStartTimeAlignment(enforceSuspectSchema(enforceTimelines(enforceRelationships(data)))));
    return finalData as CaseData;
};
