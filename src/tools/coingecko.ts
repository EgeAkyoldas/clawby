import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

async function getCryptoPrice(coinId: string, currency: string = "usd"): Promise<string> {
  const url = `${COINGECKO_API}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `CoinGecko API error: ${res.status}` });
  const data = await res.json();
  return JSON.stringify(data);
}

async function searchCrypto(query: string): Promise<string> {
  const url = `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `CoinGecko API error: ${res.status}` });
  const data = await res.json() as { coins?: Array<{ id: string; name: string; symbol: string; market_cap_rank: number }> };
  const coins = (data.coins || []).slice(0, 10);
  return JSON.stringify(coins);
}

export const cryptoPriceTool: ToolDefinition = {
  declaration: {
    name: "get_crypto_price",
    description: "Get current cryptocurrency price, 24h change, and market cap. Use coin IDs like 'bitcoin', 'ethereum', 'solana'.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        coin_id: { type: SchemaType.STRING, description: "CoinGecko coin ID (e.g. 'bitcoin', 'ethereum', 'dogecoin')" },
        currency: { type: SchemaType.STRING, description: "Target currency (default: 'usd'). Can be 'eur', 'try', 'gbp', etc." },
      },
      required: ["coin_id"],
    },
  },
  execute: async (args) => getCryptoPrice(args.coin_id as string, (args.currency as string) || "usd"),
};

export const cryptoSearchTool: ToolDefinition = {
  declaration: {
    name: "search_crypto",
    description: "Search for a cryptocurrency by name or symbol to find its CoinGecko ID.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Cryptocurrency name or symbol to search for" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchCrypto(args.query as string),
};
