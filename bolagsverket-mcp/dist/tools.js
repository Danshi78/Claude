"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompany = getCompany;
exports.getCases = getCases;
exports.getAnnualReports = getAnnualReports;
exports.getPersonRoles = getPersonRoles;
const auth_js_1 = require("./auth.js");
const BASE_URL = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";
async function apiFetch(path) {
    const token = await (0, auth_js_1.getAccessToken)();
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} — ${text}`);
    }
    return response.json();
}
async function getCompany(orgNumber) {
    const normalized = orgNumber.replace(/[-\s]/g, "");
    return apiFetch(`/foretag/${normalized}`);
}
async function getCases(orgNumber, fromDate, toDate) {
    const normalized = orgNumber.replace(/[-\s]/g, "");
    const params = new URLSearchParams({ orgnummer: normalized });
    if (fromDate)
        params.set("fran", fromDate);
    if (toDate)
        params.set("till", toDate);
    return apiFetch(`/arenden?${params.toString()}`);
}
async function getAnnualReports(orgNumber) {
    const normalized = orgNumber.replace(/[-\s]/g, "");
    return apiFetch(`/arsredovisningar/${normalized}`);
}
async function getPersonRoles(orgNumber) {
    const normalized = orgNumber.replace(/[-\s]/g, "");
    return apiFetch(`/personroller/${normalized}`);
}
