import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

interface Article { title: string; description?: string; source?: { name: string }; url: string; publishedAt: string; }

async function newsApiSearch(query: string): Promise<string> {
  if (!config.newsApiKey) return JSON.stringify({ error: "NEWS_API_KEY not configured" });
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${config.newsApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `NewsAPI error: ${res.status}` });
  const data = await res.json() as { articles: Article[] };
  return JSON.stringify(data.articles.map((a) => ({
    title: a.title, description: a.description, source: a.source?.name, url: a.url, published: a.publishedAt,
  })));
}

async function newsApiHeadlines(country: string = "us"): Promise<string> {
  if (!config.newsApiKey) return JSON.stringify({ error: "NEWS_API_KEY not configured" });
  const url = `https://newsapi.org/v2/top-headlines?country=${country}&pageSize=5&apiKey=${config.newsApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `NewsAPI error: ${res.status}` });
  const data = await res.json() as { articles: Article[] };
  return JSON.stringify(data.articles.map((a) => ({
    title: a.title, description: a.description, source: a.source?.name, url: a.url, published: a.publishedAt,
  })));
}

async function gnewsSearch(query: string, lang: string = "en"): Promise<string> {
  if (!config.gnewsApiKey) return newsApiSearch(query);
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&max=5&apikey=${config.gnewsApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `GNews error: ${res.status}` });
  const data = await res.json() as { articles: Array<{ title: string; description: string; url: string; publishedAt: string; source: { name: string } }> };
  return JSON.stringify(data.articles.map((a) => ({
    title: a.title, description: a.description, source: a.source?.name, url: a.url, published: a.publishedAt,
  })));
}

export const newsSearchTool: ToolDefinition = {
  declaration: {
    name: "search_news",
    description: "Search news articles by keyword. Returns 5 most recent articles.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Keywords to search for in news" },
        lang: { type: SchemaType.STRING, description: "Language code (default: 'en'). Use 'tr' for Turkish." },
      },
      required: ["query"],
    },
  },
  execute: async (args) => gnewsSearch(args.query as string, (args.lang as string) || "en"),
};

export const newsHeadlinesTool: ToolDefinition = {
  declaration: {
    name: "get_headlines",
    description: "Get top news headlines for a country. Returns 5 top stories.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        country: { type: SchemaType.STRING, description: "ISO country code (e.g. 'us', 'tr', 'gb'). Default: 'us'" },
      },
      required: [],
    },
  },
  execute: async (args) => newsApiHeadlines((args.country as string) || "us"),
};
