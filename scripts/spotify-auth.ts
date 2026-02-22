/**
 * One-time script to obtain a Spotify OAuth2 refresh token.
 *
 * Usage:  npx tsx scripts/spotify-auth.ts
 *
 * Prerequisites:
 *   1. Go to https://developer.spotify.com/dashboard
 *   2. Edit your app settings → add Redirect URI: http://localhost:8976/callback
 *   3. Save
 */
import "dotenv/config";
import { createServer } from "http";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PORT = 8976;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

const SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-recently-played",
  "user-top-read",
  "user-library-read",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env");
  process.exit(1);
}

const authUrl = new URL("https://accounts.spotify.com/authorize");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("show_dialog", "true");

console.log("\n🎵 Spotify OAuth Setup\n");
console.log("1. Open this URL in your browser:\n");
console.log(`   ${authUrl.toString()}\n`);
console.log("2. Log in and approve access");
console.log("3. The refresh token will appear here\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") { res.writeHead(404); res.end("Not found"); return; }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400); res.end(`Error: ${error || "no code"}`);
    console.error(`\n❌ Auth error: ${error || "no code"}`);
    server.close(); process.exit(1);
  }

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
    });

    const tokens = (await tokenRes.json()) as {
      access_token?: string; refresh_token?: string;
      error?: string; error_description?: string;
    };

    if (tokens.error || !tokens.refresh_token) {
      res.writeHead(500); res.end(`Token error: ${tokens.error_description || tokens.error || "no refresh token"}`);
      console.error(`\n❌ ${tokens.error_description || tokens.error || "No refresh token"}`);
      server.close(); process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body style="font-family:system-ui;padding:2em;text-align:center">
      <h1>✅ Spotify Connected!</h1><p>You can close this tab.</p></body></html>`);

    console.log("\n✅ Success! Add this to your .env file:\n");
    console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    server.close(); process.exit(0);
  } catch (err) {
    res.writeHead(500); res.end("Internal error");
    console.error("\n❌ Token exchange failed:", err);
    server.close(); process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`⏳ Waiting for callback on http://localhost:${PORT}/callback ...\n`);
});
