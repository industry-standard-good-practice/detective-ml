
import { GoogleGenAI, Modality } from "@google/genai";
import { GEMINI_MODELS } from "./geminiModels";
import { registerPcmData } from "./audioPlayer";

export const generateTTS = async (text: string, voiceName: string): Promise<string | null> => {
  // Skip TTS if no voice selected, voice is "None", or no API key
  if (!voiceName || voiceName === 'None' || !process.env.GEMINI_API_KEY) {
    if (voiceName === 'None') console.log("TTS skipped: Voice set to None");
    return null;
  }


  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.TTS,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Gemini TTS returns raw PCM 16-bit, 24kHz, Mono.
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const pcmBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
      }
      
      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * bitsPerSample / 8;
      const blockAlign = numChannels * bitsPerSample / 8;
      const dataSize = pcmBytes.length;
      
      // Build WAV for blob URL (used as reference key)
      const wavHeader = new Uint8Array(44);
      const view = new DataView(wavHeader.buffer);
      
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);
      
      const wavData = new Uint8Array(44 + dataSize);
      wavData.set(wavHeader);
      wavData.set(pcmBytes, 44);
      
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);

      // Cache raw PCM as Int16Array for direct AudioBuffer creation.
      // This bypasses Safari's broken fetch() + decodeAudioData pipeline entirely.
      const pcmInt16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
      registerPcmData(blobUrl, pcmInt16, sampleRate);
      
      return blobUrl;
    }
    return null;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
};
