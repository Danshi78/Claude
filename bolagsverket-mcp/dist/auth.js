"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
const TOKEN_URL = "https://gw.api.bolagsverket.se/token";
let cachedToken = null;
async function getAccessToken() {
    const now = Date.now();
    // Return cached token if still valid (with 60s margin)
    if (cachedToken && cachedToken.expiresAt > now + 60000) {
        return cachedToken.accessToken;
    }
    const clientId = process.env.BOLAGSVERKET_CLIENT_ID;
    const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("BOLAGSVERKET_CLIENT_ID and BOLAGSVERKET_CLIENT_SECRET must be set");
    }
    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
    });
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token request failed: ${response.status} ${response.statusText} — ${text}`);
    }
    const data = (await response.json());
    cachedToken = {
        accessToken: data.access_token,
        expiresAt: now + data.expires_in * 1000,
    };
    return cachedToken.accessToken;
}
