/**
 * iOS Safari-compatible audio player.
 * 
 * iOS Safari has the strictest audio policy of any browser:
 * - AudioContext.start() / Audio.play() MUST be called inside a user gesture
 * - Once you call play() on an Audio element inside a gesture, that element
 *   is "unlocked" and can be reused for subsequent plays without gestures
 * - Blob URLs don't work reliably for audio on Safari/WebKit
 * 
 * Strategy:
 * 1. On first user tap, create + play a silent Audio element to "unlock" it
 * 2. Cache raw PCM data from TTS generation (avoids blob URL issues)
 * 3. To play: convert PCM → WAV data URL, set src on unlocked element, play()
 */

// ---- Raw PCM Cache ----
interface PcmEntry {
  pcmData: Int16Array;
  sampleRate: number;
}
const pcmCache = new Map<string, PcmEntry>();

export function registerPcmData(blobUrl: string, pcmInt16: Int16Array, sampleRate: number): void {
  pcmCache.set(blobUrl, { pcmData: pcmInt16, sampleRate });
}

// ---- Warm Audio Element (iOS Safari unlock trick) ----
let warmAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

// Tiny silent WAV as data URL (44 bytes header + 2 bytes of silence)
const SILENT_WAV = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';

function unlockAudio(): void {
  if (audioUnlocked) return;
  
  try {
    if (!warmAudio) {
      warmAudio = new Audio();
      warmAudio.setAttribute('playsinline', '');
      warmAudio.setAttribute('webkit-playsinline', '');
    }
    warmAudio.src = SILENT_WAV;
    warmAudio.volume = 0.01;
    const p = warmAudio.play();
    if (p) {
      p.then(() => {
        audioUnlocked = true;
        console.log('[Audio] iOS audio unlocked via warm element');
      }).catch(() => {
        console.warn('[Audio] iOS audio unlock failed');
      });
    }
  } catch (e) {
    console.warn('[Audio] unlock error:', e);
  }

  // Also try AudioContext unlock
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctor) {
      const ctx = new Ctor();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume();
    }
  } catch { /* ignore */ }
}

// Auto-attach unlock on first user interaction
if (typeof window !== 'undefined') {
  const handler = () => {
    unlockAudio();
    window.removeEventListener('touchstart', handler, true);
    window.removeEventListener('touchend', handler, true);
    window.removeEventListener('click', handler, true);
    window.removeEventListener('keydown', handler, true);
  };
  window.addEventListener('touchstart', handler, true);
  window.addEventListener('touchend', handler, true);
  window.addEventListener('click', handler, true);
  window.addEventListener('keydown', handler, true);
}

// ---- Helper: PCM Int16 → WAV data URL ----
function pcmToWavDataUrl(pcmInt16: Int16Array, sampleRate: number): string {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const pcmBytes = new Uint8Array(pcmInt16.buffer, pcmInt16.byteOffset, pcmInt16.byteLength);
  const dataSize = pcmBytes.length;

  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);
  
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  w(36, 'data');
  view.setUint32(40, dataSize, true);
  wav.set(pcmBytes, 44);

  // Convert to base64 data URL
  let binary = '';
  for (let i = 0; i < wav.length; i++) {
    binary += String.fromCharCode(wav[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// ---- Playback ----

export interface AudioPlayback {
  stop: () => void;
  setVolume: (v: number) => void;
  finished: Promise<void>;
}

/**
 * Play audio from a blob URL.
 * Uses cached PCM → WAV data URL → pre-unlocked HTMLAudioElement.
 */
export async function playAudioFromUrl(blobUrl: string, volume: number = 1): Promise<AudioPlayback> {
  
  // Strategy 1: Use cached PCM data + warm Audio element (iOS Safari compatible)
  const cached = pcmCache.get(blobUrl);
  if (cached) {
    
    const dataUrl = pcmToWavDataUrl(cached.pcmData, cached.sampleRate);
    
    // Use the warm (pre-unlocked) audio element if available
    const audio = warmAudio || new Audio();
    audio.volume = volume;
    audio.src = dataUrl;
    
    const finished = new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = (e) => {
        console.error('[Audio] playback error:', e);
        resolve();
      };
    });

    try {
      await audio.play();
    } catch (e: any) {
      console.error('[Audio] play() failed:', e);
    }

    return {
      stop: () => { audio.pause(); audio.currentTime = 0; },
      setVolume: (v: number) => { audio.volume = v; },
      finished
    };
  }

  // Strategy 2: Direct blob URL with HTMLAudioElement — reuse warm element on iOS
  console.warn('[Audio] No PCM cache, using HTMLAudioElement fallback');
  const audio = warmAudio || new Audio();
  audio.src = blobUrl;
  audio.volume = volume;

  const finished = new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
  });

  try {
    await audio.play();
  } catch (e: any) {
    console.error('[Audio] fallback play failed:', e);
  }

  return {
    stop: () => { audio.pause(); audio.currentTime = 0; },
    setVolume: (v: number) => { audio.volume = v; },
    finished
  };
}
