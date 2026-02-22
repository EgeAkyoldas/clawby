import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const MEMORY_DIR = join(process.cwd(), "memory");
const STORE_PATH = join(MEMORY_DIR, "memories.json");

export interface MemoryEntry {
  id: string;
  text: string;
  embedding: number[];
  timestamp: string;
  source: "user" | "auto";
}

interface MemoryStore {
  version: 1;
  entries: MemoryEntry[];
}

function ensureDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadStore(): MemoryStore {
  ensureDir();
  if (!existsSync(STORE_PATH)) {
    return { version: 1, entries: [] };
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as MemoryStore;
  } catch {
    return { version: 1, entries: [] };
  }
}

function saveStore(store: MemoryStore): void {
  ensureDir();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Add a memory entry to the local vector store.
 */
export function addMemory(
  text: string,
  embedding: number[],
  source: "user" | "auto" = "user"
): MemoryEntry {
  const store = loadStore();

  const entry: MemoryEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    embedding,
    timestamp: new Date().toISOString(),
    source,
  };

  store.entries.push(entry);
  saveStore(store);

  return entry;
}

/**
 * Search for the top-K most relevant memories by cosine similarity.
 */
export function searchMemories(
  queryEmbedding: number[],
  topK: number = 3
): Array<MemoryEntry & { score: number }> {
  const store = loadStore();

  if (store.entries.length === 0) return [];

  const scored = store.entries.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Get total number of stored memories.
 */
export function getMemoryCount(): number {
  const store = loadStore();
  return store.entries.length;
}
