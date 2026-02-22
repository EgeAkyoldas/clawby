import OpenAI, { toFile } from "openai";
import { config } from "../config.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!config.transcriptionApiKey) {
      throw new Error("TRANSCRIPTION_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: config.transcriptionApiKey });
  }
  return client;
}

/**
 * Transcribe audio using OpenAI Whisper.
 * Accepts raw OGG/Opus bytes (Telegram's voice format).
 */
export async function transcribeWhisper(
  audioBuffer: Buffer,
  filename: string = "voice.ogg"
): Promise<string> {
  const openai = getClient();

  // Convert Buffer to a format the OpenAI SDK accepts
  const file = await toFile(
    new Uint8Array(audioBuffer),
    filename,
    { type: "audio/ogg" }
  );

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });

  return transcription.text;
}
