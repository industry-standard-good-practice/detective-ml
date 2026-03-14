/**
 * Centralized Gemini Model Configuration
 * 
 * Change the model strings here to switch models across the entire app.
 * Each key maps to a specific capability/use case.
 */

export const GEMINI_MODELS = {
  /** Used for case generation, consistency checks, and AI edits.
   *  Needs strong reasoning and structured JSON output. */
  CASE_ENGINE: "gemini-3.1-flash-lite-preview",

  /** Used for initial case generation from a user prompt.
   *  Needs creative writing + structured JSON output. */
  CASE_GENERATION: "gemini-3.1-pro-preview",

  /** Used for live interrogation chat, accusation evaluation, 
   *  and gameplay dialogue. Needs fast responses + tool use. */
  CHAT: "gemini-3.1-flash-lite-preview",

  /** Used for all image generation (portraits, evidence, emotions).
   *  Must support image output. */
  IMAGE: "gemini-2.5-flash-image",

  /** Used for text-to-speech voice generation.
   *  Must support audio output. */
  TTS: "gemini-2.5-flash-preview-tts",
} as const;
