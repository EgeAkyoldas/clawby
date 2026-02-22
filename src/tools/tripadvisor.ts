import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const RAPIDAPI_HOST = "tripadvisor16.p.rapidapi.com";

function rapidHeaders(): Record<string, string> {
  return { "x-rapidapi-key": config.rapidApiKey || "", "x-rapidapi-host": RAPIDAPI_HOST };
}

async function searchRestaurants(location: string): Promise<string> {
  if (!config.rapidApiKey) return JSON.stringify({ error: "RAPIDAPI_KEY not configured" });

  // First get location ID
  const locUrl = `https://${RAPIDAPI_HOST}/api/v1/restaurant/searchLocation?query=${encodeURIComponent(location)}`;
  const locRes = await fetch(locUrl, { headers: rapidHeaders() });
  if (!locRes.ok) return JSON.stringify({ error: `Tripadvisor location error: ${locRes.status}` });
  const locData = await locRes.json() as { data?: Array<{ locationId: string; localizedName: string }> };
  const loc = locData.data?.[0];
  if (!loc) return JSON.stringify({ error: "Location not found on Tripadvisor" });

  // Search restaurants
  const searchUrl = `https://${RAPIDAPI_HOST}/api/v1/restaurant/searchRestaurants?locationId=${loc.locationId}`;
  const searchRes = await fetch(searchUrl, { headers: rapidHeaders() });
  if (!searchRes.ok) return JSON.stringify({ error: `Restaurant search error: ${searchRes.status}` });
  const data = await searchRes.json() as { data?: { data?: Array<{
    name: string; averageRating: number; userReviewCount: number;
    establishmentTypeAndCuisineTags?: string[]; priceTag?: string;
    currentOpenStatusText?: string; addressObj?: { street1: string };
  }> } };
  const restaurants = (data.data?.data || []).slice(0, 5);
  return JSON.stringify(restaurants.map((r) => ({
    name: r.name, rating: r.averageRating, reviews: r.userReviewCount,
    cuisine: r.establishmentTypeAndCuisineTags?.slice(0, 3),
    price: r.priceTag, status: r.currentOpenStatusText, address: r.addressObj?.street1,
  })));
}

async function searchAttractions(location: string): Promise<string> {
  if (!config.rapidApiKey) return JSON.stringify({ error: "RAPIDAPI_KEY not configured" });

  const locUrl = `https://${RAPIDAPI_HOST}/api/v1/attraction/searchLocation?query=${encodeURIComponent(location)}`;
  const locRes = await fetch(locUrl, { headers: rapidHeaders() });
  if (!locRes.ok) return JSON.stringify({ error: `Tripadvisor location error: ${locRes.status}` });
  const locData = await locRes.json() as { data?: Array<{ locationId: string }> };
  const loc = locData.data?.[0];
  if (!loc) return JSON.stringify({ error: "Location not found" });

  const searchUrl = `https://${RAPIDAPI_HOST}/api/v1/attraction/searchAttractions?locationId=${loc.locationId}`;
  const searchRes = await fetch(searchUrl, { headers: rapidHeaders() });
  if (!searchRes.ok) return JSON.stringify({ error: `Attraction search error: ${searchRes.status}` });
  const data = await searchRes.json() as { data?: { data?: Array<{
    name: string; averageRating: number; userReviewCount: number;
    subcategoryNames?: string[]; addressObj?: { street1: string };
  }> } };
  const attractions = (data.data?.data || []).slice(0, 5);
  return JSON.stringify(attractions.map((a) => ({
    name: a.name, rating: a.averageRating, reviews: a.userReviewCount,
    categories: a.subcategoryNames?.slice(0, 3), address: a.addressObj?.street1,
  })));
}

export const tripadvisorRestaurantsTool: ToolDefinition = {
  declaration: {
    name: "search_restaurants",
    description: "Search for restaurants in a city or area using Tripadvisor. Returns top 5 with ratings, cuisine, and prices.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        location: { type: SchemaType.STRING, description: "City or area (e.g. 'Istanbul', 'Kadıköy', 'Tokyo')" },
      },
      required: ["location"],
    },
  },
  execute: async (args) => searchRestaurants(args.location as string),
};

export const tripadvisorAttractionsTool: ToolDefinition = {
  declaration: {
    name: "search_attractions",
    description: "Search for tourist attractions and things to do in a city using Tripadvisor. Returns top 5 with ratings.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        location: { type: SchemaType.STRING, description: "City or area name" },
      },
      required: ["location"],
    },
  },
  execute: async (args) => searchAttractions(args.location as string),
};
