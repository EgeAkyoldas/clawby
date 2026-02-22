import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const BASE_URL = "https://api.openweathermap.org/data/2.5";

async function getWeather(city: string, units: string = "metric"): Promise<string> {
  if (!config.openweatherApiKey) return JSON.stringify({ error: "OPENWEATHER_API_KEY not configured" });
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${config.openweatherApiKey}&units=${units}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    return JSON.stringify({ error: err.message || `Weather API error: ${res.status}` });
  }
  const data = await res.json() as {
    name: string; sys: { country: string };
    main: { temp: number; feels_like: number; humidity: number };
    weather: Array<{ description: string }>; wind: { speed: number };
  };
  return JSON.stringify({
    city: `${data.name}, ${data.sys.country}`,
    temperature: `${data.main.temp}°${units === "metric" ? "C" : "F"}`,
    feels_like: `${data.main.feels_like}°${units === "metric" ? "C" : "F"}`,
    condition: data.weather[0]?.description,
    humidity: `${data.main.humidity}%`,
    wind_speed: `${data.wind.speed} ${units === "metric" ? "m/s" : "mph"}`,
  });
}

async function getForecast(city: string, units: string = "metric"): Promise<string> {
  if (!config.openweatherApiKey) return JSON.stringify({ error: "OPENWEATHER_API_KEY not configured" });
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${config.openweatherApiKey}&units=${units}&cnt=8`;
  const res = await fetch(url);
  if (!res.ok) return JSON.stringify({ error: `Forecast API error: ${res.status}` });
  const data = await res.json() as { list: Array<{ dt_txt: string; main: { temp: number }; weather: Array<{ description: string }> }> };
  return JSON.stringify(data.list.map((item) => ({
    time: item.dt_txt, temp: `${item.main.temp}°${units === "metric" ? "C" : "F"}`, condition: item.weather[0]?.description,
  })));
}

export const weatherTool: ToolDefinition = {
  declaration: {
    name: "get_weather",
    description: "Get current weather for a city. Returns temperature, humidity, wind, and conditions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: { type: SchemaType.STRING, description: "City name (e.g. 'Istanbul', 'London')" },
        units: { type: SchemaType.STRING, description: "Temperature units: 'metric' (°C) or 'imperial' (°F). Default: metric" },
      },
      required: ["city"],
    },
  },
  execute: async (args) => getWeather(args.city as string, (args.units as string) || "metric"),
};

export const forecastTool: ToolDefinition = {
  declaration: {
    name: "get_forecast",
    description: "Get weather forecast for next 24 hours (3-hour intervals) for a city.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: { type: SchemaType.STRING, description: "City name" },
        units: { type: SchemaType.STRING, description: "Temperature units: 'metric' or 'imperial'" },
      },
      required: ["city"],
    },
  },
  execute: async (args) => getForecast(args.city as string, (args.units as string) || "metric"),
};
