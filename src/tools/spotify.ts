import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

// ── Client Credentials token (public search) ──────────────

let cachedClientToken: { token: string; expires: number } | null = null;

async function getClientToken(): Promise<string | null> {
  if (!config.spotifyClientId || !config.spotifyClientSecret) return null;
  if (cachedClientToken && Date.now() < cachedClientToken.expires) return cachedClientToken.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedClientToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedClientToken.token;
}

// ── User token (account access via refresh token) ─────────

let cachedUserToken: { token: string; expires: number } | null = null;

async function getUserToken(): Promise<string | null> {
  if (!config.spotifyClientId || !config.spotifyClientSecret || !config.spotifyRefreshToken) return null;
  if (cachedUserToken && Date.now() < cachedUserToken.expires) return cachedUserToken.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.spotifyRefreshToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedUserToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedUserToken.token;
}

/** Get best available token — user if available, else client */
async function getToken(): Promise<string | null> {
  return (await getUserToken()) || (await getClientToken());
}

function noUserToken(): string {
  return JSON.stringify({ error: "Spotify user not connected. Run: npx tsx scripts/spotify-auth.ts" });
}

// ── Search (public, works with client credentials) ────────

async function searchSpotify(query: string, type: string = "track"): Promise<string> {
  const token = await getToken();
  if (!token) return JSON.stringify({ error: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not configured" });

  const url = `${API}/search?q=${encodeURIComponent(query)}&type=${type}&limit=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return JSON.stringify({ error: `Spotify error: ${res.status}` });

  const data = (await res.json()) as Record<string, { items: Array<Record<string, unknown>> }>;
  const items = data[`${type}s`]?.items || [];

  return JSON.stringify(items.map((item: Record<string, unknown>) => {
    if (type === "track") {
      const t = item as { name: string; uri: string; artists: Array<{ name: string }>; album: { name: string }; external_urls: { spotify: string }; duration_ms: number };
      return { name: t.name, uri: t.uri, artists: t.artists.map((a) => a.name).join(", "), album: t.album.name, duration: `${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, "0")}`, url: t.external_urls.spotify };
    }
    if (type === "artist") {
      const a = item as { name: string; genres: string[]; followers: { total: number }; external_urls: { spotify: string }; popularity: number };
      return { name: a.name, genres: a.genres.slice(0, 3), followers: a.followers.total, popularity: a.popularity, url: a.external_urls.spotify };
    }
    if (type === "album") {
      const al = item as { name: string; artists: Array<{ name: string }>; release_date: string; total_tracks: number; external_urls: { spotify: string } };
      return { name: al.name, artists: al.artists.map((a) => a.name).join(", "), release_date: al.release_date, total_tracks: al.total_tracks, url: al.external_urls.spotify };
    }
    if (type === "playlist") {
      const pl = item as { name: string; description: string; owner: { display_name: string }; tracks: { total: number }; external_urls: { spotify: string } };
      return { name: pl.name, description: pl.description?.slice(0, 100), owner: pl.owner.display_name, tracks: pl.tracks.total, url: pl.external_urls.spotify };
    }
    return item;
  }));
}

// ── User Library ──────────────────────────────────────────

async function getMyPlaylists(): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(`${API}/me/playlists?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return JSON.stringify({ error: `Spotify error: ${res.status}` });

  const data = (await res.json()) as { items: Array<{ name: string; id: string; tracks: { total: number }; public: boolean; external_urls: { spotify: string } }> };
  console.log(`  🎵 Spotify: ${data.items.length} playlist(s)`);

  return JSON.stringify(data.items.map((p) => ({
    name: p.name, id: p.id, tracks: p.tracks.total, public: p.public, url: p.external_urls.spotify,
  })));
}

async function getNowPlaying(): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(`${API}/me/player/currently-playing`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 204) return JSON.stringify({ message: "Nothing is currently playing." });
  if (!res.ok) return JSON.stringify({ error: `Spotify error: ${res.status}` });

  const data = (await res.json()) as {
    is_playing: boolean;
    item?: { name: string; artists: Array<{ name: string }>; album: { name: string }; external_urls: { spotify: string }; duration_ms: number };
    progress_ms?: number;
  };

  if (!data.item) return JSON.stringify({ message: "Nothing is currently playing." });

  const t = data.item;
  const progress = data.progress_ms || 0;
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

  return JSON.stringify({
    is_playing: data.is_playing,
    track: t.name,
    artists: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    progress: `${fmt(progress)} / ${fmt(t.duration_ms)}`,
    url: t.external_urls.spotify,
  });
}

async function getTopTracks(timeRange: string = "medium_term"): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(`${API}/me/top/tracks?limit=10&time_range=${timeRange}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return JSON.stringify({ error: `Spotify error: ${res.status}` });

  const data = (await res.json()) as { items: Array<{ name: string; artists: Array<{ name: string }>; album: { name: string }; external_urls: { spotify: string } }> };
  return JSON.stringify(data.items.map((t, i) => ({
    rank: i + 1, name: t.name, artists: t.artists.map((a) => a.name).join(", "), album: t.album.name, url: t.external_urls.spotify,
  })));
}

async function getRecentlyPlayed(): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(`${API}/me/player/recently-played?limit=10`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return JSON.stringify({ error: `Spotify error: ${res.status}` });

  const data = (await res.json()) as { items: Array<{ track: { name: string; artists: Array<{ name: string }>; external_urls: { spotify: string } }; played_at: string }> };
  return JSON.stringify(data.items.map((item) => ({
    track: item.track.name,
    artists: item.track.artists.map((a) => a.name).join(", "),
    played_at: new Date(item.played_at).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    url: item.track.external_urls.spotify,
  })));
}

async function createPlaylist(name: string, description: string, trackUris: string[]): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  // Create playlist using /me/playlists (works in Development Mode)
  const playlistBody: Record<string, unknown> = { name, public: false };
  if (description) playlistBody.description = description;

  const createRes = await fetch(`${API}/me/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(playlistBody),
  });
  if (!createRes.ok) {
    const errBody = await createRes.text();
    console.error(`  ❌ Playlist create ${createRes.status}:`, errBody.slice(0, 300));
    return JSON.stringify({ error: `Failed to create playlist: ${createRes.status}`, details: errBody.slice(0, 200) });
  }
  const playlist = (await createRes.json()) as { id: string; external_urls: { spotify: string } };

  // Add tracks if provided — use query params (Spotify tutorial format)
  if (trackUris.length > 0) {
    console.log(`  🎵 Adding ${trackUris.length} track(s) to playlist...`);
    const addRes = await fetch(
      `${API}/playlists/${playlist.id}/tracks?uris=${trackUris.join(",")}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!addRes.ok) {
      console.error(`  ⚠️ Track add ${addRes.status} — tracks must be added manually`);
      return JSON.stringify({
        success: true,
        name,
        tracks_added: 0,
        tracks_failed: trackUris.length,
        url: playlist.external_urls.spotify,
        note: "Playlist created but tracks could not be added automatically. Open the playlist link to add tracks manually.",
        track_uris: trackUris,
      });
    }
    console.log(`  ✅ ${trackUris.length} track(s) added successfully`);
  }

  console.log(`  🎵 Created playlist "${name}" with ${trackUris.length} track(s)`);
  return JSON.stringify({ success: true, name, tracks_added: trackUris.length, url: playlist.external_urls.spotify });
}

async function addToPlaylist(playlistId: string, trackUris: string[]): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(
    `${API}/playlists/${playlistId}/tracks?uris=${trackUris.join(",")}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return JSON.stringify({ error: `Failed to add tracks: ${res.status}` });

  console.log(`  🎵 Added ${trackUris.length} track(s) to playlist ${playlistId}`);
  return JSON.stringify({ success: true, tracks_added: trackUris.length });
}
// ── Playback Control ──────────────────────────────────────

async function playTrack(trackUri?: string, contextUri?: string): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const body: Record<string, unknown> = {};
  if (contextUri) {
    body.context_uri = contextUri;
  } else if (trackUri) {
    body.uris = [trackUri];
  }

  const res = await fetch(`${API}/me/player/play`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) return JSON.stringify({ error: "Spotify token expired or missing playback scope. Re-run: npx tsx scripts/spotify-auth.ts" });
  if (res.status === 404) return JSON.stringify({ error: "No active Spotify device found. Open Spotify on any device first." });
  if (res.status === 403) return JSON.stringify({ error: "Spotify Premium is required for playback control." });
  if (!res.ok) return JSON.stringify({ error: `Playback error: ${res.status}` });

  console.log(`  🎵 Playing ${trackUri || contextUri || "resumed"}`);
  return JSON.stringify({ success: true, action: "playing" });
}

async function pausePlayback(): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(`${API}/me/player/pause`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return JSON.stringify({ error: "No active Spotify device found." });
  if (res.status === 403) return JSON.stringify({ error: "Spotify Premium required." });
  if (!res.ok) return JSON.stringify({ error: `Pause error: ${res.status}` });

  return JSON.stringify({ success: true, action: "paused" });
}

async function skipTrack(direction: "next" | "previous" = "next"): Promise<string> {
  const token = await getUserToken();
  if (!token) return noUserToken();

  const res = await fetch(`${API}/me/player/${direction}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return JSON.stringify({ error: "No active Spotify device found." });
  if (res.status === 403) return JSON.stringify({ error: "Spotify Premium required." });
  if (!res.ok) return JSON.stringify({ error: `Skip error: ${res.status}` });

  return JSON.stringify({ success: true, action: direction === "next" ? "skipped_to_next" : "skipped_to_previous" });
}

// ── Tool Definitions ──────────────────────────────────────

export const spotifySearchTool: ToolDefinition = {
  declaration: {
    name: "search_spotify",
    description: "Search Spotify for tracks, artists, albums, or playlists. Returns top 5 results with links.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Search query (e.g. 'Daft Punk', 'lo-fi hip hop playlist')" },
        type: { type: SchemaType.STRING, description: "'track', 'artist', 'album', or 'playlist'. Default: 'track'" },
      },
      required: ["query"],
    },
  },
  execute: async (args) => searchSpotify(args.query as string, (args.type as string) || "track"),
};

export const spotifyMyPlaylistsTool: ToolDefinition = {
  declaration: {
    name: "spotify_my_playlists",
    description: "List the user's Spotify playlists (up to 20). Shows name, track count, and link.",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
  },
  execute: async () => getMyPlaylists(),
};

export const spotifyNowPlayingTool: ToolDefinition = {
  declaration: {
    name: "spotify_now_playing",
    description: "Get the user's currently playing track on Spotify. Shows track, artist, album, and progress.",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
  },
  execute: async () => getNowPlaying(),
};

export const spotifyTopTracksTool: ToolDefinition = {
  declaration: {
    name: "spotify_top_tracks",
    description: "Get the user's top 10 most listened tracks on Spotify.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        time_range: { type: SchemaType.STRING, description: "'short_term' (last 4 weeks), 'medium_term' (last 6 months, default), or 'long_term' (all time)" },
      },
      required: [],
    },
  },
  execute: async (args) => getTopTracks((args.time_range as string) || "medium_term"),
};

export const spotifyRecentTool: ToolDefinition = {
  declaration: {
    name: "spotify_recently_played",
    description: "Get the user's 10 most recently played tracks on Spotify.",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
  },
  execute: async () => getRecentlyPlayed(),
};

export const spotifyCreatePlaylistTool: ToolDefinition = {
  declaration: {
    name: "spotify_create_playlist",
    description: "Create a new Spotify playlist on the user's account. Optionally add tracks by their Spotify URIs (format: spotify:track:TRACKID). First search for tracks to get their URIs.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Playlist name" },
        description: { type: SchemaType.STRING, description: "Playlist description" },
        track_uris: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Array of Spotify track URIs to add (e.g. ['spotify:track:abc123']). Get these from search_spotify results." },
      },
      required: ["name"],
    },
  },
  execute: async (args) => createPlaylist(
    args.name as string,
    (args.description as string) || "",
    (args.track_uris as string[]) || [],
  ),
};

export const spotifyAddToPlaylistTool: ToolDefinition = {
  declaration: {
    name: "spotify_add_to_playlist",
    description: "Add tracks to an existing Spotify playlist. Use spotify_my_playlists to get playlist IDs, and search_spotify to get track URIs.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        playlist_id: { type: SchemaType.STRING, description: "Spotify playlist ID" },
        track_uris: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Array of Spotify track URIs to add" },
      },
      required: ["playlist_id", "track_uris"],
    },
  },
  execute: async (args) => addToPlaylist(args.playlist_id as string, args.track_uris as string[]),
};

export const spotifyPlayTool: ToolDefinition = {
  declaration: {
    name: "spotify_play",
    description: "Play a track on Spotify. Provide a track_uri (spotify:track:ID) to play a specific track, or call with no args to resume playback. First use search_spotify to find the track URI. Requires Spotify Premium and an active device.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        track_uri: { type: SchemaType.STRING, description: "Spotify track URI (e.g. 'spotify:track:abc123'). Get from search_spotify. Omit to resume." },
        context_uri: { type: SchemaType.STRING, description: "Spotify context URI for album/playlist (e.g. 'spotify:album:xyz' or 'spotify:playlist:xyz')" },
      },
      required: [],
    },
  },
  execute: async (args) => playTrack(args.track_uri as string | undefined, args.context_uri as string | undefined),
};

export const spotifyPauseTool: ToolDefinition = {
  declaration: {
    name: "spotify_pause",
    description: "Pause the currently playing track on Spotify. Requires Spotify Premium.",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
  },
  execute: async () => pausePlayback(),
};

export const spotifySkipTool: ToolDefinition = {
  declaration: {
    name: "spotify_skip",
    description: "Skip to the next or previous track on Spotify. Requires Spotify Premium.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        direction: { type: SchemaType.STRING, description: "'next' (default) or 'previous'" },
      },
      required: [],
    },
  },
  execute: async (args) => skipTrack((args.direction as "next" | "previous") || "next"),
};
