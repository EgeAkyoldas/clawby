import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const MEMORY_DIR = join(process.cwd(), "memory");
const LOG_PATH = join(MEMORY_DIR, "memory_log.md");

/**
 * Append a timestamped entry to the memory log.
 * This is an append-only file for audit/review purposes.
 */
export function appendMemoryLog(
  text: string,
  source: "user" | "auto"
): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const entry = `- **[${timestamp}]** (${source}) ${text}\n`;

  appendFileSync(LOG_PATH, entry, "utf-8");
}
