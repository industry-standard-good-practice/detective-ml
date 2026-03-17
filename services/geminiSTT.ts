
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODELS } from "./geminiModels";

/**
 * Client-side Gemini Speech-to-Text
 * 
 * Uses MediaRecorder to capture audio, then sends it to Gemini's
 * multimodal API for transcription. This is the fallback for browsers
 * where the native SpeechRecognition API is not available (iOS Safari, PWA mode).
 */

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;

/** Check if native SpeechRecognition is available */
export const hasNativeSpeechRecognition = (): boolean => {
  const has = !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
  console.log('[STT] Native SpeechRecognition available:', has);
  return has;
};

/** Check if we can use the MediaRecorder fallback */
export const hasMediaRecorderFallback = (): boolean => {
  const hasRecorder = typeof MediaRecorder !== "undefined";
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const isSecure = window.isSecureContext;
  console.log('[STT] MediaRecorder fallback check:', {
    hasRecorder,
    hasGetUserMedia,
    isSecureContext: isSecure,
    mediaDevices: !!navigator.mediaDevices,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  });
  // On non-secure contexts (HTTP over LAN), mediaDevices may not exist
  // but we still return true if MediaRecorder exists — we'll handle errors in startFallbackListening
  return hasRecorder;
};

/** Start recording audio via MediaRecorder. Returns a promise that resolves with the transcript. */
export const startFallbackListening = (
  onStart: () => void,
  onEnd: () => void,
  onResult: (transcript: string) => void,
  onError: (msg: string) => void
): void => {
  // If already recording, stop and return
  if (activeRecorder && activeRecorder.state === "recording") {
    activeRecorder.stop();
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    onError("No API key available for speech recognition.");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // This typically happens on non-secure contexts (HTTP over LAN IP)
    if (!window.isSecureContext) {
      onError("Microphone requires HTTPS. Use localhost or enable HTTPS.");
    } else {
      onError("Microphone access not available in this browser.");
    }
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      activeStream = stream;

      // Pick a supported mime type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "audio/wav";

      const recorder = new MediaRecorder(stream, { mimeType });
      activeRecorder = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstart = () => {
        onStart();
        // Auto-stop after 10 seconds max (shorter = less memory on iOS)
        setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, 10000);
      };

      recorder.onstop = async () => {
        // Clean up the microphone stream immediately
        try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        activeStream = null;
        activeRecorder = null;

        if (chunks.length === 0) {
          onEnd();
          return;
        }

        try {
          const blob = new Blob(chunks, { type: mimeType });
          // Free chunk references immediately to reduce memory
          chunks.length = 0;

          // Safety: reject recordings over 1MB to prevent iOS memory crashes
          if (blob.size > 1024 * 1024) {
            console.warn("[STT] Recording too large:", blob.size, "bytes — skipping");
            onError("Recording too long. Try a shorter message.");
            onEnd();
            return;
          }

          // Convert blob to base64
          const base64 = await blobToBase64(blob);

          // Determine the MIME type string for the Gemini API
          const geminiMime = mimeType.split(";")[0]; // strip codec info

          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: GEMINI_MODELS.CHAT,
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: geminiMime,
                      data: base64,
                    },
                  },
                  {
                    text: "Transcribe the speech in this audio clip into text. Return ONLY the transcribed text, nothing else. No quotes, no labels, no explanations. If you cannot hear any speech or the audio is empty/silent, return exactly: [EMPTY]",
                  },
                ],
              },
            ],
          });

          const transcript = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

          if (transcript && transcript !== "[EMPTY]") {
            onResult(transcript);
          }
        } catch (err) {
          console.error("Gemini STT error:", err);
          onError("Transcription failed. Please try again.");
        } finally {
          onEnd();
        }
      };

      recorder.onerror = () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
        activeStream = null;
        activeRecorder = null;
        onError("Recording failed.");
        onEnd();
      };

      // Use timeslice to get data in smaller chunks (reduces peak memory)
      recorder.start(1000);
    })
    .catch((err) => {
      console.error("Microphone access error:", err);
      onError("Microphone access denied.");
      onEnd();
    });
};

/** Stop the active fallback recording (triggers transcription) */
export const stopFallbackListening = (): void => {
  if (activeRecorder && activeRecorder.state === "recording") {
    activeRecorder.stop();
  }
};

/** Convert Blob to base64 string (without the data URL prefix) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:...;base64," prefix
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
