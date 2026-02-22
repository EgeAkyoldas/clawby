import type { Context } from "grammy";
import { config } from "../config.js";
import { downloadTelegramFile } from "../telegram/download.js";
import { transcribe } from "../transcription/index.js";
import { runAgentLoop } from "../agent/loop.js";

/**
 * Handle incoming voice messages:
 * 1. Download OGG from Telegram
 * 2. Transcribe to text
 * 3. Reply with the transcript
 * 4. Run agent loop on the transcript
 * 5. Reply with the AI response
 */
export async function handleVoiceMessage(ctx: Context): Promise<void> {
  const voice = ctx.message?.voice;
  if (!voice) return;

  const duration = voice.duration;
  const firstName = ctx.from?.first_name ?? "User";

  try {
    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    // Step 1: Download the voice file
    const audioBuffer = await downloadTelegramFile(
      voice.file_id,
      config.telegramBotToken
    );

    // Step 2: Transcribe
    const transcript = await transcribe(audioBuffer, duration);

    if (!transcript || transcript.trim().length === 0) {
      await ctx.reply(
        "🎙️ I received your voice message but couldn't extract any text. " +
          "Could you try again, perhaps speaking a bit louder or clearer?"
      );
      return;
    }

    // Step 3: Send the transcript back to the user
    await ctx.reply(`🎙️ *Transcript:*\n_${transcript}_`, {
      parse_mode: "Markdown",
    });

    // Step 4: Run agent loop on the transcribed text
    await ctx.replyWithChatAction("typing");
    const result = await runAgentLoop(transcript);

    // Log summary (no secrets)
    console.log(
      `🎙️ [${firstName}] Voice ${duration}s → "${transcript.slice(0, 50)}${transcript.length > 50 ? "..." : ""}" → ${result.toolCalls} tool call(s)`
    );

    // Step 5: Send AI response
    await ctx.reply(result.text, { parse_mode: "Markdown" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Voice handler error:", message);

    await ctx.reply(
      "⚠️ I had trouble processing your voice message. " +
        "Please try again, or send your message as text instead."
    );
  }
}
