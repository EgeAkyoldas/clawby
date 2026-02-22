import { Bot, InputFile } from "grammy";
import { config } from "./config.js";
import { runAgentLoop } from "./agent/loop.js";
import { handleVoiceMessage } from "./handlers/voice.js";
import { parseVoiceReplyRequest, generateSpeech } from "./tts/index.js";
import { storeMemory, recallMemories, getMemoryCount } from "./memory/index.js";
import { triggerHeartbeat } from "./heartbeat.js";

export const bot = new Bot(config.telegramBotToken);

// ── Allowlist Middleware ──────────────────────────────────
// Silently ignore messages from unauthorized users.
// This MUST be the first middleware registered.
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId || !config.allowedUserIds.includes(userId)) {
    // Silent drop — no reply, no log (avoid leaking info)
    return;
  }

  await next();
});

// ── /start Command ────────────────────────────────────────
bot.command("start", async (ctx) => {
  const memCount = getMemoryCount();
  await ctx.reply(
    "🤖 *Clawby online.*\n\n" +
      "I'm your personal AI assistant. Send me any message and I'll do my best to help.\n\n" +
      `🧠 Memories: ${memCount}\n` +
      "Commands: /remember, /recall\n\n" +
      "Try: _What time is it?_",
    { parse_mode: "Markdown" }
  );
});

// ── /remember Command ─────────────────────────────────────
bot.command("remember", async (ctx) => {
  const text = ctx.match?.toString().trim();
  if (!text) {
    await ctx.reply(
      "💡 Usage: `/remember Your fact or note here`\n\n" +
        "Example: `/remember I prefer dark mode and concise answers`",
      { parse_mode: "Markdown" }
    );
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");
    await storeMemory(text, "user");
    const count = getMemoryCount();
    await ctx.reply(`🧠 Remembered! (${count} total memories)`);
  } catch (err) {
    console.error("❌ Remember error:", err instanceof Error ? err.message : err);
    await ctx.reply("⚠️ Failed to store memory. Please try again.");
  }
});

// ── /recall Command ───────────────────────────────────────
bot.command("recall", async (ctx) => {
  const query = ctx.match?.toString().trim();
  if (!query) {
    await ctx.reply(
      "💡 Usage: `/recall your search query`\n\n" +
        "Example: `/recall what do I prefer?`",
      { parse_mode: "Markdown" }
    );
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");
    const memories = await recallMemories(query);

    if (memories.length === 0) {
      await ctx.reply("🧠 No relevant memories found.");
      return;
    }

    const lines = memories.map(
      (m, i) => `${i + 1}. _(${(m.score * 100).toFixed(0)}%)_ ${m.text}`
    );
    await ctx.reply(
      `🧠 *Recalled ${memories.length} memory(s):*\n\n${lines.join("\n")}`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("❌ Recall error:", err instanceof Error ? err.message : err);
    await ctx.reply("⚠️ Failed to recall memories. Please try again.");
  }
});

// ── /heartbeat_test Command ───────────────────────────────
bot.command("heartbeat_test", async (ctx) => {
  await ctx.reply("💓 Triggering heartbeat...");
  await triggerHeartbeat(bot);
});

// ── Text Message Handler ─────────────────────────────────
bot.on("message:text", async (ctx) => {
  const userText = ctx.message.text;

  // Skip if it's a command (already handled above)
  if (userText.startsWith("/")) return;

  try {
    // Check if user wants a voice reply
    const { wantsVoice, cleanedText } = parseVoiceReplyRequest(userText);
    const messageForAgent = cleanedText || userText;

    // Show "typing..." indicator
    await ctx.replyWithChatAction("typing");

    const result = await runAgentLoop(messageForAgent);

    // Log summary (no secrets)
    console.log(
      `💬 [${ctx.from.first_name}] "${messageForAgent.slice(0, 50)}${messageForAgent.length > 50 ? "..." : ""}" → ${result.toolCalls} tool call(s)${wantsVoice ? " 🔊" : ""}`
    );

    // Always send the text reply
    await ctx.reply(result.text, { parse_mode: "Markdown" });

    // Send any generated images as photos
    if (result.images?.length) {
      for (const img of result.images) {
        try {
          const buffer = Buffer.from(img.data, "base64");
          await ctx.replyWithPhoto(new InputFile(buffer, `image.${img.mimeType.split("/")[1] || "png"}`), {
            caption: img.caption?.slice(0, 1024),
          });
        } catch (imgErr) {
          console.error("❌ Image send error:", imgErr instanceof Error ? imgErr.message : imgErr);
          await ctx.reply("⚠️ Generated image but failed to send it.");
        }
      }
    }

    // If voice requested and TTS is enabled, also send a voice note
    if (wantsVoice && config.ttsEnabled) {
      try {
        await ctx.replyWithChatAction("record_voice");
        const audioBuffer = await generateSpeech(result.text);
        await ctx.replyWithVoice(new InputFile(audioBuffer, "reply.mp3"));
      } catch (ttsErr) {
        console.error("❌ TTS error:", ttsErr instanceof Error ? ttsErr.message : ttsErr);
        await ctx.reply("⚠️ Voice reply failed. Text response was sent above.");
      }
    } else if (wantsVoice && !config.ttsEnabled) {
      await ctx.reply("🔇 Voice replies are not enabled. Set TTS_API_KEY to enable.");
    }
  } catch (err) {
    console.error("❌ Agent error:", err instanceof Error ? err.message : err);
    await ctx.reply("⚠️ Something went wrong. Please try again.");
  }
});

// ── Voice Message Handler ─────────────────────────────────
if (config.voiceEnabled) {
  bot.on("message:voice", async (ctx) => {
    await handleVoiceMessage(ctx);
  });
}

// ── Error Handler ─────────────────────────────────────────
bot.catch((err) => {
  console.error("❌ Bot error:", err.message);
});
