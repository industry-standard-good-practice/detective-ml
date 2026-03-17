
/**
 * Speech-to-Text Utilities
 * 
 * On desktop: Uses native SpeechRecognition API (Chrome/Edge).
 * On iOS: Falls back to native keyboard dictation (🎙 button on keyboard).
 */

/** Check if native SpeechRecognition is available */
export const hasNativeSpeechRecognition = (): boolean => {
  const has = !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
  return has;
};
