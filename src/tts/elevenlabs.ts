import { config } from "../config.js";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// Default voice: "Rachel" — a clear, natural-sounding voice.
// You can change this to any ElevenLabs voice ID.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/**
 * Convert text to speech using ElevenLabs API.
 * Returns raw audio bytes (MP3 format) as a Buffer.
 * No temp files — everything stays in memory.
 */
export async function textToSpeech(text: string): Promise<Buffer> {
  if (!config.ttsApiKey) {
    throw new Error("TTS_API_KEY is not set");
  }

  // Truncate very long text to avoid API limits (max ~5000 chars)
  const truncated = text.length > 4500 ? text.slice(0, 4500) + "…" : text;

  const response = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${DEFAULT_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.ttsApiKey,
      },
      body: JSON.stringify({
        text: truncated,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(
      `ElevenLabs TTS failed (${response.status}): ${errorText.slice(0, 200)}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
