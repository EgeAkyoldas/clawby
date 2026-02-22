import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const MEMORY_DIR = join(process.cwd(), "memory");
const CORE_PATH = join(MEMORY_DIR, "core_memory.md");

/**
 * Read the core memory file (user-editable stable preferences).
 * Returns empty string if file doesn't exist.
 */
export function getCoreMemory(): string {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
  if (!existsSync(CORE_PATH)) {
    return "";
  }
  try {
    return readFileSync(CORE_PATH, "utf-8").trim();
  } catch {
    return "";
  }
}
