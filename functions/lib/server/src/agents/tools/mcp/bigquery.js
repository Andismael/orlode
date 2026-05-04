"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIGQUERY_TOOLS = exports.bigqueryDescribeSchemaTool = exports.bigqueryListTablesTool = exports.bigqueryExecuteQueryTool = void 0;
/**
 * BigQuery MCP — Genkit Tool Wrappers (Phase 4)
 *
 * Recommended server: official Google Cloud BigQuery MCP
 * Used by: Q&A Agent (data queries), Insights Agent (trend analysis)
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../../config/genkit.config");
const mcp_config_1 = require("../../../config/mcp.config");
async function bq(tool, args) {
    if (!mcp_config_1.mcpAvailability.bigquery) {
        throw new Error('BigQuery MCP server is not available. Set BIGQUERY_MCP_URL in .env.');
    }
    return (0, mcp_config_1.callMcpTool)(mcp_config_1.MCP_SERVERS.bigquery, tool, args, (0, mcp_config_1.googleAuthHeaders)());
}
exports.bigqueryExecuteQueryTool = genkit_config_1.ai.defineTool({
    name: 'bigquery_execute_query',
    description: 'Execute a BigQuery SQL query on business data. Returns results as rows. Use for trend analysis, KPI lookups, or complex data questions.',
    inputSchema: zod_1.z.object({
        sql: zod_1.z.string().describe('BigQuery SQL query'),
        projectId: zod_1.z.string().optional().describe('GCP project ID (uses default if omitted)'),
        maxRows: zod_1.z.number().optional().default(100),
    }),
    outputSchema: zod_1.z.object({
        rows: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())),
        schema: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), type: zod_1.z.string() })),
        rowCount: zod_1.z.number(),
    }),
}, async (args) => {
    const result = await bq('execute_query', args);
    return result;
});
exports.bigqueryListTablesTool = genkit_config_1.ai.defineTool({
    name: 'bigquery_list_tables',
    description: 'List available BigQuery tables and datasets for the project.',
    inputSchema: zod_1.z.object({
        projectId: zod_1.z.string().optional(),
        datasetId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        tables: zod_1.z.array(zod_1.z.object({
            tableId: zod_1.z.string(),
            datasetId: zod_1.z.string(),
            projectId: zod_1.z.string(),
            type: zod_1.z.string(),
        })),
    }),
}, async (args) => {
    const result = await bq('list_tables', args);
    return result;
});
exports.bigqueryDescribeSchemaTool = genkit_config_1.ai.defineTool({
    name: 'bigquery_describe_schema',
    description: 'Get the schema (columns and types) of a BigQuery table.',
    inputSchema: zod_1.z.object({
        tableId: zod_1.z.string(),
        datasetId: zod_1.z.string(),
        projectId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        fields: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            type: zod_1.z.string(),
            mode: zod_1.z.string(),
            description: zod_1.z.string().optional(),
        })),
    }),
}, async (args) => {
    const result = await bq('describe_schema', args);
    return result;
});
exports.BIGQUERY_TOOLS = [
    exports.bigqueryExecuteQueryTool,
    exports.bigqueryListTablesTool,
    exports.bigqueryDescribeSchemaTool,
];
//# sourceMappingURL=bigquery.js.map