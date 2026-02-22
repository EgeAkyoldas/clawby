import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const RAPIDAPI_HOST = "airbnb13.p.rapidapi.com";

function rapidHeaders(): Record<string, string> {
  return { "x-rapidapi-key": config.rapidApiKey || "", "x-rapidapi-host": RAPIDAPI_HOST };
}

async function searchAirbnb(
  location: string, checkIn: string, checkOut: string, adults: number = 1
): Promise<string> {
  if (!config.rapidApiKey) return JSON.stringify({ error: "RAPIDAPI_KEY not configured" });
  const url = `https://${RAPIDAPI_HOST}/search-location?location=${encodeURIComponent(location)}&checkin=${checkIn}&checkout=${checkOut}&adults=${adults}&children=0&infants=0&pets=0&page=1&currency=USD`;
  const res = await fetch(url, { headers: rapidHeaders() });
  if (!res.ok) return JSON.stringify({ error: `Airbnb search error: ${res.status}` });
  const data = await res.json() as { results?: Array<{
    name: string; type: string; city: string;
    price?: { rate?: { amount: number }; currency: string; total?: { amount: number } };
    rating: number; reviewsCount: number; persons: number;
    bedrooms: number; bathrooms: number;
    images?: string[]; url?: string;
  }> };
  const listings = (data.results || []).slice(0, 5);
  return JSON.stringify(listings.map((l) => ({
    name: l.name, type: l.type, city: l.city,
    price_per_night: l.price?.rate?.amount ? `${l.price.rate.amount} ${l.price.currency}` : "N/A",
    total_price: l.price?.total?.amount ? `${l.price.total.amount} ${l.price.currency}` : "N/A",
    rating: l.rating, reviews: l.reviewsCount,
    bedrooms: l.bedrooms, bathrooms: l.bathrooms, max_guests: l.persons,
    url: l.url,
  })));
}

export const airbnbSearchTool: ToolDefinition = {
  declaration: {
    name: "search_airbnb",
    description: "Search for Airbnb listings in a city with check-in/check-out dates. Returns top 5 with prices, ratings, and details.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        location: { type: SchemaType.STRING, description: "City or area (e.g. 'Istanbul', 'Paris', 'Bali')" },
        check_in: { type: SchemaType.STRING, description: "Check-in date YYYY-MM-DD" },
        check_out: { type: SchemaType.STRING, description: "Check-out date YYYY-MM-DD" },
        adults: { type: SchemaType.NUMBER, description: "Number of adults (default: 1)" },
      },
      required: ["location", "check_in", "check_out"],
    },
  },
  execute: async (args) => searchAirbnb(
    args.location as string, args.check_in as string, args.check_out as string, (args.adults as number) || 1
  ),
};
