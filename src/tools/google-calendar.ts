import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Exchange the stored refresh token for a fresh access token.
 */
async function getAccessToken(): Promise<string | null> {
  if (!config.googleClientId || !config.googleClientSecret || !config.googleCalendarRefreshToken) {
    return null;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: config.googleCalendarRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token || null;
}

/**
 * Fetch calendar events for a date range.
 * Read-only — only GET requests, never create/edit/delete.
 */
async function getCalendarEvents(dateStart: string, dateEnd: string): Promise<string> {
  if (!config.googleCalendarRefreshToken) {
    return JSON.stringify({
      error: "Google Calendar not configured. Run: npx tsx scripts/google-auth.ts",
    });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return JSON.stringify({ error: "Failed to obtain Google Calendar access token. Check your credentials." });
  }

  const params = new URLSearchParams({
    timeMin: new Date(dateStart).toISOString(),
    timeMax: new Date(dateEnd).toISOString(),
    maxResults: "10",
    singleEvents: "true",
    orderBy: "startTime",
  });

  const url = `${CALENDAR_API}/calendars/primary/events?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return JSON.stringify({ error: `Google Calendar API error: ${res.status}` });
  }

  const data = (await res.json()) as {
    items?: Array<{
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      location?: string;
      status?: string;
    }>;
  };

  const events = (data.items || [])
    .filter((e) => e.status !== "cancelled")
    .slice(0, 5);

  // Log only non-sensitive metadata
  console.log(`  📅 Calendar: ${events.length} event(s) for ${dateStart}`);

  if (events.length === 0) {
    return JSON.stringify({ message: "No events scheduled." });
  }

  return JSON.stringify(
    events.map((e) => {
      const startRaw = e.start?.dateTime || e.start?.date || "";
      const endRaw = e.end?.dateTime || e.end?.date || "";

      // Format times nicely
      let timeStr = "All day";
      if (e.start?.dateTime) {
        const start = new Date(startRaw);
        const end = new Date(endRaw);
        const fmt = (d: Date) =>
          d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        timeStr = `${fmt(start)} – ${fmt(end)}`;
      }

      return {
        title: e.summary || "(No title)",
        time: timeStr,
        ...(e.location ? { location: e.location } : {}),
      };
    })
  );
}

export const calendarEventsTool: ToolDefinition = {
  declaration: {
    name: "get_calendar_events",
    description:
      "Fetch upcoming Google Calendar events for a date range. Read-only. Returns up to 5 events with title, time, and location. Use this when the user asks about their schedule, appointments, or calendar.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date_start: {
          type: SchemaType.STRING,
          description: "Start date in YYYY-MM-DD format (e.g. '2026-02-24')",
        },
        date_end: {
          type: SchemaType.STRING,
          description: "End date in YYYY-MM-DD format (e.g. '2026-02-25'). For a single day, use the next day.",
        },
      },
      required: ["date_start", "date_end"],
    },
  },
  execute: async (args) =>
    getCalendarEvents(args.date_start as string, args.date_end as string),
};
