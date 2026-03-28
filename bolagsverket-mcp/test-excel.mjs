/**
 * Testskript: Hämta bagerier (SNI 10.71) från Bolagsverket och skapa Excel.
 * Kör med: node test-excel.mjs
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.BOLAGSVERKET_CLIENT_ID ?? "ljhOjEJt_UAbgtJcyPrwc3iO6Vca";
const CLIENT_SECRET = process.env.BOLAGSVERKET_CLIENT_SECRET ?? "HxQqAj5kP1C5yKjddYjTe0hX1dAa";
const BASE_URL = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";
const TOKEN_URL = "https://gw.api.bolagsverket.se/token";

let cachedToken = null;

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

async function api(path) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function extractAddress(company) {
  const a = company?.adress ?? company?.besoksadress ?? company?.postadress;
  if (a && typeof a === "object") {
    return [a.co ?? a.coAdress, a.gatuadress ?? a.utdelningsadress, a.postnummer, a.postort ?? a.stad]
      .filter(Boolean).join(", ");
  }
  return company?.adress ?? "";
}

function extractTurnover(reports) {
  const arr = Array.isArray(reports) ? reports : reports?.arsredovisningar ?? [];
  return arr.slice(0, 3).map(r => {
    const val = r?.nettoomsattning ?? r?.omsattning ?? r?.totalOmsattning;
    const year = r?.rakenskapsAr ?? r?.ar ?? r?.year;
    return val != null ? `${year ? year + ": " : ""}${val} kr` : "–";
  });
}

async function getDetails(orgNr) {
  const normalized = orgNr.replace(/[-\s]/g, "");
  let foretagsnamn = normalized, adress = "", telefon = "–";
  let oms = ["–", "–", "–"];

  try {
    const c = await api(`/foretag/${normalized}`);
    foretagsnamn = c?.foretagsnamn ?? c?.namn ?? c?.name ?? normalized;
    adress = extractAddress(c);
  } catch (e) {
    console.warn(`  ⚠ Företagsinfo saknas för ${normalized}: ${e.message}`);
  }

  try {
    const r = await api(`/arsredovisningar/${normalized}`);
    oms = extractTurnover(r);
    while (oms.length < 3) oms.push("–");
  } catch {
    // Ingen årsredovisning
  }

  return { foretagsnamn, adress, telefon, organisationsnummer: normalized, oms };
}

async function main() {
  const SNI = "10.71";
  console.log(`\n🔍 Söker bagerier (SNI ${SNI}) från Bolagsverket...\n`);

  let companies = [];
  try {
    const result = await api(`/foretag?sni=${SNI}&antal=30&sida=1`);
    const list = Array.isArray(result) ? result
      : result?.foretag ?? result?.companies ?? result?.items ?? [];
    console.log(`✅ Hittade ${list.length} företag via SNI-sökning\n`);
    companies = list;
  } catch (e) {
    console.warn(`⚠ SNI-sökning misslyckades: ${e.message}`);
    console.log("📋 Använder demo-data för Excel-test...\n");
    companies = [
      { organisationsnummer: "5566473143", foretagsnamn: "Levain Bageri AB" },
      { organisationsnummer: "5591234567", foretagsnamn: "Surdegsbageriet i Stockholm AB" },
      { organisationsnummer: "5569876543", foretagsnamn: "Konditori Bakken AB" },
      { organisationsnummer: "5563456789", foretagsnamn: "Pågens AB" },
      { organisationsnummer: "5557654321", foretagsnamn: "Skogaholms Bröd AB" },
    ];
  }

  console.log("📦 Hämtar detaljer per företag...");
  const rows = [];
  for (const c of companies.slice(0, 20)) {
    const orgNr = c?.organisationsnummer ?? c?.orgnummer ?? c?.org_number ?? c;
    if (!orgNr || typeof orgNr !== "string") continue;
    process.stdout.write(`  → ${orgNr} `);
    try {
      const details = await getDetails(orgNr);
      rows.push(details);
      console.log(`✓ ${details.foretagsnamn}`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
    // Rate limiting: max 60 req/min
    await new Promise(r => setTimeout(r, 150));
  }

  // Skapa Excel
  const exportDir = path.join(__dirname, "..", "exports");
  fs.mkdirSync(exportDir, { recursive: true });

  const wsData = [
    ["Företagsnamn", "Adress", "Telefon", "Organisationsnummer",
     "Omsättning (senaste)", "Omsättning (år 2)", "Omsättning (år 3)"],
    ...rows.map(r => [
      r.foretagsnamn, r.adress, r.telefon, r.organisationsnummer,
      r.oms[0], r.oms[1], r.oms[2]
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 35 }, { wch: 45 }, { wch: 16 }, { wch: 20 },
    { wch: 22 }, { wch: 22 }, { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bagerier");

  const outPath = path.join(exportDir, `bagerier-${SNI}.xlsx`);
  XLSX.writeFile(wb, outPath);

  console.log(`\n✅ Excel skapad: ${outPath}`);
  console.log(`   Antal rader: ${rows.length} företag\n`);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
