import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { getAccessToken } from "./auth.js";

const BASE_URL = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";

async function apiFetch(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} — ${text}`
    );
  }

  return response.json();
}

export async function getCompany(orgNumber: string): Promise<unknown> {
  const normalized = orgNumber.replace(/[-\s]/g, "");
  return apiFetch(`/foretag/${normalized}`);
}

export async function getCases(
  orgNumber: string,
  fromDate?: string,
  toDate?: string
): Promise<unknown> {
  const normalized = orgNumber.replace(/[-\s]/g, "");
  const params = new URLSearchParams({ orgnummer: normalized });
  if (fromDate) params.set("fran", fromDate);
  if (toDate) params.set("till", toDate);
  return apiFetch(`/arenden?${params.toString()}`);
}

export async function getAnnualReports(orgNumber: string): Promise<unknown> {
  const normalized = orgNumber.replace(/[-\s]/g, "");
  return apiFetch(`/arsredovisningar/${normalized}`);
}

export async function getPersonRoles(orgNumber: string): Promise<unknown> {
  const normalized = orgNumber.replace(/[-\s]/g, "");
  return apiFetch(`/personroller/${normalized}`);
}

export async function searchBySni(
  sniCode: string,
  maxResults = 50,
  page = 1
): Promise<unknown> {
  const params = new URLSearchParams({
    sni: sniCode,
    antal: String(maxResults),
    sida: String(page),
  });
  return apiFetch(`/foretag?${params.toString()}`);
}

export interface CompanyRow {
  foretagsnamn: string;
  adress: string;
  telefon: string;
  organisationsnummer: string;
  omsattning_ar1: string;
  omsattning_ar2: string;
  omsattning_ar3: string;
}

export async function getCompanyDetails(
  orgNumber: string
): Promise<CompanyRow> {
  const normalized = orgNumber.replace(/[-\s]/g, "");

  let foretagsnamn = "";
  let adress = "";
  const telefon = "–";

  try {
    const company = (await apiFetch(`/foretag/${normalized}`)) as Record<
      string,
      unknown
    >;
    foretagsnamn = extractString(company, [
      "foretagsnamn",
      "namn",
      "name",
      "firmanamn",
    ]);
    adress = extractAddress(company);
  } catch {
    foretagsnamn = normalized;
  }

  let omsattning_ar1 = "–";
  let omsattning_ar2 = "–";
  let omsattning_ar3 = "–";

  try {
    const reports = (await apiFetch(
      `/arsredovisningar/${normalized}`
    )) as unknown;
    const turnover = extractTurnover(reports);
    omsattning_ar1 = turnover[0] ?? "–";
    omsattning_ar2 = turnover[1] ?? "–";
    omsattning_ar3 = turnover[2] ?? "–";
  } catch {
    // Annual reports not available
  }

  return {
    foretagsnamn,
    adress,
    telefon,
    organisationsnummer: normalized,
    omsattning_ar1,
    omsattning_ar2,
    omsattning_ar3,
  };
}

function extractString(
  obj: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    if (typeof obj[key] === "string" && obj[key]) return obj[key] as string;
  }
  return "";
}

function extractAddress(company: Record<string, unknown>): string {
  // Try nested address object first
  const adressObj = company["adress"] ?? company["besoksadress"] ?? company["postadress"];
  if (adressObj && typeof adressObj === "object") {
    const a = adressObj as Record<string, unknown>;
    const parts = [
      a["co"] ?? a["coAdress"],
      a["gatuadress"] ?? a["utdelningsadress"],
      a["postnummer"],
      a["postort"] ?? a["stad"],
      a["lan"],
    ]
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join(", ");
  }
  // Flat string fallback
  return extractString(company, ["adress", "gatuadress", "postadress"]);
}

function extractTurnover(reports: unknown): string[] {
  if (!reports || typeof reports !== "object") return [];
  const arr = Array.isArray(reports)
    ? reports
    : ((reports as Record<string, unknown>)["arsredovisningar"] as unknown[]) ?? [];
  if (!Array.isArray(arr)) return [];

  return arr
    .slice(0, 3)
    .map((r) => {
      const report = r as Record<string, unknown>;
      const val =
        report["nettoomsattning"] ??
        report["omsattning"] ??
        report["totalOmsattning"] ??
        report["intakter"];
      const year = report["rakenskapsAr"] ?? report["ar"] ?? report["year"];
      if (val != null) return `${year ? year + ": " : ""}${val} kr`;
      return "–";
    });
}

export function createExcel(
  companies: CompanyRow[],
  filename: string
): string {
  const exportDir = path.join(
    path.dirname(path.dirname(new URL(import.meta.url).pathname)),
    "..",
    "exports"
  );
  fs.mkdirSync(exportDir, { recursive: true });

  const rows = [
    [
      "Företagsnamn",
      "Adress",
      "Telefon",
      "Organisationsnummer",
      "Omsättning (senaste)",
      "Omsättning (år 2)",
      "Omsättning (år 3)",
    ],
    ...companies.map((c) => [
      c.foretagsnamn,
      c.adress,
      c.telefon,
      c.organisationsnummer,
      c.omsattning_ar1,
      c.omsattning_ar2,
      c.omsattning_ar3,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 35 },
    { wch: 45 },
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
  ];

  // Bold header row
  for (let col = 0; col < 7; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Företag");

  const safeFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const filePath = path.join(exportDir, safeFilename);
  XLSX.writeFile(wb, filePath);

  return filePath;
}
