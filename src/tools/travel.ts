import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const RAPIDAPI_HOST_BOOKING = "booking-com15.p.rapidapi.com";
const RAPIDAPI_HOST_AIRSCRAPER = "air-scraper.p.rapidapi.com";

function rapidHeaders(host: string): Record<string, string> {
  return { "x-rapidapi-key": config.rapidApiKey || "", "x-rapidapi-host": host };
}

// ── Booking.com: Hotels ──────────────────────────────────────────

async function searchHotels(city: string, checkIn: string, checkOut: string): Promise<string> {
  if (!config.rapidApiKey) return JSON.stringify({ error: "RAPIDAPI_KEY not configured" });
  const destUrl = `https://${RAPIDAPI_HOST_BOOKING}/api/v1/hotels/searchDestination?query=${encodeURIComponent(city)}`;
  const destRes = await fetch(destUrl, { headers: rapidHeaders(RAPIDAPI_HOST_BOOKING) });
  if (!destRes.ok) return JSON.stringify({ error: `Booking API error: ${destRes.status}` });
  const destData = await destRes.json() as { data?: Array<{ dest_id: string; search_type: string; name: string }> };
  const dest = destData.data?.[0];
  if (!dest) return JSON.stringify({ error: "Destination not found" });

  const searchUrl = `https://${RAPIDAPI_HOST_BOOKING}/api/v1/hotels/searchHotels?dest_id=${dest.dest_id}&search_type=${dest.search_type}&arrival_date=${checkIn}&departure_date=${checkOut}&adults=1&room_qty=1&page_number=1&units=metric&currency_code=USD`;
  const searchRes = await fetch(searchUrl, { headers: rapidHeaders(RAPIDAPI_HOST_BOOKING) });
  if (!searchRes.ok) return JSON.stringify({ error: `Hotel search error: ${searchRes.status}` });
  const searchData = await searchRes.json() as { data?: { hotels?: Array<{ property?: { name: string; reviewScore: number; reviewScoreWord: string; priceBreakdown?: { grossPrice?: { value: number; currency: string } } } }> } };
  const hotels = (searchData.data?.hotels || []).slice(0, 5);
  return JSON.stringify(hotels.map((h) => ({
    name: h.property?.name, rating: h.property?.reviewScore, ratingText: h.property?.reviewScoreWord,
    price: h.property?.priceBreakdown?.grossPrice?.value ? `${h.property.priceBreakdown.grossPrice.value} ${h.property.priceBreakdown.grossPrice.currency}` : "N/A",
  })));
}

// ── Booking.com: Car Rentals ─────────────────────────────────────

async function searchCarRentals(pickupLocation: string, pickupDate: string, dropoffDate: string): Promise<string> {
  if (!config.rapidApiKey) return JSON.stringify({ error: "RAPIDAPI_KEY not configured" });
  // First find location coordinates
  const geoUrl = `https://${RAPIDAPI_HOST_BOOKING}/api/v1/cars/searchDestination?query=${encodeURIComponent(pickupLocation)}`;
  const geoRes = await fetch(geoUrl, { headers: rapidHeaders(RAPIDAPI_HOST_BOOKING) });
  if (!geoRes.ok) return JSON.stringify({ error: `Location lookup error: ${geoRes.status}` });
  const geoData = await geoRes.json() as { data?: Array<{ latitude: number; longitude: number; name: string; city_name: string }> };
  const loc = geoData.data?.[0];
  if (!loc) return JSON.stringify({ error: "Pickup location not found" });

  const searchUrl = `https://${RAPIDAPI_HOST_BOOKING}/api/v1/cars/searchCarRentals?pick_up_latitude=${loc.latitude}&pick_up_longitude=${loc.longitude}&drop_off_latitude=${loc.latitude}&drop_off_longitude=${loc.longitude}&pick_up_date=${pickupDate}&drop_off_date=${dropoffDate}&pick_up_time=10%3A00&drop_off_time=10%3A00&driver_age=30&currency_code=USD`;
  const searchRes = await fetch(searchUrl, { headers: rapidHeaders(RAPIDAPI_HOST_BOOKING) });
  if (!searchRes.ok) return JSON.stringify({ error: `Car rental search error: ${searchRes.status}` });
  const data = await searchRes.json() as { data?: { search_results?: Array<{ vehicle_info?: { v_name: string; group: string; transmission: string; fuel_type: string }; pricing_info?: { price: number; currency: string }; supplier_info?: { name: string } }> } };
  const results = (data.data?.search_results || []).slice(0, 5);
  return JSON.stringify(results.map((r) => ({
    car: r.vehicle_info?.v_name, type: r.vehicle_info?.group,
    transmission: r.vehicle_info?.transmission, fuel: r.vehicle_info?.fuel_type,
    price: r.pricing_info ? `${r.pricing_info.price} ${r.pricing_info.currency}` : "N/A",
    supplier: r.supplier_info?.name,
  })));
}

// ── Air Scraper: Flights ─────────────────────────────────────────

async function searchFlights(origin: string, destination: string, date: string): Promise<string> {
  if (!config.rapidApiKey) return JSON.stringify({ error: "RAPIDAPI_KEY not configured" });
  const url = `https://${RAPIDAPI_HOST_AIRSCRAPER}/api/v1/flights/searchFlights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}&adults=1&currency=USD`;
  const res = await fetch(url, { headers: rapidHeaders(RAPIDAPI_HOST_AIRSCRAPER) });
  if (!res.ok) return JSON.stringify({ error: `Flight search error: ${res.status}` });
  const data = await res.json() as { data?: Array<{
    price?: { total: number; currency: string };
    legs?: Array<{ departure: string; arrival: string; duration: number; airline?: string; stops: number }>;
  }> };
  const flights = (Array.isArray(data.data) ? data.data : []).slice(0, 5);
  return JSON.stringify(flights.map((f) => {
    const leg = f.legs?.[0];
    return {
      price: f.price ? `${f.price.total} ${f.price.currency}` : "N/A",
      departure: leg?.departure, arrival: leg?.arrival,
      duration: leg?.duration ? `${Math.floor(leg.duration / 60)}h ${leg.duration % 60}m` : undefined,
      airline: leg?.airline, stops: leg?.stops,
    };
  }));
}

// ── Tool Declarations ────────────────────────────────────────────

export const hotelSearchTool: ToolDefinition = {
  declaration: {
    name: "search_hotels",
    description: "Search for hotels in a city with check-in/check-out dates via Booking.com. Returns top 5 with prices and ratings.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: { type: SchemaType.STRING, description: "City name (e.g. 'London', 'Istanbul')" },
        check_in: { type: SchemaType.STRING, description: "Check-in date YYYY-MM-DD" },
        check_out: { type: SchemaType.STRING, description: "Check-out date YYYY-MM-DD" },
      },
      required: ["city", "check_in", "check_out"],
    },
  },
  execute: async (args) => searchHotels(args.city as string, args.check_in as string, args.check_out as string),
};

export const carRentalTool: ToolDefinition = {
  declaration: {
    name: "search_car_rentals",
    description: "Search for car rentals at a location with pickup/dropoff dates via Booking.com. Returns top 5 with prices.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        location: { type: SchemaType.STRING, description: "Pickup city or airport (e.g. 'Istanbul Airport', 'London Heathrow')" },
        pickup_date: { type: SchemaType.STRING, description: "Pickup date YYYY-MM-DD" },
        dropoff_date: { type: SchemaType.STRING, description: "Dropoff date YYYY-MM-DD" },
      },
      required: ["location", "pickup_date", "dropoff_date"],
    },
  },
  execute: async (args) => searchCarRentals(args.location as string, args.pickup_date as string, args.dropoff_date as string),
};

export const flightSearchTool: ToolDefinition = {
  declaration: {
    name: "search_flights",
    description: "Search for flights between cities/airports. Returns top 5 with prices, times, and airlines.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        origin: { type: SchemaType.STRING, description: "Departure city or IATA airport code (e.g. 'Istanbul' or 'IST')" },
        destination: { type: SchemaType.STRING, description: "Arrival city or IATA airport code" },
        date: { type: SchemaType.STRING, description: "Departure date YYYY-MM-DD" },
      },
      required: ["origin", "destination", "date"],
    },
  },
  execute: async (args) => searchFlights(args.origin as string, args.destination as string, args.date as string),
};
