import { config } from "./config.js";
import { bot } from "./bot.js";
import { initializeMcpServers, shutdownMcpServers, getConnectedServerCount } from "./mcp/client.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";

// ── Graceful Shutdown ───────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down...`);
  stopHeartbeat();
  bot.stop();
  await shutdownMcpServers();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// ── Start Bot ────────────────────────────────────────────
async function main() {
  // Initialize MCP servers if configured
  let mcpStatus = "disabled (no GOOGLE_CLIENT_ID)";
  if (config.mcpEnabled) {
    const count = await initializeMcpServers();
    mcpStatus = count > 0
      ? `enabled (${count} server(s) connected)`
      : "enabled (0 servers connected)";
  }

  console.log("🤖 Clawby is alive! Listening for messages...");
  console.log(`   Model: gemini-3-flash-preview`);
  console.log(`   Allowed users: ${config.allowedUserIds.join(", ")}`);
  console.log(
    `   🎙️ Voice: ${config.voiceEnabled ? (config.transcriptionMock ? "enabled (mock mode)" : "enabled (whisper)") : "disabled (no TRANSCRIPTION_API_KEY)"}`
  );
  console.log(
    `   🔊 TTS: ${config.ttsEnabled ? "enabled (elevenlabs)" : "disabled (no TTS_API_KEY)"}`
  );
  console.log(
    `   🧠 Memory: ${config.memoryEnabled ? (config.memoryMock ? "enabled (mock embeddings)" : "enabled (gemini embeddings)") : "disabled"}`
  );
  console.log(`   🔌 MCP: ${mcpStatus}`);
  console.log(
    `   💓 Heartbeat: ${config.heartbeatEnabled ? `enabled (${config.heartbeatCron})` : "disabled (HEARTBEAT_ENABLED=false)"}`
  );
  console.log(`   Mode: long-polling (no exposed ports)\n`);

  bot.start();
  startHeartbeat(bot);
}

main().catch((err) => {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
});
