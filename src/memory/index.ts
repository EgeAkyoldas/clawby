import { embed } from "./embeddings.js";
import { addMemory, searchMemories, getMemoryCount } from "./vector-store.js";
import { getCoreMemory } from "./core.js";
import { appendMemoryLog } from "./log.js";

/**
 * Store a text as a new memory.
 * Embeds the text, saves to vector store, and appends to log.
 */
export async function storeMemory(
  text: string,
  source: "user" | "auto" = "user"
): Promise<void> {
  const embedding = await embed(text);
  addMemory(text, embedding, source);
  appendMemoryLog(text, source);
  console.log(`  🧠 Memory stored (${source}): "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`);
}

/**
 * Recall the top-K most relevant memories for a query.
 * Returns formatted text snippets with relevance scores.
 */
export async function recallMemories(
  query: string,
  topK: number = 3
): Promise<Array<{ text: string; score: number; timestamp: string }>> {
  const queryEmbedding = await embed(query);
  const results = searchMemories(queryEmbedding, topK);

  // Filter out very low relevance matches
  return results
    .filter((r) => r.score > 0.3)
    .map((r) => ({
      text: r.text,
      score: r.score,
      timestamp: r.timestamp,
    }));
}

/**
 * Build a memory context block for injection into the system prompt.
 * Includes core memory + top recalled memories for the given query.
 */
export async function getMemoryContext(query: string): Promise<string> {
  const parts: string[] = [];

  // Core memory (always included if present)
  const core = getCoreMemory();
  if (core) {
    parts.push(`## Core Memory (stable preferences)\n${core}`);
  }

  // Recalled memories (top-3 relevant)
  const memories = await recallMemories(query);
  if (memories.length > 0) {
    const items = memories
      .map((m, i) => `${i + 1}. [${m.timestamp}] ${m.text}`)
      .join("\n");
    parts.push(`## Recalled Memories\n${items}`);
  }

  return parts.join("\n\n");
}

export { getCoreMemory, getMemoryCount };
