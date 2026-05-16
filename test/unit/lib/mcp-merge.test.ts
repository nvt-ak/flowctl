import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCursorMcp, scaffoldTemplate, setupTemplate } from "@/integrations/mcp-merge";

function assertLine(lines: string[], want: string): void {
  expect(lines.some((l) => l === want)).toBe(true);
}

async function readMcpServers(path: string): Promise<Record<string, unknown>> {
  const raw = JSON.parse(await readFile(path, "utf-8")) as { mcpServers?: Record<string, unknown> };
  return raw.mcpServers ?? {};
}

describe("mergeCursorMcp (TS port of merge_cursor_mcp.py)", () => {
  it("scaffold: empty path creates servers + FLOWCTL_PROJECT_ROOT env", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "1.json");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "myflowctl" },
      mergeGlobal: false,
    });
    assertLine(out.lines, "MCP_STATUS=created");
    const servers = await readMcpServers(mcpPath);
    expect(Object.keys(servers).sort()).toEqual(["flowctl-state", "shell-proxy"].sort());
    const sp = servers["shell-proxy"] as { command?: string; env?: Record<string, string> };
    expect(sp.command).toBe("myflowctl");
    for (const k of ["shell-proxy", "flowctl-state"]) {
      const env = (servers[k] as { env?: Record<string, string> }).env ?? {};
      expect(env.FLOWCTL_PROJECT_ROOT).toBe("${workspaceFolder}");
    }
  });

  it("scaffold: merge keeps custom servers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "2.json");
    await writeFile(
      mcpPath,
      JSON.stringify({ mcpServers: { acme: { command: "acme-cli" } } }),
      "utf-8",
    );
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "myflowctl" },
      mergeGlobal: false,
    });
    assertLine(out.lines, "MCP_STATUS=merged");
    const servers = await readMcpServers(mcpPath);
    expect(servers.acme).toBeDefined();
    expect(servers["shell-proxy"]).toBeDefined();
    expect(servers["flowctl-state"]).toBeDefined();
  });

  it("scaffold: second merge is unchanged", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "3.json");
    await writeFile(
      mcpPath,
      JSON.stringify({ mcpServers: { acme: { command: "acme-cli" } } }),
      "utf-8",
    );
    await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "myflowctl" },
      mergeGlobal: false,
    });
    const out2 = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "myflowctl" },
      mergeGlobal: false,
    });
    assertLine(out2.lines, "MCP_STATUS=unchanged");
  });

  it("scaffold: invalid JSON returns exit 2 and invalid_json status", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "4.json");
    await writeFile(mcpPath, "{", "utf-8");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "myflowctl" },
      mergeGlobal: false,
    });
    expect(out.exitCode).toBe(2);
    assertLine(out.lines, "MCP_STATUS=invalid_json");
    expect(out.lines.some((l) => l.startsWith("GLOBAL_MCP_STATUS"))).toBe(false);
  });

  it("scaffold: mcpServers not object → invalid_structure", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "5.json");
    await writeFile(mcpPath, JSON.stringify({ mcpServers: [] }), "utf-8");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "myflowctl" },
      mergeGlobal: false,
    });
    expect(out.exitCode).toBe(2);
    assertLine(out.lines, "MCP_STATUS=invalid_structure");
  });

  it("scaffold: overwrite drops extra servers and top-level keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "6.json");
    await writeFile(
      mcpPath,
      JSON.stringify({ mcpServers: { acme: { command: "x" } }, note: "keep" }),
      "utf-8",
    );
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: true,
      mode: { type: "scaffold", workflowCli: "z" },
      mergeGlobal: false,
    });
    assertLine(out.lines, "MCP_STATUS=overwritten");
    const doc = JSON.parse(await readFile(mcpPath, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
      note?: unknown;
    };
    expect(doc.note).toBeUndefined();
    expect("acme" in (doc.mcpServers ?? {})).toBe(false);
    expect(Object.keys(doc.mcpServers ?? {}).sort()).toEqual(["flowctl-state", "shell-proxy"].sort());
  });

  it("setup: merge adds gitnexus + flowctl servers; no graphify MCP", async () => {
    const tpl = setupTemplate();
    expect("graphify" in tpl).toBe(false);
    expect(Object.keys(tpl).sort()).toEqual(["flowctl-state", "gitnexus", "shell-proxy"].sort());

    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "setup-partial.json");
    await writeFile(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          "shell-proxy": { command: "flowctl", args: ["mcp", "--shell-proxy"] },
        },
      }),
      "utf-8",
    );
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "setup" },
      mergeGlobal: false,
    });
    assertLine(out.lines, "MCP_STATUS=merged");
    const servers = await readMcpServers(mcpPath);
    expect(servers.gitnexus).toBeDefined();
    expect(servers["flowctl-state"]).toBeDefined();
    expect(servers["shell-proxy"]).toBeDefined();
  });

  it("setup: merge when mcpServers missing keeps extra top-level keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-"));
    const mcpPath = join(dir, "setup-missing.json");
    await writeFile(mcpPath, JSON.stringify({ version: 1 }), "utf-8");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "setup" },
      mergeGlobal: false,
    });
    assertLine(out.lines, "MCP_STATUS=merged");
    const doc = JSON.parse(await readFile(mcpPath, "utf-8")) as {
      version?: number;
      mcpServers?: Record<string, unknown>;
    };
    expect(doc.version).toBe(1);
    expect(doc.mcpServers?.gitnexus).toBeDefined();
    expect("graphify" in (doc.mcpServers ?? {})).toBe(false);
    for (const k of ["shell-proxy", "flowctl-state"]) {
      const env = (doc.mcpServers?.[k] as { env?: Record<string, string> } | undefined)?.env ?? {};
      expect(env.FLOWCTL_PROJECT_ROOT).toBe("${workspaceFolder}");
    }
  });

  it("scaffoldTemplate matches expected MCP args", () => {
    const t = scaffoldTemplate("flowctl");
    expect(t["shell-proxy"]?.args).toEqual(["mcp", "--shell-proxy"]);
    expect(t["flowctl-state"]?.args).toEqual(["mcp", "--workflow-state"]);
  });
});
