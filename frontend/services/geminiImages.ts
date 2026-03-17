
import { Suspect, CaseData, Emotion, Evidence, SupportCharacter } from "../types";
import { getPixelArtUrl, getSuspectColorDescription } from "./gameHelpers";
import { ai } from "./geminiClient";
import { STYLE_REF_URL, PIXEL_ART_BASE, INSTRUCTION_NEW_CHAR, INSTRUCTION_PRESERVE_CHAR, INSTRUCTION_RELATED_EVIDENCE, getStyleRefBase64 } from "./geminiStyles";
import { uploadImage } from "./firebase";
import { GEMINI_MODELS } from "./geminiModels";

// --- IMAGE GENERATION HELPER ---

const generateImageRaw = async (
    prompt: string, 
    aspectRatio: string = '1:1', 
    refImages: string[] = [],
    mode: 'create' | 'edit' | 'evidence' = 'create'
): Promise<string | null> => {
    try {
        const parts: any[] = [];
        
        // Add style references first
        for (const ref of refImages) {
            let base64Data = "";
            
            // Check if it matches our specific style ref URL (whether local or remote)
            if (ref === STYLE_REF_URL) {
                 const fetched = await getStyleRefBase64();
                 if (fetched) base64Data = fetched;
            } else if (ref.startsWith('data:')) {
                base64Data = ref.split(',')[1];
            } else if (ref.startsWith('http')) {
                // Fetch remote image via our backend proxy to avoid CORS
                try {
                    const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(ref)}`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    if (data.base64) {
                        base64Data = data.base64.split(',')[1];
                    }
                } catch (err) {
                    // Throw error as requested to prevent overwriting with wrong images
                    throw new Error(`Failed to fetch reference image: ${ref}`);
                }
            } else {
                 // Assume raw base64 or other string we can't easily handle, just treat as raw
                 base64Data = ref;
            }
            
            if (base64Data) {
                 parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } });
            } else {
                // If we have a ref but no data, we should fail
                throw new Error(`Reference image data missing for: ${ref}`);
            }
        }
        
        // Choose the correct instruction based on mode
        let instruction = INSTRUCTION_NEW_CHAR;
        if (mode === 'edit') instruction = INSTRUCTION_PRESERVE_CHAR;
        else if (mode === 'evidence') instruction = INSTRUCTION_RELATED_EVIDENCE;

        const fullPrompt = `${PIXEL_ART_BASE} ${instruction} ${prompt}`;
        
        parts.push({ text: fullPrompt });

        const res = await ai.models.generateContent({
            model: GEMINI_MODELS.IMAGE,
            contents: { parts },
            config: { imageConfig: { aspectRatio } }
        });

        // Check for safety blocks in the response
        const candidate = res.candidates?.[0];
        if (candidate) {
            const finishReason = candidate.finishReason as string;
            if (finishReason === 'SAFETY') {
                const ratings = (candidate as any).safetyRatings;
                const blocked = ratings?.filter((r: any) => r.blocked)?.map((r: any) => r.category?.replace('HARM_CATEGORY_', '')) || [];
                throw new Error(`Image blocked by safety filter${blocked.length ? ` (${blocked.join(', ')})` : ''}. Try adjusting the character description.`);
            }
            if (finishReason === 'RECITATION') {
                throw new Error('Image blocked: too similar to existing copyrighted content. Try a more unique description.');
            }
            if (finishReason === 'BLOCKLIST') {
                throw new Error('Image blocked: prompt contains restricted terms. Try rephrasing the character description.');
            }
        }

        // Check blockReason on promptFeedback
        const blockReason = (res as any).promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Prompt blocked by safety filter (${blockReason}). Try adjusting the character description.`);
        }

        const part = candidate?.content?.parts?.find(p => p.inlineData);
        if (part) {
             return part.inlineData.data;
        }

        // No image returned but no explicit error — may be a silent safety block
        throw new Error('No image was returned. This is usually caused by a safety filter. Try adjusting the character description or role.');
    } catch (e: any) {
        // Classify error by HTTP status or message
        const status = e?.status || e?.code || e?.httpStatus;
        const msg = e?.message || String(e);

        if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
            throw new Error('Rate limit exceeded — too many image requests. Wait a minute and try again.');
        }
        if (status === 401 || status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
            throw new Error('Authentication error — API key may be invalid or expired.');
        }
        if (status >= 500 || msg.includes('INTERNAL') || msg.includes('UNAVAILABLE')) {
            throw new Error('Google AI server error — the service is temporarily unavailable. Try again in a moment.');
        }
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NETWORK')) {
            throw new Error('Network error — check your internet connection and try again.');
        }
        // If the error already has a descriptive message from our checks above, re-throw as-is
        if (msg.startsWith('Image blocked') || msg.startsWith('Prompt blocked') || msg.startsWith('No image was returned') || msg.startsWith('Rate limit') || msg.startsWith('Reference image')) {
            throw e;
        }
        // Fallback: wrap with context
        console.error("Image Gen Failed", e);
        throw new Error(`Image generation failed: ${msg}`);
    }
    return null;
}

// --- HELPER: EMOTION GENERATION ---

const generateEmotionalVariants = async (
    neutralUrl: string,
    avatarSeed: number,
    onProgress?: (current: number, total: number) => void
): Promise<Record<string, string>> => {
    const newPortraits: Record<string, string> = { [Emotion.NEUTRAL]: neutralUrl };
    const colorDesc = getSuspectColorDescription(avatarSeed);
    
    // Only standard emotions, ignore forensic ones for living suspects
    const emotionsToGen = [
        Emotion.HAPPY, Emotion.ANGRY, Emotion.SAD, 
        Emotion.NERVOUS, Emotion.SURPRISED, Emotion.SLY, 
        Emotion.CONTENT, Emotion.DEFENSIVE, Emotion.ARROGANT
    ];
    
    let completed = 0;
    const total = emotionsToGen.length;

    const generateVariation = async (emo: Emotion) => {
        const prompt = `Keep the character exactly the same, but change expression to ${emo}. Keep solid ${colorDesc} background. No text, no words.`;
        // Mode 'edit' to PRESERVE IDENTITY of the neutral image
        const raw = await generateImageRaw(prompt, '3:4', [neutralUrl], 'edit');
        completed++;
        if (onProgress) onProgress(completed, total);
        return raw ? { emo, url: `data:image/png;base64,${raw}` } : null;
    };

    // Parallel batching to avoid rate limits (Batch size 3)
    const BATCH_SIZE = 3;
    for (let i = 0; i < emotionsToGen.length; i += BATCH_SIZE) {
        const batch = emotionsToGen.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(emo => generateVariation(emo)));
        results.forEach(r => {
            if (r) newPortraits[r.emo] = r.url;
        });
    }

    return newPortraits;
};

// --- HELPER: FORENSIC VARIANTS (DECEASED) ---

const generateForensicVariants = async (
    fullBodyUrl: string,
    suspect: Suspect,
    onProgress?: (current: number, total: number) => void
): Promise<Record<string, string>> => {
    const newPortraits: Record<string, string> = { [Emotion.NEUTRAL]: fullBodyUrl };
    
    // Forensic views
    const views = [Emotion.HEAD, Emotion.TORSO, Emotion.HANDS, Emotion.LEGS];
    let completed = 0;
    const total = views.length;
    
    const generateView = async (view: Emotion) => {
        let partPrompt = "";
        const commonNegative = "NEGATIVE PROMPT: open eyes, staring, pupils, iris, looking at camera, standing up, alive, smiling, text, UI.";
        
        switch (view) {
            case Emotion.HEAD: 
                partPrompt = "Extreme close up of the victim's head and face. Eyes are CLOSED. Eyelids shut. Lifeless expression. Pale skin. Forensic style."; 
                break;
            case Emotion.TORSO: 
                partPrompt = "Close up of the victim's chest, shirt, and pockets. No face visible. Clothing details. Forensic style."; 
                break;
            case Emotion.HANDS: 
                partPrompt = "Close up of the victim's hands and fingers. Pale skin. No face visible. Forensic style."; 
                break;
            case Emotion.LEGS: 
                partPrompt = "Close up of the victim's legs, pants, and shoes. No face visible. Forensic style."; 
                break;
        }
        
        const prompt = `ZOOM IN: ${partPrompt} Maintain consistent clothing colors and skin tone from reference. Pixel art. ${commonNegative}`;
        // Mode 'edit' to ensure it looks like the same body, just zoomed/cropped/redrawn
        const raw = await generateImageRaw(prompt, '3:4', [fullBodyUrl], 'edit');
        completed++;
        onProgress?.(completed, total);
        return raw ? { view, url: `data:image/png;base64,${raw}` } : null;
    };

    const BATCH_SIZE = 2;
    for (let i = 0; i < views.length; i += BATCH_SIZE) {
        const batch = views.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(v => generateView(v)));
        results.forEach(r => {
            if (r) newPortraits[r.view] = r.url;
        });
    }

    return newPortraits;
};

// --- PUBLIC IMAGE METHODS ---

export const generateEvidenceImage = async (
    evidence: Evidence, 
    caseId: string, 
    userId: string,
    refImage?: string
): Promise<string> => {
  if (!userId) throw new Error('[CRITICAL] generateEvidenceImage: userId is required');
  const refs = STYLE_REF_URL ? [STYLE_REF_URL] : [];
  if (refImage) refs.push(refImage);

  // Use 'evidence' mode if we have a reference image (e.g. victim)
  const mode = refImage ? 'evidence' : 'create';

  const b64 = await generateImageRaw(
      `Subject: ${evidence.title}, ${evidence.description}. Style: Forensic evidence photo taken with a harsh flash. High contrast, strong shadows, illuminated center, dark vignette edges. Gritty crime scene aesthetic. No text.`, 
      '1:1',
      refs,
      mode
  );
  if (!b64) return "";
  
  const url = await uploadImage(b64, `images/${userId}/cases/${caseId}/evidence/${evidence.id}.png`);
  return url;
};

export const getSuspectPortrait = async (suspect: Suspect, emotion: Emotion, aggravation: number, turnId?: string): Promise<string> => {
    // 1. Exact Match (Preferred) - Works for standard emotions AND Body Parts
    if (suspect.portraits && suspect.portraits[emotion] && suspect.portraits[emotion] !== "PLACEHOLDER") {
        return suspect.portraits[emotion];
    }

    // 2. Emotion Mapping for AI Generated Cases (Fallback if generation was partial)
    const isAiGenerated = suspect.portraits && suspect.portraits[Emotion.NEUTRAL] && !suspect.portraits[Emotion.NEUTRAL].includes('dicebear');
    
    if (isAiGenerated) {
        let mapped: Emotion | null = null;
        
        // Negative / Hostile -> ANGRY
        if (emotion === Emotion.DEFENSIVE || emotion === Emotion.ARROGANT) mapped = Emotion.ANGRY;
        
        // Positive / Smug -> HAPPY
        if (emotion === Emotion.SLY || emotion === Emotion.CONTENT) mapped = Emotion.HAPPY;
        
        // Low Energy / Distress -> NERVOUS
        if (emotion === Emotion.SAD) mapped = Emotion.NERVOUS;

        // If deceased, fallback any missing body part to Neutral (Full Body)
        if (suspect.isDeceased) mapped = Emotion.NEUTRAL;

        if (mapped && suspect.portraits && suspect.portraits[mapped]) {
             return suspect.portraits[mapped];
        }
    }

    // 3. Fallback to Neutral (if exact or mapped missing)
    if (suspect.portraits && suspect.portraits[Emotion.NEUTRAL] && suspect.portraits[Emotion.NEUTRAL] !== "PLACEHOLDER") {
         return suspect.portraits[Emotion.NEUTRAL];
    }

    // 4. Dicebear Procedural Fallback (for non-AI cases or total failure)
    let seed = suspect.avatarSeed;
    
    // Map dicebear seeds roughly to emotions
    if (emotion === Emotion.ANGRY || emotion === Emotion.DEFENSIVE || emotion === Emotion.ARROGANT || aggravation > 50) seed += 1;
    if (emotion === Emotion.HAPPY || emotion === Emotion.CONTENT || emotion === Emotion.SLY) seed += 2;
    if (emotion === Emotion.NERVOUS || emotion === Emotion.SAD || emotion === Emotion.SURPRISED) seed += 3;
    
    return getPixelArtUrl(seed, 300);
};

export const createImageFromPrompt = async (
    userPrompt: string,
    aspectRatio: string = '3:4'
): Promise<string | null> => {
    const refs = STYLE_REF_URL ? [STYLE_REF_URL] : [];
    const raw = await generateImageRaw(userPrompt, aspectRatio, refs, 'create');
    return raw ? `data:image/png;base64,${raw}` : null;
};

export const editImageWithPrompt = async (
    baseImageBase64: string, 
    userPrompt: string, 
    aspectRatio: string = '3:4'
): Promise<string | null> => {
    const prompt = `[STRICT INSTRUCTION]: Edit the image provided. ${userPrompt}. Maintain the pixel art style and composition. No text, no words.`;
    const raw = await generateImageRaw(prompt, aspectRatio, [baseImageBase64], 'edit');
    return raw ? `data:image/png;base64,${raw}` : null;
};

export const generateEmotionalVariantsFromBase = async (
    neutralBase64: string,
    suspect: Suspect | SupportCharacter,
    caseId: string,
    userId: string,
    onProgress?: (current: number, total: number) => void
): Promise<Record<string, string>> => {
    const emotionPortraits = await generateEmotionalVariants(neutralBase64, suspect.avatarSeed, onProgress);
    
    // Upload all emotional variants
    // Note: uploadImage handles cases where neutralBase64 is already a URL
    const folder = (suspect as any).isGuilty !== undefined ? 'suspects' : 'support';
    const uploadedPortraits: Record<string, string> = {
        [Emotion.NEUTRAL]: await uploadImage(neutralBase64, `images/${userId}/cases/${caseId}/${folder}/${suspect.id}/neutral.png`)
    };
    
    for (const [emo, b64] of Object.entries(emotionPortraits)) {
        // Skip neutral as we just uploaded it above
        if (emo === Emotion.NEUTRAL) continue;
        uploadedPortraits[emo] = await uploadImage(b64, `images/${userId}/cases/${caseId}/${folder}/${suspect.id}/${emo}.png`);
    }

    return uploadedPortraits;
};

export const generateSuspectFromUpload = async (suspect: Suspect, userImageBase64: string, caseId: string, userId: string): Promise<Suspect> => {
    if (!userId) throw new Error('[CRITICAL] generateSuspectFromUpload: userId is required');
    console.log(`[DEBUG] generateSuspectFromUpload: Starting for ${suspect.name}`);
    const colorDesc = getSuspectColorDescription(suspect.avatarSeed);

    // 1. Convert User Photo -> Pixel Art Neutral
    // We use the 'create' mode but pass the user image as reference to guide the structure/content
    const conversionPrompt = `
      [STRICT INSTRUCTION]: Convert the person in the provided reference image into a 16-bit pixel art character.
      Maintain their exact facial features, hair style, glasses/accessories, gender, and likeness.
      Output Style: ${PIXEL_ART_BASE}
      Composition: Front-facing mugshot, head and shoulders.
      Background: Solid ${colorDesc} background.
      No text, no UI elements.
    `;

    let neutralRaw: string | null = null;
    try {
        const parts = [
            { inlineData: { mimeType: 'image/png', data: userImageBase64.split(',')[1] } },
            { text: conversionPrompt }
        ];
        const res = await ai.models.generateContent({
            model: GEMINI_MODELS.IMAGE,
            contents: { parts },
            config: { imageConfig: { aspectRatio: '3:4' } }
        });
        const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part) neutralRaw = part.inlineData.data;
    } catch(e) {
        console.error("Upload conversion failed", e);
        return suspect;
    }

    if (!neutralRaw) throw new Error("Failed to convert uploaded image to pixel art.");

    const neutralBase64 = `data:image/png;base64,${neutralRaw}`;
    const neutralUrl = await uploadImage(neutralBase64, `images/${userId}/cases/${caseId}/suspects/${suspect.id}/neutral.png`);
    
    // 2. Generate Emotions based on the new Pixel Art Neutral
    // Note: Deceased handling for upload is not prioritized here yet, assuming upload = living suspect for now.
    const emotionPortraits = await generateEmotionalVariants(neutralBase64, suspect.avatarSeed);
    
    // Upload all emotional variants
    const uploadedPortraits: Record<string, string> = {
        [Emotion.NEUTRAL]: neutralUrl
    };
    for (const [emo, b64] of Object.entries(emotionPortraits)) {
        if (emo === Emotion.NEUTRAL) continue;
        uploadedPortraits[emo] = await uploadImage(b64, `images/${userId}/cases/${caseId}/suspects/${suspect.id}/${emo}.png`);
    }

    return { ...suspect, portraits: uploadedPortraits };
};

export const regenerateSingleSuspect = async (
    suspect: Suspect | SupportCharacter, 
    caseId: string, 
    userId: string, 
    theme: string = "Noir",
    onProgress?: (message: string) => void
): Promise<Suspect | SupportCharacter> => {
    if (!userId) throw new Error('[CRITICAL] regenerateSingleSuspect: userId is required');
    console.log(`[DEBUG] regenerateSingleSuspect: Starting for ${suspect.name} (Theme: ${theme})`);
    const colorDesc = getSuspectColorDescription(suspect.avatarSeed);
    const isSuspect = (suspect as any).isGuilty !== undefined;
    const folder = isSuspect ? 'suspects' : 'support';
    
    // Differentiate prompt for Deceased vs Living
    let basePrompt = "";
    if (isSuspect && (suspect as Suspect).isDeceased) {
        const s = suspect as Suspect;
        basePrompt = `
          Subject: Crime scene photo of a deceased body. ${s.gender}. Role: The Victim.
          Theme: ${theme}.
          Visual cues: ${s.physicalDescription || "Lying on ground, lifeless"}.
          Condition: Deceased, pale, eyes closed tightly.
          Background: Crime scene floor/ground.
          Composition: Wide shot, full body or upper body.
          NEGATIVE PROMPT: Smiling, standing up, lively, open eyes, looking at camera, text, UI, split screen.
        `;
    } else {
        basePrompt = `
          Subject: Portrait of a single ${suspect.gender} character. Role: ${suspect.role}.
          Theme: ${theme}.
          Visual cues: ${(suspect as any).physicalDescription || suspect.personality || "Detective style"}. 
          Expression: Neutral.
          Background: Solid ${colorDesc} background (Hex Code style flat color).
          Composition: Front-facing mugshot, head and shoulders.
          NEGATIVE PROMPT: Text, words, letters, UI, interface, HUD, border, frame, speech bubble, signature, watermark, multiple people, two faces, photo-realistic, blur, smooth shading.
        `;
    }
    
    onProgress?.("Generating base portrait...");
    const refs = STYLE_REF_URL ? [STYLE_REF_URL] : [];
    // Mode 'create' because we are making a NEW base character
    const neutralRaw = await generateImageRaw(basePrompt, '3:4', refs, 'create');
    if (!neutralRaw) throw new Error(`Failed to generate base portrait for ${suspect.name}`);

    onProgress?.("Uploading base portrait...");
    const neutralBase64 = `data:image/png;base64,${neutralRaw}`;
    const neutralUrl = await uploadImage(neutralBase64, `images/${userId}/cases/${caseId}/${folder}/${suspect.id}/neutral.png`);
    
    let emotionPortraits: Record<string, string> = {};
    if (isSuspect && (suspect as Suspect).isDeceased) {
        onProgress?.("Generating forensic views...");
        emotionPortraits = await generateForensicVariants(neutralBase64, suspect as Suspect, (current, total) => {
            onProgress?.(`Generating forensic views... (${current}/${total})`);
        });
    } else {
        onProgress?.("Generating emotional variants...");
        emotionPortraits = await generateEmotionalVariants(neutralBase64, suspect.avatarSeed, (current, total) => {
            onProgress?.(`Generating emotional variants... (${current}/${total})`);
        });
    }

    // Upload all emotional variants
    onProgress?.("Uploading variants...");
    const uploadedPortraits: Record<string, string> = {
        [Emotion.NEUTRAL]: neutralUrl
    };
    const entries = Object.entries(emotionPortraits);
    let uploaded = 0;
    for (const [emo, b64] of entries) {
        if (emo === Emotion.NEUTRAL) continue;
        uploadedPortraits[emo] = await uploadImage(b64, `images/${userId}/cases/${caseId}/${folder}/${suspect.id}/${emo}.png`);
        uploaded++;
        onProgress?.(`Uploading variants... (${uploaded}/${entries.length - 1})`);
    }

    // If deceased, also regenerate hidden evidence to match the new victim body
    if (isSuspect && (suspect as Suspect).isDeceased && (suspect as Suspect).hiddenEvidence) {
        const s = suspect as Suspect;
        for (let i = 0; i < s.hiddenEvidence.length; i++) {
            const ev = s.hiddenEvidence[i];
            onProgress?.(`Regenerating hidden evidence... (${i + 1}/${s.hiddenEvidence.length})`);
            try {
                const evUrl = await generateEvidenceImage(ev, caseId, userId, neutralBase64);
                if (evUrl) ev.imageUrl = evUrl;
            } catch (e) {
                console.error(`Failed to regenerate hidden evidence ${ev.id} for victim:`, e);
                throw e; // Re-throw to prevent overwriting suspect data with inconsistent images
            }
        }
    }

    onProgress?.("Complete!");
    return { ...suspect, portraits: uploadedPortraits };
};

export const pregenerateCaseImages = async (caseData: CaseData, onStatus: (msg: string) => void, userId: string) => {
    if (!userId) throw new Error('[CRITICAL] pregenerateCaseImages: userId is required');
    const styleRefs = STYLE_REF_URL ? [STYLE_REF_URL] : [];
    
    // Phase 1: Neutrals for All Suspects & Partner & Officer
    onStatus("Phase 1/4: Generating Character Profiles...");
    const neutralMap: Record<string, string> = {}; // id -> URL (Firebase)
    const base64Map: Record<string, string> = {}; // id -> base64 (Local)

    const characterTasks: Promise<void>[] = [];

    // 1a. Suspects
    (caseData.suspects || []).forEach(s => {
        characterTasks.push((async () => {
            const colorDesc = getSuspectColorDescription(s.avatarSeed);
            let prompt = "";
            
            if (s.isDeceased) {
                prompt = `
                  Subject: Crime scene photo of a deceased body. ${s.gender}. Role: The Victim.
                  Visual cues: ${s.physicalDescription || "Lying on ground, lifeless"}.
                  Condition: Deceased, pale, eyes closed tightly.
                  Background: Crime scene floor/ground.
                  Composition: Wide shot, full body or upper body.
                  NEGATIVE PROMPT: Smiling, standing up, lively, open eyes, looking at camera, text, UI, split screen.
                `;
            } else {
                prompt = `
                  Subject: Portrait of a single ${s.gender} character. Role: ${s.role}. 
                  Visual cues: ${s.physicalDescription || "Noir style"}. 
                  Expression: Neutral.
                  Background: Solid ${colorDesc} background.
                  Composition: Front-facing mugshot.
                  NEGATIVE PROMPT: Text, UI, border, letters, words, writing, signature, speech bubble, multiple characters, photo-realistic.
                `;
            }

            const b64 = await generateImageRaw(prompt, '3:4', styleRefs, 'create');
            if (b64) {
                const url = await uploadImage(b64, `images/${userId}/cases/${caseData.id}/suspects/${s.id}/neutral.png`);
                neutralMap[s.id] = url;
                base64Map[s.id] = `data:image/png;base64,${b64}`;
                s.portraits = s.portraits || {};
                s.portraits[Emotion.NEUTRAL] = url;
            }
        })());
    });

    // 1b. Partner (Junior Detective)
    if (caseData.partner) {
        characterTasks.push((async () => {
            const p = caseData.partner;
            const prompt = `Subject: Portrait of a ${p.gender} ${p.role} named ${p.name}. Theme: ${caseData.type}. Expression: Eager, helpful. Background: City street or tech lab. Composition: Front-facing mugshot. Pixel Art.`;
            const b64 = await generateImageRaw(prompt, '3:4', styleRefs, 'create');
            if (b64) {
                const url = await uploadImage(b64, `images/${userId}/cases/${caseData.id}/partner/neutral.png`);
                neutralMap['partner'] = url;
                base64Map['partner'] = `data:image/png;base64,${b64}`;
                p.portraits = p.portraits || {};
                p.portraits[Emotion.NEUTRAL] = url;
            }
        })());
    }

    // 1c. Officer (Chief)
    if (caseData.officer) {
        characterTasks.push((async () => {
            const o = caseData.officer;
            const prompt = `Subject: Portrait of a ${o.gender} ${o.role} named ${o.name}. Theme: ${caseData.type}. Expression: Stern, commanding. Background: Office or Command Center. Composition: Front-facing mugshot. Pixel Art.`;
            const b64 = await generateImageRaw(prompt, '3:4', styleRefs, 'create');
            if (b64) {
                const url = await uploadImage(b64, `images/${userId}/cases/${caseData.id}/officer.png`);
                o.portraits = o.portraits || {};
                o.portraits[Emotion.NEUTRAL] = url;
            }
        })());
    }

    await Promise.all(characterTasks);

    // Phase 2: Evidence (Initial + Hidden)
    onStatus("Phase 2/4: Generating Evidence Files...");
    
    const evidenceTasks: Promise<void>[] = [];

    // 2a. Initial Evidence
    (caseData.initialEvidence || []).forEach(ev => {
        evidenceTasks.push((async () => {
            const b64 = await generateImageRaw(
                `Subject: ${ev.title}, ${ev.description}. Style: Forensic evidence photo taken with a harsh flash. High contrast, strong shadows, illuminated center, dark vignette edges. Gritty crime scene aesthetic. No text.`, 
                '1:1', 
                styleRefs,
                'create'
            );
            if (b64) {
                const url = await uploadImage(b64, `images/${userId}/cases/${caseData.id}/evidence/${ev.id}.png`);
                ev.imageUrl = url;
            }
        })());
    });

    // 2b. Hidden Evidence (Using suspect as reference if available)
    (caseData.suspects || []).forEach(s => {
        const suspectRef = base64Map[s.id];
        (s.hiddenEvidence || []).forEach(ev => {
            evidenceTasks.push((async () => {
                const mode = (s.isDeceased && suspectRef) ? 'evidence' : 'create';
                const refs = suspectRef ? [...styleRefs, suspectRef] : styleRefs;

                const b64 = await generateImageRaw(
                    `Subject: ${ev.title}, ${ev.description}. Style: Forensic evidence photo taken with a harsh flash. High contrast, strong shadows, illuminated center, dark vignette edges. Gritty crime scene aesthetic. No text.`, 
                    '1:1', 
                    refs,
                    mode
                );
                if (b64) {
                    const url = await uploadImage(b64, `images/${userId}/cases/${caseData.id}/evidence/${ev.id}.png`);
                    ev.imageUrl = url;
                }
            })());
        });
    });

    await Promise.all(evidenceTasks);

    // Phase 3: Emotional OR Forensic Variants (Batched)
    
    interface VariantTask {
        targetId: string; // suspect.id or 'partner'
        emotion: Emotion;
        neutralUrl: string;
        type: 'suspect' | 'partner';
    }
    
    const variantTasks: VariantTask[] = [];
    
    // Living emotions
    const livingEmotions = [
        Emotion.HAPPY, Emotion.ANGRY, Emotion.SAD, 
        Emotion.NERVOUS, Emotion.SURPRISED, Emotion.SLY, 
        Emotion.CONTENT, Emotion.DEFENSIVE, Emotion.ARROGANT
    ];
    
    // Deceased forensic views
    const forensicViews = [
        Emotion.HEAD, Emotion.TORSO, Emotion.HANDS, Emotion.LEGS
    ];

    // Add Suspects Tasks
    (caseData.suspects || []).forEach(s => {
        const b64 = base64Map[s.id];
        if (b64) {
             const targetEmotions = s.isDeceased ? forensicViews : livingEmotions;
             targetEmotions.forEach(emo => {
                 variantTasks.push({ targetId: s.id, emotion: emo, neutralUrl: b64, type: 'suspect' });
             });
        }
    });

    // Add Partner Tasks (Always living)
    if (caseData.partner && base64Map['partner']) {
        livingEmotions.forEach(emo => {
            variantTasks.push({ targetId: 'partner', emotion: emo, neutralUrl: base64Map['partner'], type: 'partner' });
        });
    }

    // Batch Process Variants (4 concurrent requests)
    const BATCH_SIZE = 4;
    for (let i = 0; i < variantTasks.length; i += BATCH_SIZE) {
        const batch = variantTasks.slice(i, i + BATCH_SIZE);
        const progress = Math.round((i / variantTasks.length) * 100);
        onStatus(`Phase 3/4: Generating Variants (${progress}%)...`);
        
        await Promise.all(batch.map(async (task) => {
            let prompt = "";
            let colorDesc = "dark grey";
            
            const s = caseData.suspects.find(x => x.id === task.targetId);
            const isDeceased = s?.isDeceased;

            if (task.type === 'suspect' && s) {
                colorDesc = getSuspectColorDescription(s.avatarSeed);
            } else {
                colorDesc = "city street or tech lab";
            }
            
            if (isDeceased) {
                // Forensic Prompt logic
                let partPrompt = "";
                const commonNegative = "NEGATIVE PROMPT: open eyes, staring, pupils, iris, looking at camera, standing up, alive, smiling, text, UI.";
                switch (task.emotion) {
                    case Emotion.HEAD: 
                        partPrompt = "Extreme close up of the victim's head and face. Eyes are CLOSED. Eyelids shut. Lifeless. Forensic style."; 
                        break;
                    case Emotion.TORSO: 
                        partPrompt = "Close up of the victim's torso, chest and clothing. No face. Forensic style."; 
                        break;
                    case Emotion.HANDS: 
                        partPrompt = "Close up of the victim's hands. No face. Forensic style."; 
                        break;
                    case Emotion.LEGS: 
                        partPrompt = "Close up of the victim's legs and shoes. No face. Forensic style."; 
                        break;
                }
                prompt = `ZOOM IN: ${partPrompt} Maintain consistent clothing colors and skin tone from reference. Pixel art. ${commonNegative}`;
            } else {
                // Living Prompt logic
                prompt = `Keep the character exactly the same, but change expression to ${task.emotion}. Keep solid/consistent ${colorDesc} background. No text, no words.`;
            }
            
            // Variants use 'edit' mode to PRESERVE IDENTITY of the neutral image
            const b64 = await generateImageRaw(
                prompt, 
                '3:4', 
                [task.neutralUrl], 
                'edit'
            );
            
            if (b64) {
                const url = await uploadImage(b64, `images/${userId}/cases/${caseData.id}/${task.type === 'suspect' ? 'suspects' : 'partner'}/${task.targetId}/${task.emotion}.png`);
                if (task.type === 'suspect') {
                    if (s && s.portraits) {
                        s.portraits[task.emotion] = url;
                    }
                } else if (task.type === 'partner') {
                    const p = caseData.partner;
                    if (p && p.portraits) {
                        p.portraits[task.emotion] = url;
                    }
                }
            }
        }));
    }

    // Phase 4: Hero Image
    onStatus("Phase 4/4: Finalizing Case Profile...");
    const victim = caseData.suspects.find(s => s.isDeceased);
    if (victim?.portraits?.[Emotion.NEUTRAL]) {
        caseData.heroImageUrl = victim.portraits[Emotion.NEUTRAL];
    } else if (caseData.initialEvidence?.[0]?.imageUrl) {
        caseData.heroImageUrl = caseData.initialEvidence[0].imageUrl;
    }
    
    onStatus("Generation Complete.");
};
