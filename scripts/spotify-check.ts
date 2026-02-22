import "dotenv/config";

async function checkScopes() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN!,
    }),
  });

  const data = await res.json() as { scope?: string; access_token?: string; error?: string };

  if (data.error) {
    console.error("❌ Error:", data.error);
    return;
  }

  console.log("\n🔍 Spotify Token Scopes:\n");
  const scopes = (data.scope || "").split(" ");
  scopes.forEach((s: string) => console.log(`  ✅ ${s}`));

  // Check critical scopes
  const needed = ["playlist-modify-public", "playlist-modify-private", "user-modify-playback-state"];
  const missing = needed.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    console.log("\n❌ MISSING critical scopes:");
    missing.forEach((s) => console.log(`  ⚠️  ${s}`));
    console.log("\n→ Remove app at https://www.spotify.com/account/apps/ then re-auth");
  } else {
    console.log("\n✅ All critical scopes present!");
  }

  // Quick test: try to create a playlist
  if (data.access_token) {
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const me = await meRes.json() as { id: string; display_name: string; product: string };
    console.log(`\n👤 Logged in as: ${me.display_name} (${me.id})`);
    console.log(`   Plan: ${me.product}`);
  }
}

checkScopes();
