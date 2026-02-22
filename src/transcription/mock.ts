/**
 * Mock transcription for local testing without an API key.
 * Returns a placeholder message with the voice duration.
 */
export async function transcribeMock(
  _audioBuffer: Buffer,
  durationSeconds: number
): Promise<string> {
  // Simulate a small delay like a real API call
  await new Promise((resolve) => setTimeout(resolve, 300));

  return `[Mock transcription of ${durationSeconds}s voice message — set TRANSCRIPTION_MOCK=false and provide TRANSCRIPTION_API_KEY for real transcription]`;
}
