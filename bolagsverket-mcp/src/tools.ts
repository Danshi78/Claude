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
