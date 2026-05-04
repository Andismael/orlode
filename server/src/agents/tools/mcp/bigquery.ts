/**
 * BigQuery MCP — Genkit Tool Wrappers (Phase 4)
 *
 * Recommended server: official Google Cloud BigQuery MCP
 * Used by: Q&A Agent (data queries), Insights Agent (trend analysis)
 */
import { z } from 'zod';
import { ai } from '../../../config/genkit.config';
import {
  MCP_SERVERS,
  callMcpTool,
  googleAuthHeaders,
  mcpAvailability,
} from '../../../config/mcp.config';

async function bq(tool: string, args: Record<string, unknown>): Promise<unknown> {
  if (!mcpAvailability.bigquery) {
    throw new Error('BigQuery MCP server is not available. Set BIGQUERY_MCP_URL in .env.');
  }
  return callMcpTool(MCP_SERVERS.bigquery!, tool, args, googleAuthHeaders());
}

export const bigqueryExecuteQueryTool = ai.defineTool(
  {
    name: 'bigquery_execute_query',
    description: 'Execute a BigQuery SQL query on business data. Returns results as rows. Use for trend analysis, KPI lookups, or complex data questions.',
    inputSchema: z.object({
      sql:       z.string().describe('BigQuery SQL query'),
      projectId: z.string().optional().describe('GCP project ID (uses default if omitted)'),
      maxRows:   z.number().optional().default(100),
    }),
    outputSchema: z.object({
      rows:     z.array(z.record(z.unknown())),
      schema:   z.array(z.object({ name: z.string(), type: z.string() })),
      rowCount: z.number(),
    }),
  },
  async (args) => {
    const result = await bq('execute_query', args as Record<string, unknown>);
    return result as { rows: Record<string, unknown>[]; schema: Array<{ name: string; type: string }>; rowCount: number };
  }
);

export const bigqueryListTablesTool = ai.defineTool(
  {
    name: 'bigquery_list_tables',
    description: 'List available BigQuery tables and datasets for the project.',
    inputSchema: z.object({
      projectId: z.string().optional(),
      datasetId: z.string().optional(),
    }),
    outputSchema: z.object({
      tables: z.array(z.object({
        tableId:   z.string(),
        datasetId: z.string(),
        projectId: z.string(),
        type:      z.string(),
      })),
    }),
  },
  async (args) => {
    const result = await bq('list_tables', args as Record<string, unknown>);
    return result as { tables: Array<{ tableId: string; datasetId: string; projectId: string; type: string }> };
  }
);

export const bigqueryDescribeSchemaTool = ai.defineTool(
  {
    name: 'bigquery_describe_schema',
    description: 'Get the schema (columns and types) of a BigQuery table.',
    inputSchema: z.object({
      tableId:   z.string(),
      datasetId: z.string(),
      projectId: z.string().optional(),
    }),
    outputSchema: z.object({
      fields: z.array(z.object({
        name: z.string(),
        type: z.string(),
        mode: z.string(),
        description: z.string().optional(),
      })),
    }),
  },
  async (args) => {
    const result = await bq('describe_schema', args as Record<string, unknown>);
    return result as { fields: Array<{ name: string; type: string; mode: string; description?: string }> };
  }
);

export const BIGQUERY_TOOLS = [
  bigqueryExecuteQueryTool,
  bigqueryListTablesTool,
  bigqueryDescribeSchemaTool,
] as const;
