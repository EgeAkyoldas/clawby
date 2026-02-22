import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "AgentClaw/1.0",
  };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  return headers;
}

async function searchRepos(query: string): Promise<string> {
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) return JSON.stringify({ error: `GitHub error: ${res.status}` });
  const data = await res.json() as { items: Array<{
    full_name: string; description: string; stargazers_count: number;
    language: string; html_url: string; updated_at: string;
  }> };
  return JSON.stringify(data.items.map((r) => ({
    name: r.full_name, description: r.description?.slice(0, 150), stars: r.stargazers_count,
    language: r.language, url: r.html_url, updated: r.updated_at,
  })));
}

async function getMyRepos(): Promise<string> {
  if (!config.githubToken) return JSON.stringify({ error: "GITHUB_TOKEN not configured" });
  const url = `${GITHUB_API}/user/repos?sort=updated&per_page=10`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) return JSON.stringify({ error: `GitHub error: ${res.status}` });
  const repos = await res.json() as Array<{
    full_name: string; description: string; private: boolean;
    language: string; html_url: string; updated_at: string;
  }>;
  return JSON.stringify(repos.map((r) => ({
    name: r.full_name, description: r.description?.slice(0, 100), private: r.private,
    language: r.language, url: r.html_url, updated: r.updated_at,
  })));
}

async function createIssue(repo: string, title: string, body?: string): Promise<string> {
  if (!config.githubToken) return JSON.stringify({ error: "GITHUB_TOKEN not configured" });
  const url = `${GITHUB_API}/repos/${repo}/issues`;
  const res = await fetch(url, {
    method: "POST", headers: githubHeaders(), body: JSON.stringify({ title, body }),
  });
  if (!res.ok) return JSON.stringify({ error: `GitHub error: ${res.status}` });
  const issue = await res.json() as { number: number; html_url: string; title: string };
  return JSON.stringify({ created: true, number: issue.number, url: issue.html_url, title: issue.title });
}

export const githubSearchTool: ToolDefinition = {
  declaration: {
    name: "github_search_repos",
    description: "Search GitHub repositories by keyword. Returns top 5 sorted by stars.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Search query (e.g. 'telegram bot typescript')" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchRepos(args.query as string),
};

export const githubMyReposTool: ToolDefinition = {
  declaration: {
    name: "github_my_repos",
    description: "List your GitHub repositories, sorted by most recently updated.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  execute: async () => getMyRepos(),
};

export const githubCreateIssueTool: ToolDefinition = {
  declaration: {
    name: "github_create_issue",
    description: "Create a new issue on a GitHub repository.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        repo: { type: SchemaType.STRING, description: "Repository in 'owner/repo' format" },
        title: { type: SchemaType.STRING, description: "Issue title" },
        body: { type: SchemaType.STRING, description: "Optional issue body" },
      },
      required: ["repo", "title"],
    },
  },
  execute: async (args) => createIssue(args.repo as string, args.title as string, args.body as string | undefined),
};
