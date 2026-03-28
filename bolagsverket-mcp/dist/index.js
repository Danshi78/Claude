"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const tools_js_1 = require("./tools.js");
const server = new index_js_1.Server({ name: "bolagsverket", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "get_company",
            description: "Hämta företagsinformation från Bolagsverket (namn, adress, juridisk form, SNI-kod, registreringsdatum m.m.)",
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
            description: "Hämta personroller (styrelse, VD, revisorer m.m.) kopplade till ett företag",
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
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case "get_company":
                result = await (0, tools_js_1.getCompany)(args?.org_number);
                break;
            case "get_cases":
                result = await (0, tools_js_1.getCases)(args?.org_number, args?.from_date, args?.to_date);
                break;
            case "get_annual_reports":
                result = await (0, tools_js_1.getAnnualReports)(args?.org_number);
                break;
            case "get_person_roles":
                result = await (0, tools_js_1.getPersonRoles)(args?.org_number);
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Fel: ${message}` }],
            isError: true,
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
