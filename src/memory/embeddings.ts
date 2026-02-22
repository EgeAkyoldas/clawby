import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.modelApiKey);
  }
  return genAI;
}

/**
 * Generate a deterministic pseudo-random embedding for mock mode.
 * Uses a simple hash of the text to seed the values so that
 * identical inputs produce identical embeddings.
 */
function mockEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSION);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    hash = (hash * 16807 + 1) | 0;
    vec[i] = (hash & 0x7fffffff) / 0x7fffffff;
  }
  // Normalize to unit vector
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / magnitude);
}

/**
 * Embed text into a vector using Gemini's embedding model.
 * In mock mode, returns a deterministic pseudo-random vector.
 */
export async function embed(text: string): Promise<number[]> {
  if (config.memoryMock) {
    return mockEmbed(text);
  }

  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
