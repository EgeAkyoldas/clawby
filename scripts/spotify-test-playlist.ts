import "dotenv/config";

// Test with the token from the Spotify tutorial console
const TUTORIAL_TOKEN = "BQB4SzCtk2G9OcmIVMoc6UeIwSJNsh7SaWy8tWt6EWp72KkewYowmfFuF_P6g8eVNAb6HMweQ4Pri8duFm9rh_EPE4qfG54yYfqEnf9HRDEt-ERJS9tiaJ63ivfGbhVY4aBr0697gzeLFz-Z5wx8FlGT3Arjf27n2Ru0h11i2HV7PkCCMolQGwb8omW5MGnYlam4ZvfpXrrj1Hac8W4cMwA19Q5nk0YPLiKhxNfzxV7g35bOHJiqXw0CjvAUOxzde6aJvPmTvn2wgxDXyPxwZwTQ6htTys6h_GwjbD3AE7Vsfid4VsI";

async function testWithToken(label: string, token: string) {
  console.log(`\n=== ${label} ===`);
  
  // Check who this token belongs to
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    console.log(`/me failed: ${meRes.status} (token expired?)`);
    return;
  }
  const me = await meRes.json() as { id: string; display_name: string; product: string };
  console.log(`User: ${me.display_name} (${me.id}), Product: ${me.product}`);

  // Create playlist
  const createRes = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `_test_${label}`, public: false }),
  });
  console.log(`Create (users/{id}): ${createRes.status}`);
  
  if (createRes.ok) {
    const pl = await createRes.json() as { id: string };
    // Try adding tracks
    const addRes = await fetch(
      `https://api.spotify.com/v1/playlists/${pl.id}/tracks?uris=spotify:track:70LcF31zb1H0PyJoS1Sx1r`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`Add track: ${addRes.status}`);
    // Cleanup
    await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/followers`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  }
}

// Test with our OAuth token
const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
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
const { access_token: ourToken } = await tokenRes.json() as { access_token: string };

await testWithToken("TUTORIAL_TOKEN", TUTORIAL_TOKEN);
await testWithToken("OUR_OAUTH_TOKEN", ourToken);
