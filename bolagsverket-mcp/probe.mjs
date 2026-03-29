/**
 * Probe-skript: Testa vilka endpoints som finns i Bolagsverket API.
 * Kör med: node probe.mjs
 */
const CLIENT_ID = process.env.BOLAGSVERKET_CLIENT_ID ?? "ljhOjEJt_UAbgtJcyPrwc3iO6Vca";
const CLIENT_SECRET = process.env.BOLAGSVERKET_CLIENT_SECRET ?? "HxQqAj5kP1C5yKjddYjTe0hX1dAa";
const TOKEN_URL = "https://portal.api.bolagsverket.se/oauth2/token";
const BASE_URL = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";

async function getToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET }).toString()
  });
  if (!res.ok) { console.error("Token failed:", res.status, await res.text()); process.exit(1); }
  const data = await res.json();
  console.log("✅ Token OK\n");
  return data.access_token;
}

async function probe(token, label, path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    const text = await res.text();
    const preview = text.substring(0, 150).replace(/\n/g, " ");
    console.log(`[${res.status}] ${label}`);
    console.log(`       ${preview}`);
  } catch (e) {
    console.log(`[ERR] ${label}: ${e.message}`);
  }
  console.log();
}

const token = await getToken();

// Prova paginerade listningar
await probe(token, "Lista alla företag (sida 1)",      "/foretag?antal=3&sida=1");
await probe(token, "Lista med SNI-filter 47.11",        "/foretag?sni=47.11&antal=3");
await probe(token, "Lista med SNI-filter 4711",         "/foretag?sni=4711&antal=3");
await probe(token, "Lista med snikod-filter",           "/foretag?snikod=47.11&antal=3");
await probe(token, "Lista med branschkod-filter",       "/foretag?branschkod=47.11&antal=3");

// Prova sök-endpoints
await probe(token, "Sök endpoint",                      "/sok?sni=47.11&antal=3");
await probe(token, "Sökning via /search",               "/search?sni=47.11&antal=3");
await probe(token, "Förelagslista endpoint",            "/foretagslista?sni=47.11&antal=3");

// Prova bulk/export
await probe(token, "Bulk endpoint",                     "/bulk");
await probe(token, "Export endpoint",                   "/export");
await probe(token, "Download endpoint",                 "/download");

// Prova API root (visar kanske tillgängliga resurser)
await probe(token, "API root",                          "");
await probe(token, "API root med slash",                "/");

console.log("Klar! Klistra in utdatan ovan.");
