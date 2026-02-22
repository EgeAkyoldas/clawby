import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function searchYouTube(query: string, maxResults: number = 5): Promise<string> {
  if (!config.googleApiKey) return JSON.stringify({ error: "GOOGLE_API_KEY not configured" });
  const url = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${config.googleApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `YouTube API error: ${res.status}` });
  const data = await res.json() as { items: Array<{
    id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string; description: string };
  }> };
  return JSON.stringify(data.items.map((v) => ({
    title: v.snippet.title, channel: v.snippet.channelTitle, published: v.snippet.publishedAt,
    description: v.snippet.description.slice(0, 150),
    url: `https://youtube.com/watch?v=${v.id.videoId}`,
  })));
}

async function getVideoDetails(videoId: string): Promise<string> {
  if (!config.googleApiKey) return JSON.stringify({ error: "GOOGLE_API_KEY not configured" });
  const url = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${config.googleApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `YouTube API error: ${res.status}` });
  const data = await res.json() as { items: Array<{
    snippet: { title: string; channelTitle: string; publishedAt: string; description: string; tags?: string[] };
    statistics: { viewCount: string; likeCount: string; commentCount: string };
    contentDetails: { duration: string };
  }> };
  const v = data.items[0];
  if (!v) return JSON.stringify({ error: "Video not found" });
  return JSON.stringify({
    title: v.snippet.title, channel: v.snippet.channelTitle, published: v.snippet.publishedAt,
    description: v.snippet.description.slice(0, 300), tags: v.snippet.tags?.slice(0, 5),
    views: v.statistics.viewCount, likes: v.statistics.likeCount, comments: v.statistics.commentCount,
    duration: v.contentDetails.duration,
  });
}

export const youtubeSearchTool: ToolDefinition = {
  declaration: {
    name: "search_youtube",
    description: "Search YouTube for videos. Returns top results with titles, channels, and links.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Search query (e.g. 'TypeScript tutorial', 'lofi beats')" },
        max_results: { type: SchemaType.NUMBER, description: "Number of results (1-10, default: 5)" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchYouTube(args.query as string, (args.max_results as number) || 5),
};

export const youtubeDetailsTool: ToolDefinition = {
  declaration: {
    name: "get_youtube_video",
    description: "Get detailed info about a YouTube video by its ID. Returns views, likes, duration, and description.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        video_id: { type: SchemaType.STRING, description: "YouTube video ID (the part after 'watch?v=' in the URL)" },
      },
      required: ["video_id"],
    },
  },
  execute: async (args) => getVideoDetails(args.video_id as string),
};
