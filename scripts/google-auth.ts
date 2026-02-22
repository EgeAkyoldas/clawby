/**
 * One-time script to obtain a Google Calendar OAuth2 refresh token.
 *
 * Usage:  npx tsx scripts/google-auth.ts
 *
 * 1. Opens a browser for Google consent (calendar.readonly scope)
 * 2. Handles the callback on http://localhost:8976/callback
 * 3. Exchanges the auth code for tokens
 * 4. Prints the refresh token to paste into .env
 *
 * After running, add the token to .env:
 *   GOOGLE_CALENDAR_REFRESH_TOKEN=<paste here>
 */
import "dotenv/config";
import { createServer } from "http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 8976;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env");
  process.exit(1);
}

// Step 1: Generate auth URL
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n🔐 Google Calendar OAuth Setup\n");
console.log("1. Open this URL in your browser:\n");
console.log(`   ${authUrl.toString()}\n`);
console.log("2. Sign in and grant calendar read-only access");
console.log("3. You will be redirected — the refresh token will appear here\n");

// Step 2: Start a temporary HTTP server to catch the callback
const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400);
    res.end(`Error: ${error}`);
    console.error(`\n❌ Auth error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter");
    return;
  }

  try {
    // Step 3: Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokens.error) {
      res.writeHead(500);
      res.end(`Token error: ${tokens.error_description || tokens.error}`);
      console.error(`\n❌ Token error: ${tokens.error_description || tokens.error}`);
      server.close();
      process.exit(1);
    }

    if (!tokens.refresh_token) {
      res.writeHead(500);
      res.end("No refresh token received. Try revoking app access at myaccount.google.com/permissions and retry.");
      console.error("\n❌ No refresh token received. Revoke access and retry.");
      server.close();
      process.exit(1);
    }

    // Step 4: Success!
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:system-ui;padding:2em;text-align:center">
        <h1>✅ Success!</h1>
        <p>Refresh token obtained. You can close this tab.</p>
      </body></html>
    `);

    console.log("\n✅ Success! Add this to your .env file:\n");
    console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}\n`);

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end("Internal error");
    console.error("\n❌ Token exchange failed:", err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`⏳ Waiting for callback on http://localhost:${PORT}/callback ...\n`);
});
