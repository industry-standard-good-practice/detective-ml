
// --- STYLE CONSTANTS ---
export const STYLE_REF_URL = "assets/styleRef.png";

export const PIXEL_ART_BASE = "Style: High-quality 16-bit pixel art. Dithered shading. Limited color palette (VGA style). Sharp, distinct pixels. Retro point-and-click adventure game aesthetic. No blur, no anti-aliasing.";

export const INSTRUCTION_NEW_CHAR = "[STRICT INSTRUCTION]: Use the provided reference image ONLY for guidance on the PIXEL ART STYLE and COMPOSITION (framing/layout). DO NOT look at the reference image for subject matter, character appearance, or demeanor. Generate a completely NEW subject based solely on the text prompt.";

export const INSTRUCTION_PRESERVE_CHAR = "[STRICT INSTRUCTION]: The provided image is the REFERENCE CHARACTER. You MUST generate THIS EXACT CHARACTER. Keep facial features, hair, clothing, accessories, and colors EXACTLY the same. Only change the facial expression as requested. Do not change the art style or background color.";

export const INSTRUCTION_RELATED_EVIDENCE = "[STRICT INSTRUCTION]: The provided reference image is the SUBJECT (e.g., the victim). You are generating a CLOSE-UP or DETAIL of a specific piece of evidence RELATED to this subject. Maintain consistency with the subject's skin tone, clothing colors, and materials shown in the reference. The evidence should look like it belongs to or was found on the subject.";

export const getStyleRefBase64 = async (): Promise<string | null> => {
    // Legacy support alias if needed, though we should use specific instructions now.
    // This function remains unchanged for fetching the asset.
    let _styleRefCache: string | null = null;
    
    if (_styleRefCache) return _styleRefCache;
    if (!STYLE_REF_URL) return null;
    
    try {
        const response = await fetch(STYLE_REF_URL);
        if (!response.ok) {
            console.warn(`Failed to fetch style ref: ${response.status}`);
            return null;
        }
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                // Remove data URL prefix if present to get raw base64
                const base64 = res.split(',')[1];
                _styleRefCache = base64;
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Error fetching style reference image:", e);
        return null;
    }
};
