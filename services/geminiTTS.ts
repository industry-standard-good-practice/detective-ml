
import { GoogleGenAI, Modality } from "@google/genai";
import { GEMINI_MODELS } from "./geminiModels";

const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export const generateTTS = async (text: string, voiceName: string): Promise<string | null> => {
  if (!process.env.GEMINI_API_KEY || voiceName === 'None') {
    if (voiceName === 'None') console.log("TTS skipped: Voice set to None");
    return null;
  }

  // Ensure we use a voice supported by Gemini TTS
  const validVoice = GEMINI_VOICES.includes(voiceName) ? voiceName : 'Kore';

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.TTS,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: validVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // Gemini TTS returns raw PCM 16-bit, 24kHz, Mono.
      // We need to add a WAV header for browser playback.
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const pcmData = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        pcmData[i] = binaryString.charCodeAt(i);
      }
      
      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * bitsPerSample / 8;
      const blockAlign = numChannels * bitsPerSample / 8;
      const dataSize = pcmData.length;
      
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
      wavData.set(pcmData, 44);
      
      const blob = new Blob([wavData], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
};
