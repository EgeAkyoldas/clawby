import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";

const WIKIPEDIA_API = "https://en.wikipedia.org/api/rest_v1";

async function searchWikipedia(query: string): Promise<string> {
  const url = `${WIKIPEDIA_API}/page/summary/${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AgentClaw/1.0 (Telegram bot)" },
  });

  if (res.status === 404) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "AgentClaw/1.0 (Telegram bot)" },
    });
    const searchData = await searchRes.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
    const results = searchData.query?.search || [];
    if (results.length === 0) return JSON.stringify({ error: "No results found" });
    return JSON.stringify(results.map((r) => ({
      title: r.title,
      snippet: r.snippet.replace(/<[^>]*>/g, ""),
    })));
  }

  const data = await res.json() as { title?: string; extract?: string; description?: string; content_urls?: { desktop?: { page?: string } } };
  return JSON.stringify({
    title: data.title,
    summary: data.extract,
    description: data.description,
    url: data.content_urls?.desktop?.page,
  });
}

export const wikipediaSearchTool: ToolDefinition = {
  declaration: {
    name: "wikipedia_search",
    description: "Search Wikipedia for information about a topic. Returns article summary or search results.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "The topic or term to search for" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchWikipedia(args.query as string),
};
