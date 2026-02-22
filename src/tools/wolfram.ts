import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

async function queryWolfram(query: string): Promise<string> {
  if (!config.wolframAppId) return JSON.stringify({ error: "WOLFRAM_APP_ID not configured" });
  const url = `https://api.wolframalpha.com/v1/result?i=${encodeURIComponent(query)}&appid=${config.wolframAppId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const fullUrl = `https://api.wolframalpha.com/v2/query?input=${encodeURIComponent(query)}&appid=${config.wolframAppId}&output=json&format=plaintext`;
    const fullRes = await fetch(fullUrl);
    if (!fullRes.ok) return JSON.stringify({ error: `Wolfram Alpha error: ${fullRes.status}` });
    const data = await fullRes.json() as {
      queryresult: { success: boolean; pods?: Array<{ title: string; subpods: Array<{ plaintext: string }> }> }
    };
    if (!data.queryresult.success) return JSON.stringify({ error: "Wolfram Alpha could not interpret the query" });
    const pods = (data.queryresult.pods || []).slice(0, 4);
    return JSON.stringify(pods.map((p) => ({
      title: p.title, result: p.subpods.map((s) => s.plaintext).filter(Boolean).join("\n"),
    })));
  }
  const answer = await res.text();
  return JSON.stringify({ answer });
}

export const wolframTool: ToolDefinition = {
  declaration: {
    name: "wolfram_alpha",
    description: "Query Wolfram Alpha for math, science, conversions, statistics, and computational answers.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "The question or computation (e.g. 'integrate x^2', '150 USD to TRY')" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => queryWolfram(args.query as string),
};
