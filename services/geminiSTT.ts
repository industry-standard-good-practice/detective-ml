
/**
 * Speech-to-Text via MediaRecorder + Server-side Gemini transcription
 * 
 * Uses MediaRecorder to capture audio, then sends the blob to the
 * /api/transcribe server endpoint for transcription. This avoids loading
 * the Gemini SDK in the browser, preventing iOS Safari memory crashes.
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

          // Send audio to server for transcription (avoids loading Gemini SDK on iOS)
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": mimeType },
            body: blob,
          });

          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }

          const data = await response.json();
          if (data.transcript) {
            onResult(data.transcript);
          }
        } catch (err) {
          console.error("STT error:", err);
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

