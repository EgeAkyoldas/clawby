import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

async function convertCurrency(from: string, to: string, amount: number = 1): Promise<string> {
  if (!config.exchangerateApiKey) return JSON.stringify({ error: "EXCHANGERATE_API_KEY not configured" });
  const url = `https://v6.exchangerate-api.com/v6/${config.exchangerateApiKey}/pair/${from.toUpperCase()}/${to.toUpperCase()}/${amount}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `ExchangeRate API error: ${res.status}` });
  const data = await res.json() as {
    result: string; base_code: string; target_code: string;
    conversion_rate: number; conversion_result: number; time_last_update_utc: string;
  };
  if (data.result !== "success") return JSON.stringify({ error: `ExchangeRate error: ${data.result}` });
  return JSON.stringify({
    from: data.base_code, to: data.target_code, rate: data.conversion_rate,
    amount, result: data.conversion_result, updated: data.time_last_update_utc,
  });
}

export const exchangeRateTool: ToolDefinition = {
  declaration: {
    name: "convert_currency",
    description: "Convert an amount from one currency to another using live exchange rates. Use ISO codes like USD, EUR, TRY, GBP.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        from: { type: SchemaType.STRING, description: "Source currency code (e.g. 'USD', 'EUR', 'TRY')" },
        to: { type: SchemaType.STRING, description: "Target currency code" },
        amount: { type: SchemaType.NUMBER, description: "Amount to convert (default: 1)" },
      },
      required: ["from", "to"],
    },
  },
  execute: async (args) => convertCurrency(args.from as string, args.to as string, (args.amount as number) || 1),
};
