import "dotenv/config";

interface Config {
  telegramBotToken: string;
  modelApiKey: string;
  allowedUserIds: number[];
  transcriptionApiKey?: string;
  transcriptionMock: boolean;
  voiceEnabled: boolean;
  ttsApiKey?: string;
  ttsEnabled: boolean;
  vectorDbApiKey?: string;
  vectorDbIndex?: string;
  memoryMock: boolean;
  memoryEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  mcpAllowedTools: string[];
  mcpEnabled: boolean;
  // External API keys
  githubToken?: string;
  openweatherApiKey?: string;
  todoistApiKey?: string;
  exchangerateApiKey?: string;
  newsApiKey?: string;
  gnewsApiKey?: string;
  tmdbApiKey?: string;
  tmdbReadAccessKey?: string;
  wolframAppId?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  spotifyRefreshToken?: string;
  rapidApiKey?: string;
  googleApiKey?: string;
  googleCalendarRefreshToken?: string;
  heartbeatEnabled: boolean;
  heartbeatCron: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function parseAllowlist(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const id = Number(s);
      if (Number.isNaN(id)) {
        console.error(`❌ Invalid user ID in TELEGRAM_ALLOWLIST_USER_ID: "${s}"`);
        process.exit(1);
      }
      return id;
    });
}

const telegramBotToken = requireEnv("TELEGRAM_BOT_TOKEN");
const modelApiKey = requireEnv("MODEL_API_KEY");
const allowlistRaw = requireEnv("TELEGRAM_ALLOWLIST_USER_ID");

// Optional: transcription (voice messages)
const transcriptionApiKey = process.env.TRANSCRIPTION_API_KEY || undefined;
const transcriptionMock = process.env.TRANSCRIPTION_MOCK === "true";

// Optional: text-to-speech (voice replies)
const ttsApiKey = process.env.TTS_API_KEY || undefined;

// Optional: memory / vector DB
const vectorDbApiKey = process.env.VECTOR_DB_API_KEY || undefined;
const vectorDbIndex = process.env.VECTOR_DB_INDEX || undefined;
const memoryMock = process.env.MEMORY_MOCK === "true";

// Optional: MCP / Google Workspace
const googleClientId = process.env.GOOGLE_CLIENT_ID || undefined;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || undefined;
const mcpAllowedToolsRaw = process.env.MCP_ALLOWED_TOOLS || "";
const mcpAllowedTools = mcpAllowedToolsRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Optional: External APIs
const githubToken = process.env.GITHUB_TOKEN || undefined;
const openweatherApiKey = process.env.OPENWEATHER_API_KEY || undefined;
const todoistApiKey = process.env.TODOIST_API_KEY || undefined;
const exchangerateApiKey = process.env.EXCHANGERATE_API_KEY || undefined;
const newsApiKey = process.env.NEWS_API_KEY || undefined;
const gnewsApiKey = process.env.GNEWS_API_KEY || undefined;
const tmdbApiKey = process.env.TMDB_API_KEY || undefined;
const tmdbReadAccessKey = process.env.TMDB_READ_ACCESS_KEY || undefined;
const wolframAppId = process.env.WOLFRAM_APP_ID || undefined;
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || undefined;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET || undefined;
const spotifyRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN || undefined;
const rapidApiKey = process.env.RAPIDAPI_KEY || undefined;
const googleApiKey = process.env.GOOGLE_API_KEY || undefined;
const googleCalendarRefreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || undefined;

// Optional: Heartbeat (proactive daily check-ins)
const heartbeatEnabled = process.env.HEARTBEAT_ENABLED === "true";
const heartbeatCron = process.env.HEARTBEAT_CRON || "0 8 * * *";

export const config: Config = {
  telegramBotToken,
  modelApiKey,
  allowedUserIds: parseAllowlist(allowlistRaw),
  transcriptionApiKey,
  transcriptionMock,
  voiceEnabled: transcriptionMock || !!transcriptionApiKey,
  ttsApiKey,
  ttsEnabled: !!ttsApiKey,
  vectorDbApiKey,
  vectorDbIndex,
  memoryMock,
  memoryEnabled: true, // always on — uses local store by default
  googleClientId,
  googleClientSecret,
  mcpAllowedTools,
  mcpEnabled: !!(googleClientId && googleClientSecret),
  githubToken,
  openweatherApiKey,
  todoistApiKey,
  exchangerateApiKey,
  newsApiKey,
  gnewsApiKey,
  tmdbApiKey,
  tmdbReadAccessKey,
  wolframAppId,
  spotifyClientId,
  spotifyClientSecret,
  spotifyRefreshToken,
  rapidApiKey,
  googleApiKey,
  googleCalendarRefreshToken,
  heartbeatEnabled,
  heartbeatCron,
};

// Log boot confirmation WITHOUT leaking secrets
console.log(
  `✅ Config loaded — ${config.allowedUserIds.length} allowed user(s)`
);
