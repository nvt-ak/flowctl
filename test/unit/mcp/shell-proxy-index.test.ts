import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const handlers = vi.hoisted(() => new Map<unknown, (req?: unknown) => Promise<unknown>>());

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: class MockServer {
    setRequestHandler(schema: unknown, fn: (req?: unknown) => Promise<unknown>) {
      handlers.set(schema, fn);
    }
    async connect() {
      return undefined;
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

describe("mcp/shell-proxy/index", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("startShellProxyMcp registers ListTools with shell-proxy tool names", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sp-index-"));
    const cacheDir = join(dir, "cache");
    await mkdir(cacheDir, { recursive: true });
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({ project_name: "Index", current_step: 1, steps: { "1": {} } }),
      "utf-8",
    );

    const { startShellProxyMcp } = await import("@/mcp/shell-proxy/index");
    await startShellProxyMcp({
      projectRoot: dir,
      cacheDir,
      eventsFile: join(cacheDir, "events.jsonl"),
      statsFile: join(cacheDir, "session-stats.json"),
      stateFile,
      env: {},
    });

    const listHandler = handlers.get(ListToolsRequestSchema);
    expect(listHandler).toBeDefined();
    const listed = (await listHandler!()) as { tools: { name: string }[] };
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "wf_cache_invalidate",
        "wf_cache_stats",
        "wf_env",
        "wf_files",
        "wf_git",
        "wf_read",
        "wf_reports_status",
        "wf_set_agent",
        "wf_state",
        "wf_step_context",
      ].sort(),
    );
  });
});
