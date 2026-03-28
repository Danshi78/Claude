import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getCompany,
  getCases,
  getAnnualReports,
  getPersonRoles,
  searchBySni,
  getCompanyDetails,
  createExcel,
  type CompanyRow,
} from "./tools.js";

const server = new Server(
  { name: "bolagsverket", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_company",
      description:
        "Hämta företagsinformation från Bolagsverket (namn, adress, juridisk form, SNI-kod, registreringsdatum m.m.)",
      inputSchema: {
        type: "object",
        properties: {
          org_number: {
            type: "string",
            description: "Organisationsnummer, t.ex. 556746-0327 eller 5567460327",
          },
        },
        required: ["org_number"],
      },
    },
    {
      name: "get_cases",
      description: "Hämta ärenden kopplade till ett företag hos Bolagsverket",
      inputSchema: {
        type: "object",
        properties: {
          org_number: { type: "string", description: "Organisationsnummer" },
          from_date: { type: "string", description: "Startdatum (YYYY-MM-DD), valfritt" },
          to_date: { type: "string", description: "Slutdatum (YYYY-MM-DD), valfritt" },
        },
        required: ["org_number"],
      },
    },
    {
      name: "get_annual_reports",
      description: "Hämta årsredovisningar för ett företag från Bolagsverket",
      inputSchema: {
        type: "object",
        properties: {
          org_number: { type: "string", description: "Organisationsnummer" },
        },
        required: ["org_number"],
      },
    },
    {
      name: "get_person_roles",
      description: "Hämta personroller (styrelse, VD, revisorer m.m.) kopplade till ett företag",
      inputSchema: {
        type: "object",
        properties: {
          org_number: { type: "string", description: "Organisationsnummer" },
        },
        required: ["org_number"],
      },
    },
    {
      name: "search_by_sni",
      description:
        "Sök företag hos Bolagsverket baserat på SNI-kod (branschkod). Returnerar lista med org-nummer och företagsnamn.",
      inputSchema: {
        type: "object",
        properties: {
          sni_code: {
            type: "string",
            description: "SNI-kod, t.ex. '10.71' för bagerier eller '47.11' för dagligvaruhandel",
          },
          max_results: {
            type: "number",
            description: "Max antal resultat (standard 50)",
          },
          page: {
            type: "number",
            description: "Sidnummer för paginering (standard 1)",
          },
        },
        required: ["sni_code"],
      },
    },
    {
      name: "get_company_details",
      description:
        "Hämta sammanställd företagsinformation inkl. omsättning senaste 3 åren. Används för Excel-export.",
      inputSchema: {
        type: "object",
        properties: {
          org_number: { type: "string", description: "Organisationsnummer" },
        },
        required: ["org_number"],
      },
    },
    {
      name: "create_excel",
      description:
        "Skapa en Excel-fil med företagslista. Kolumner: Företagsnamn, Adress, Telefon, Org-nummer, Omsättning (3 år).",
      inputSchema: {
        type: "object",
        properties: {
          companies: {
            type: "array",
            description: "Array med företagsdata (från get_company_details)",
            items: {
              type: "object",
              properties: {
                foretagsnamn: { type: "string" },
                adress: { type: "string" },
                telefon: { type: "string" },
                organisationsnummer: { type: "string" },
                omsattning_ar1: { type: "string" },
                omsattning_ar2: { type: "string" },
                omsattning_ar3: { type: "string" },
              },
              required: ["foretagsnamn", "organisationsnummer"],
            },
          },
          filename: {
            type: "string",
            description: "Filnamn utan filändelse, t.ex. 'bagerier-10.71'",
          },
        },
        required: ["companies", "filename"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "get_company":
        result = await getCompany(args?.org_number as string);
        break;
      case "get_cases":
        result = await getCases(
          args?.org_number as string,
          args?.from_date as string | undefined,
          args?.to_date as string | undefined
        );
        break;
      case "get_annual_reports":
        result = await getAnnualReports(args?.org_number as string);
        break;
      case "get_person_roles":
        result = await getPersonRoles(args?.org_number as string);
        break;
      case "search_by_sni":
        result = await searchBySni(
          args?.sni_code as string,
          args?.max_results as number | undefined,
          args?.page as number | undefined
        );
        break;
      case "get_company_details":
        result = await getCompanyDetails(args?.org_number as string);
        break;
      case "create_excel": {
        const filePath = createExcel(
          args?.companies as CompanyRow[],
          args?.filename as string
        );
        result = { filePath, message: `Excel-fil skapad: ${filePath}` };
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Fel: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
