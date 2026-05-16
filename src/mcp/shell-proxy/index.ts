/**
 * shell-proxy MCP server (TypeScript port of scripts/workflow/mcp/shell-proxy.js).
 */
import { join, resolve } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolveProjectMcpCacheDir } from "@/mcp/resolve-mcp-cache-dir";
import {
  resolveFlowctlHomeForMcp,
  resolveMcpDispatchBase,
  resolveMcpStatePath,
} from "@/mcp/resolve-mcp-state-path";
import { RegistryStore, readProjectIdentity } from "@/mcp/shell-proxy/registry";
import { SessionStatsStore } from "@/mcp/shell-proxy/stats";
import {
  buildShellProxyTools,
  createShellProxyContext,
  handleShellToolCall,
} from "@/mcp/shell-proxy/tools";

export type ShellProxyMcpOptions = {
  projectRoot: string;
  env?: NodeJS.ProcessEnv;
  cacheDir?: string;
  eventsFile?: string;
  statsFile?: string;
  stateFile?: string;
};

export async function startShellProxyMcp(opts: ShellProxyMcpOptions): Promise<void> {
  const env = opts.env ?? process.env;
  const repo = resolve(opts.projectRoot);
  const stateFile = opts.stateFile ?? resolveMcpStatePath(repo, env);
  const cacheDir = opts.cacheDir ?? resolveProjectMcpCacheDir(repo, env);
  const eventsFile = opts.eventsFile ?? resolve(env.FLOWCTL_EVENTS_F ?? join(cacheDir, "events.jsonl"));
  const statsFile = opts.statsFile ?? resolve(env.FLOWCTL_STATS_F ?? join(cacheDir, "session-stats.json"));
  const dispatchBase = resolveMcpDispatchBase(repo, stateFile, env);
  const flowctlHome = resolveFlowctlHomeForMcp(repo, env);
  const registryFile = join(flowctlHome, "registry.json");

  console.error(`[shell-proxy] cache dir: ${cacheDir}`);
  console.error(`[shell-proxy] events file: ${eventsFile}`);

  const ctx = createShellProxyContext({
    repo,
    stateFile,
    dispatchBase,
    cacheDir,
    eventsFile,
    statsFile,
  });

  const statsStore = ctx.stats as SessionStatsStore;
  statsStore.initSessionStats();

  const proj = readProjectIdentity(stateFile, repo);
  const registry = new RegistryStore(
    registryFile,
    flowctlHome,
    stateFile,
    repo,
    cacheDir,
    proj.id,
    proj.name,
  );
  registry.upsert();
  setInterval(() => registry.upsert(), 60_000).unref();

  const tools = buildShellProxyTools(ctx);
  const server = new Server(
    { name: "shell-proxy", version: "2.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const outcome = handleShellToolCall(ctx, tools, req.params.name, req.params.arguments);
    if (!outcome.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: outcome.error }) }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
