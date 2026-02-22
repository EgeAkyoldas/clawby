import { config } from "../config.js";
import { transcribeWhisper } from "./whisper.js";
import { transcribeMock } from "./mock.js";

/**
 * Transcribe audio to text.
 * Routes to Whisper (real) or Mock based on config.
 */
export async function transcribe(
  audioBuffer: Buffer,
  durationSeconds: number,
  filename: string = "voice.ogg"
): Promise<string> {
  if (config.transcriptionMock) {
    return transcribeMock(audioBuffer, durationSeconds);
  }
  return transcribeWhisper(audioBuffer, filename);
}
