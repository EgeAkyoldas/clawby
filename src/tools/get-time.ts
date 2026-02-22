import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";

export const getTimeTool: ToolDefinition = {
  declaration: {
    name: "get_current_time",
    description:
      "Returns the current date and time in ISO 8601 format with timezone offset. Use this when the user asks what time it is, the current date, or anything time-related.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        timezone: {
          type: SchemaType.STRING,
          description:
            'Optional IANA timezone (e.g. "Europe/Istanbul"). Defaults to system timezone if omitted.',
        },
      },
    },
  },

  execute: async (args) => {
    const now = new Date();

    // If a timezone is requested, format in that timezone
    const tz = args.timezone as string | undefined;
    if (tz) {
      try {
        const formatted = now.toLocaleString("en-US", { timeZone: tz });
        const isoish = now.toLocaleString("sv-SE", { timeZone: tz }); // YYYY-MM-DD HH:MM:SS
        return JSON.stringify({
          timezone: tz,
          formatted,
          iso: isoish,
          utc: now.toISOString(),
        });
      } catch {
        return JSON.stringify({
          error: `Invalid timezone: ${tz}`,
          utc: now.toISOString(),
        });
      }
    }

    // Default: system time
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString(),
      timestamp: now.getTime(),
    });
  },
};
