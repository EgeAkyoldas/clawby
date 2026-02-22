import type { ToolDefinition } from "../agent/types.js";
import { getTimeTool } from "./get-time.js";
import { wikipediaSearchTool } from "./wikipedia.js";
import { cryptoPriceTool, cryptoSearchTool } from "./coingecko.js";
import { weatherTool, forecastTool } from "./weather.js";
import { exchangeRateTool } from "./exchange.js";
import { newsSearchTool, newsHeadlinesTool } from "./news.js";
import { tmdbSearchTool, tmdbDetailsTool } from "./tmdb.js";
import { wolframTool } from "./wolfram.js";
import { spotifySearchTool, spotifyMyPlaylistsTool, spotifyNowPlayingTool, spotifyTopTracksTool, spotifyRecentTool, spotifyCreatePlaylistTool, spotifyAddToPlaylistTool, spotifyPlayTool, spotifyPauseTool, spotifySkipTool } from "./spotify.js";
import { hotelSearchTool, carRentalTool, flightSearchTool } from "./travel.js";
import { tripadvisorRestaurantsTool, tripadvisorAttractionsTool } from "./tripadvisor.js";
import { airbnbSearchTool } from "./airbnb.js";
import { todoistGetTasksTool, todoistCreateTaskTool, todoistCompleteTool } from "./todoist.js";
import { githubSearchTool, githubMyReposTool, githubCreateIssueTool } from "./github.js";
import { searchPlacesTool, directionsTool, geocodeTool } from "./google-maps.js";
import { youtubeSearchTool, youtubeDetailsTool } from "./youtube.js";
import { calendarEventsTool } from "./google-calendar.js";
import { generateImageTool } from "./generate-image.js";

/** All registered local tools */
const tools: ToolDefinition[] = [
  // Core
  getTimeTool,
  // Knowledge
  wikipediaSearchTool,
  wolframTool,
  // Finance
  exchangeRateTool,
  cryptoPriceTool,
  cryptoSearchTool,
  // Weather
  weatherTool,
  forecastTool,
  // News & Media
  newsSearchTool,
  newsHeadlinesTool,
  tmdbSearchTool,
  tmdbDetailsTool,
  spotifySearchTool,
  spotifyMyPlaylistsTool,
  spotifyNowPlayingTool,
  spotifyTopTracksTool,
  spotifyRecentTool,
  spotifyCreatePlaylistTool,
  spotifyAddToPlaylistTool,
  spotifyPlayTool,
  spotifyPauseTool,
  spotifySkipTool,
  // Travel & Accommodation
  hotelSearchTool,
  carRentalTool,
  flightSearchTool,
  tripadvisorRestaurantsTool,
  tripadvisorAttractionsTool,
  airbnbSearchTool,
  // Productivity
  todoistGetTasksTool,
  todoistCreateTaskTool,
  todoistCompleteTool,
  // Developer
  githubSearchTool,
  githubMyReposTool,
  githubCreateIssueTool,
  // Google
  searchPlacesTool,
  directionsTool,
  geocodeTool,
  youtubeSearchTool,
  youtubeDetailsTool,
  calendarEventsTool,
  // AI
  generateImageTool,
];

/** Function declarations for local tools (Gemini API format) */
export const localFunctionDeclarations = tools.map((t) => t.declaration);

/** For backward compat — same as localFunctionDeclarations */
export const functionDeclarations = localFunctionDeclarations;

/** Check if a tool name is a local (non-MCP) tool */
export function isLocalTool(name: string): boolean {
  return tools.some((t) => t.declaration.name === name);
}

/** Execute a local tool by name */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const tool = tools.find((t) => t.declaration.name === name);
  if (!tool) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  try {
    return await tool.execute(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Tool "${name}" failed: ${message}` });
  }
}
