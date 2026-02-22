import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

async function searchPlaces(query: string, location?: string): Promise<string> {
  if (!config.googleApiKey) return JSON.stringify({ error: "GOOGLE_API_KEY not configured" });
  let url = `${MAPS_BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&key=${config.googleApiKey}`;
  if (location) url += `&location=${encodeURIComponent(location)}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `Maps API error: ${res.status}` });
  const data = await res.json() as { results: Array<{
    name: string; formatted_address: string; rating: number;
    user_ratings_total: number; types: string[]; opening_hours?: { open_now: boolean };
    geometry: { location: { lat: number; lng: number } };
  }> };
  return JSON.stringify(data.results.slice(0, 5).map((p) => ({
    name: p.name, address: p.formatted_address, rating: p.rating,
    reviews: p.user_ratings_total, open_now: p.opening_hours?.open_now,
    types: p.types.slice(0, 3), lat: p.geometry.location.lat, lng: p.geometry.location.lng,
  })));
}

async function getDirections(origin: string, destination: string, mode: string = "driving"): Promise<string> {
  if (!config.googleApiKey) return JSON.stringify({ error: "GOOGLE_API_KEY not configured" });
  const url = `${MAPS_BASE}/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${config.googleApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `Directions API error: ${res.status}` });
  const data = await res.json() as { routes: Array<{
    legs: Array<{ distance: { text: string }; duration: { text: string }; start_address: string; end_address: string;
      steps: Array<{ html_instructions: string; distance: { text: string }; duration: { text: string } }>;
    }>;
  }>; status: string };
  if (data.status !== "OK") return JSON.stringify({ error: `Directions: ${data.status}` });
  const leg = data.routes[0]?.legs[0];
  if (!leg) return JSON.stringify({ error: "No route found" });
  return JSON.stringify({
    from: leg.start_address, to: leg.end_address, distance: leg.distance.text, duration: leg.duration.text, mode,
    steps: leg.steps.slice(0, 8).map((s) => ({
      instruction: s.html_instructions.replace(/<[^>]*>/g, ""), distance: s.distance.text, duration: s.duration.text,
    })),
  });
}

async function geocode(address: string): Promise<string> {
  if (!config.googleApiKey) return JSON.stringify({ error: "GOOGLE_API_KEY not configured" });
  const url = `${MAPS_BASE}/geocode/json?address=${encodeURIComponent(address)}&key=${config.googleApiKey}`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `Geocode error: ${res.status}` });
  const data = await res.json() as { results: Array<{
    formatted_address: string; geometry: { location: { lat: number; lng: number } };
  }> };
  const r = data.results[0];
  if (!r) return JSON.stringify({ error: "Address not found" });
  return JSON.stringify({ address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng });
}

export const searchPlacesTool: ToolDefinition = {
  declaration: {
    name: "search_places",
    description: "Search for places, restaurants, hotels, shops etc. using Google Maps. Returns name, address, rating, and open status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "What to search for (e.g. 'sushi restaurant near Kadikoy', 'pharmacy in Istanbul')" },
        location: { type: SchemaType.STRING, description: "Optional center point as 'lat,lng' (e.g. '41.0082,28.9784')" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchPlaces(args.query as string, args.location as string | undefined),
};

export const directionsTool: ToolDefinition = {
  declaration: {
    name: "get_directions",
    description: "Get directions between two locations via Google Maps. Returns distance, duration, and step-by-step instructions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        origin: { type: SchemaType.STRING, description: "Starting location (address or place name)" },
        destination: { type: SchemaType.STRING, description: "Destination location (address or place name)" },
        mode: { type: SchemaType.STRING, description: "'driving', 'walking', 'bicycling', or 'transit'. Default: 'driving'" },
      },
      required: ["origin", "destination"],
    },
  },
  execute: async (args) => getDirections(args.origin as string, args.destination as string, (args.mode as string) || "driving"),
};

export const geocodeTool: ToolDefinition = {
  declaration: {
    name: "geocode_address",
    description: "Convert an address to latitude/longitude coordinates using Google Maps Geocoding.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        address: { type: SchemaType.STRING, description: "Address or place name to geocode" },
      },
      required: ["address"],
    },
  },
  execute: async (args) => geocode(args.address as string),
};
