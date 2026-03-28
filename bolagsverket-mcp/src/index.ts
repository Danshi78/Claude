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
} from "./tools.js";

const server = new Server(
  { name: "bolagsverket", version: "1.0.0" },
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
          org_number: {
            type: "string",
            description: "Organisationsnummer",
          },
          from_date: {
            type: "string",
            description: "Startdatum (YYYY-MM-DD), valfritt",
          },
          to_date: {
            type: "string",
            description: "Slutdatum (YYYY-MM-DD), valfritt",
          },
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
          org_number: {
            type: "string",
            description: "Organisationsnummer",
          },
        },
        required: ["org_number"],
      },
    },
    {
      name: "get_person_roles",
      description:
        "Hämta personroller (styrelse, VD, revisorer m.m.) kopplade till ett företag",
      inputSchema: {
        type: "object",
        properties: {
          org_number: {
            type: "string",
            description: "Organisationsnummer",
          },
        },
        required: ["org_number"],
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
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
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
