import { textToSpeech } from "./elevenlabs.js";

/**
 * Check if a message requests a voice reply.
 * Returns the cleaned message (trigger phrase removed) and whether voice was requested.
 */
export function parseVoiceReplyRequest(text: string): {
  wantsVoice: boolean;
  cleanedText: string;
} {
  // Case-insensitive match for "reply with voice" anywhere in the message
  const trigger = /reply with voice/i;
  const wantsVoice = trigger.test(text);

  // Strip the trigger phrase so the LLM doesn't see it
  const cleanedText = wantsVoice
    ? text.replace(trigger, "").replace(/\s{2,}/g, " ").trim()
    : text;

  return { wantsVoice, cleanedText };
}

/**
 * Generate speech from text using ElevenLabs.
 * Returns MP3 audio as a Buffer. No temp files created.
 */
export async function generateSpeech(text: string): Promise<Buffer> {
  return textToSpeech(text);
}

export { textToSpeech };
