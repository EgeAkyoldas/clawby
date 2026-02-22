# 🤖 Gravity Claw — Clawby

A secure, local Telegram AI assistant powered by Google Gemini with **31 tools** across 15+ APIs — plus a heartbeat scheduler.

> **Full Stack**: Telegram ↔ Gemini agentic loop ↔ 31 local tools + MCP ↔ voice I/O ↔ long-term memory ↔ heartbeat

## Quick Start

### 1. Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **Telegram Bot Token** — [@BotFather](https://t.me/BotFather)
- **Google Gemini API Key** — [AI Studio](https://aistudio.google.com/apikey)
- **Your Telegram User ID** — [@userinfobot](https://t.me/userinfobot)

### 2. Setup

```powershell
npm install
copy .env.example .env
```

Edit `.env` with your real values. Only `TELEGRAM_BOT_TOKEN`, `MODEL_API_KEY`, and `TELEGRAM_ALLOWLIST_USER_ID` are required.

### 3. Run

```powershell
npm run dev
```

## 🛠️ Tool Inventory (31 Local Tools)

### Core

| Tool | Description |
| ---- | ----------- |
| `get_current_time` | Current time in any timezone |

### Knowledge & Computation

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `wikipedia_search` | Wikipedia article summaries | Free |
| `wolfram_alpha` | Math, science, data queries | `WOLFRAM_APP_ID` |

### Finance

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `get_crypto_price` | Crypto prices (CoinGecko) | Free |
| `search_crypto` | Search coins by name | Free |
| `convert_currency` | Currency conversion | `EXCHANGERATE_API_KEY` |

### Weather

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `get_weather` | Current weather | `OPENWEATHER_API_KEY` |
| `get_forecast` | 5-day forecast | `OPENWEATHER_API_KEY` |

### News & Media

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `search_news` | News article search | `NEWS_API_KEY` |
| `get_headlines` | Top headlines by country | `NEWS_API_KEY` |
| `search_movie_tv` | Movie/TV search (TMDB) | `TMDB_API_KEY` |
| `get_movie_tv_details` | Movie/TV details | `TMDB_API_KEY` |
| `search_spotify` | Spotify track/artist search | `SPOTIFY_CLIENT_ID/SECRET` |

### Travel & Accommodation

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `search_hotels` | Hotel search (Booking.com) | `RAPIDAPI_KEY` |
| `search_car_rentals` | Car rental search (Booking.com) | `RAPIDAPI_KEY` |
| `search_flights` | Flight search (Air Scraper) | `RAPIDAPI_KEY` |
| `search_restaurants` | Restaurant search (Tripadvisor) | `RAPIDAPI_KEY` |
| `search_attractions` | Things to do (Tripadvisor) | `RAPIDAPI_KEY` |
| `search_airbnb` | Airbnb listing search | `RAPIDAPI_KEY` |

### Google APIs

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `search_places` | Google Maps place search | `GOOGLE_API_KEY` |
| `get_directions` | Driving/transit directions | `GOOGLE_API_KEY` |
| `geocode_address` | Address → coordinates | `GOOGLE_API_KEY` |
| `search_youtube` | YouTube video search | `GOOGLE_API_KEY` |
| `get_youtube_video` | YouTube video details | `GOOGLE_API_KEY` |
| `get_calendar_events` | Google Calendar (read-only) | OAuth2 refresh token |

### Productivity

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `todoist_get_tasks` | List Todoist tasks | `TODOIST_API_KEY` |
| `todoist_create_task` | Create a task | `TODOIST_API_KEY` |
| `todoist_complete_task` | Complete a task | `TODOIST_API_KEY` |

### Developer

| Tool | Description | API Key |
| ---- | ----------- | ------- |
| `github_search_repos` | Search GitHub repos | `GITHUB_TOKEN` |
| `github_my_repos` | List your repos | `GITHUB_TOKEN` |
| `github_create_issue` | Create an issue | `GITHUB_TOKEN` |

## 📅 Google Calendar Setup

One-time OAuth2 setup to enable read-only calendar access:

```powershell
npx tsx scripts/google-auth.ts
```

1. Opens a browser for Google consent (read-only scope)
2. Approve access → refresh token appears in terminal
3. Add to `.env`:

```env
GOOGLE_CALENDAR_REFRESH_TOKEN=<paste token here>
```

**Read-only only** — the tool can never create, edit, or delete events.

## 🧠 Long-Term Memory

Memory is **always on** using a local JSON vector store — no external DB needed.

- **Core Memory** (`memory/core_memory.md`) — stable preferences
- **Recalled Memories** — top-3 relevant memories injected per message
- **Commands**: `/remember <fact>`, `/recall <query>`
- **Privacy**: All data stored locally, gitignored

## 🔌 MCP — Gmail, Calendar, Drive

Connect to Google Workspace via the Model Context Protocol.

1. Create a Google Cloud Project with Gmail, Calendar, Drive APIs enabled
2. Create OAuth 2.0 credentials (Desktop app type)
3. Add to `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
4. First run opens browser for OAuth consent

### MCP Guardrails

- **Tool Allowlist** — optional `MCP_ALLOWED_TOOLS` restriction
- **Argument Firewall** — blocks outbound args containing env secrets
- **Log Redaction** — strips tokens/keys from logged responses

## 🎙️ Voice I/O

- **Voice Input**: Send a voice message → Whisper transcription → AI reply (`TRANSCRIPTION_API_KEY`)
- **Voice Reply**: Say "reply with voice" → text + audio note (`TTS_API_KEY`)

## 🔒 Security

- **No web server** — long-polling only, zero exposed ports
- **User allowlist** — only your Telegram ID(s)
- **Secrets in `.env`** — gitignored, never logged
- **MCP guardrails** — allowlist, argument firewall, log redaction
- **Local memory** — no external vector DB

## 💓 Heartbeat (Proactive Check-ins)

Daily morning message asking your priority and blockers.

```env
HEARTBEAT_ENABLED=true          # Kill switch (default: false)
HEARTBEAT_CRON=0 8 * * *        # Cron schedule (default: 08:00 daily)
```

| Command | Action |
| ------- | ------ |
| `/heartbeat_test` | Trigger one heartbeat message immediately |

- Only sends to allowlisted users
- Logs confirmation without sensitive content

## Project Structure

```
clawbot/
├── .env.example
├── mcp.config.json              # MCP server definitions
├── memory/
│   ├── core_memory.md           # User-editable preferences
│   └── soul.md                  # Agent personality
├── scripts/
│   ├── google-auth.ts           # One-time OAuth2 for Calendar
│   └── test-memory.ts           # Mock memory test
└── src/
    ├── index.ts                 # Entry + MCP init + graceful shutdown
    ├── config.ts                # Env loader (all API keys)
    ├── bot.ts                   # Grammy bot + commands
    ├── agent/
    │   ├── loop.ts              # Agentic loop + local/MCP tool routing
    │   └── types.ts             # ToolDefinition, AgentResult
    ├── mcp/
    │   ├── client.ts            # MCP client manager
    │   └── guardrails.ts        # Allowlist, redaction, firewall
    ├── memory/
    │   ├── index.ts             # Memory API
    │   ├── embeddings.ts        # Gemini / mock embeddings
    │   ├── vector-store.ts      # Local JSON vector store
    │   ├── core.ts              # core_memory.md reader
    │   └── log.ts               # Append-only audit log
    ├── tools/
    │   ├── registry.ts          # Tool registry (31 tools)
    │   ├── get-time.ts          # Current time
    │   ├── wikipedia.ts         # Wikipedia search
    │   ├── coingecko.ts         # Crypto prices
    │   ├── weather.ts           # Weather + forecast
    │   ├── exchange.ts          # Currency conversion
    │   ├── news.ts              # News (NewsAPI + GNews)
    │   ├── tmdb.ts              # Movies & TV shows
    │   ├── wolfram.ts           # Wolfram Alpha
    │   ├── spotify.ts           # Spotify search
    │   ├── travel.ts            # Hotels, car rentals, flights
    │   ├── tripadvisor.ts       # Restaurants, attractions
    │   ├── airbnb.ts            # Airbnb listings
    │   ├── todoist.ts           # Task management
    │   ├── github.ts            # GitHub repos & issues
    │   ├── google-maps.ts       # Places, directions, geocoding
    │   ├── youtube.ts           # YouTube search & details
    │   └── google-calendar.ts   # Calendar events (read-only)
    ├── tts/                     # ElevenLabs TTS
    ├── transcription/           # Whisper / mock
    ├── telegram/                # Telegram file download
    └── handlers/                # Voice message handler
```

## Roadmap

- [x] **Level 1** — Foundation (Telegram + Gemini + agent loop)
- [x] **Voice I/O** — Whisper transcription + ElevenLabs TTS
- [x] **Memory** — Local vector store + Gemini embeddings
- [x] **MCP** — Gmail, Calendar, Drive (read-only)
- [x] **31 Tools** — 15+ API integrations (travel, maps, calendar, etc.)
- [x] **Heartbeat** — Proactive daily check-ins (cron)
- [ ] **Level 6** — Multi-modal (image analysis, document parsing)
