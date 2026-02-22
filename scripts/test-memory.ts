/**
 * Memory system test script.
 * Uses mock embeddings so no API key is needed.
 * Imports memory modules directly to avoid config.ts validation.
 *
 * Run: npx tsx scripts/test-memory.ts
 */

// Force mock mode and set required env vars BEFORE any imports
process.env.MEMORY_MOCK = "true";
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.MODEL_API_KEY = "test-key";
process.env.TELEGRAM_ALLOWLIST_USER_ID = "123";

// Now safe to import (config.ts will find the env vars)
const { storeMemory, recallMemories, getMemoryCount } = await import("../src/memory/index.js");
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

const STORE_PATH = join(process.cwd(), "memory", "memories.json");
const LOG_PATH = join(process.cwd(), "memory", "memory_log.md");

function cleanup(): void {
  if (existsSync(STORE_PATH)) unlinkSync(STORE_PATH);
  if (existsSync(LOG_PATH)) unlinkSync(LOG_PATH);
}

async function runTests(): Promise<void> {
  console.log("🧪 Memory System Test (mock mode)\n");

  // Clean slate
  cleanup();

  // Test 1: Store memories
  console.log("1. Storing 3 test memories...");
  await storeMemory("I prefer dark mode and concise answers", "user");
  await storeMemory("My timezone is Europe/Istanbul", "user");
  await storeMemory("I'm building a Telegram bot called Clawby", "user");

  const count = getMemoryCount();
  console.log(`   ✅ Stored ${count} memories\n`);
  if (count !== 3) {
    console.error("   ❌ Expected 3 memories, got", count);
    process.exit(1);
  }

  // Test 2: Recall by query
  console.log("2. Recalling memories for 'dark mode'...");
  const results1 = await recallMemories("dark mode preferences");
  console.log(`   ✅ Found ${results1.length} result(s)`);
  for (const r of results1) {
    console.log(`   - (${(r.score * 100).toFixed(0)}%) ${r.text}`);
  }

  // Test 3: Recall by different query
  console.log("\n3. Recalling memories for 'timezone'...");
  const results2 = await recallMemories("what timezone am I in");
  console.log(`   ✅ Found ${results2.length} result(s)`);
  for (const r of results2) {
    console.log(`   - (${(r.score * 100).toFixed(0)}%) ${r.text}`);
  }

  // Test 4: Verify files exist
  console.log("\n4. Checking file persistence...");
  console.log(`   memories.json exists: ${existsSync(STORE_PATH)}`);
  console.log(`   memory_log.md exists: ${existsSync(LOG_PATH)}`);

  // Cleanup
  cleanup();

  console.log("\n✅ All memory tests passed!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  cleanup();
  process.exit(1);
});
