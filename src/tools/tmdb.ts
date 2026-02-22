import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbHeaders(): Record<string, string> {
  if (config.tmdbReadAccessKey) return { Authorization: `Bearer ${config.tmdbReadAccessKey}`, "Content-Type": "application/json" };
  return { "Content-Type": "application/json" };
}

function tmdbUrl(path: string, extra: string = ""): string {
  const key = config.tmdbApiKey ? `&api_key=${config.tmdbApiKey}` : "";
  return `${TMDB_BASE}${path}?${extra}${key}`;
}

async function searchMovie(query: string): Promise<string> {
  if (!config.tmdbApiKey && !config.tmdbReadAccessKey) return JSON.stringify({ error: "TMDB_API_KEY not configured" });
  const url = tmdbUrl("/search/multi", `query=${encodeURIComponent(query)}&page=1`);
  const res = await fetch(url, { headers: tmdbHeaders() });
  if (!res.ok) return JSON.stringify({ error: `TMDB error: ${res.status}` });
  const data = await res.json() as { results: Array<{
    id: number; title?: string; name?: string; media_type: string;
    overview: string; vote_average: number; release_date?: string; first_air_date?: string;
  }> };
  return JSON.stringify(data.results.slice(0, 5).map((r) => ({
    id: r.id, title: r.title || r.name, type: r.media_type,
    overview: r.overview?.slice(0, 200), rating: r.vote_average, date: r.release_date || r.first_air_date,
  })));
}

async function getMovieDetails(id: number, type: string = "movie"): Promise<string> {
  if (!config.tmdbApiKey && !config.tmdbReadAccessKey) return JSON.stringify({ error: "TMDB_API_KEY not configured" });
  const url = tmdbUrl(`/${type}/${id}`);
  const res = await fetch(url, { headers: tmdbHeaders() });
  if (!res.ok) return JSON.stringify({ error: `TMDB error: ${res.status}` });
  const data = await res.json() as {
    title?: string; name?: string; overview: string; vote_average: number;
    release_date?: string; first_air_date?: string; runtime?: number;
    genres: Array<{ name: string }>; status: string; number_of_seasons?: number;
  };
  return JSON.stringify({
    title: data.title || data.name, overview: data.overview, rating: data.vote_average,
    date: data.release_date || data.first_air_date, runtime: data.runtime ? `${data.runtime} min` : undefined,
    genres: data.genres.map((g) => g.name), status: data.status, seasons: data.number_of_seasons,
  });
}

export const tmdbSearchTool: ToolDefinition = {
  declaration: {
    name: "search_movie_tv",
    description: "Search for movies and TV shows by title. Returns top 5 results with ratings.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Movie or TV show title to search for" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchMovie(args.query as string),
};

export const tmdbDetailsTool: ToolDefinition = {
  declaration: {
    name: "get_movie_tv_details",
    description: "Get detailed information about a movie or TV show by TMDB ID.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.NUMBER, description: "TMDB ID of the movie or TV show" },
        type: { type: SchemaType.STRING, description: "'movie' or 'tv' (default: 'movie')" },
      },
      required: ["id"],
    },
  },
  execute: async (args) => getMovieDetails(args.id as number, (args.type as string) || "movie"),
};
