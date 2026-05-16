import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeCursorMcp } from "@/integrations/mcp-merge";

function assertLine(lines: string[], want: string): void {
  expect(lines.some((l) => l === want)).toBe(true);
}

describe("mergeCursorMcp (integrations)", () => {
  it("overwrite on missing file reports created", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-int-"));
    const mcpPath = join(dir, "new.json");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: true,
      mode: { type: "scaffold", workflowCli: "flowctl" },
      mergeGlobal: false,
    });
    expect(out.exitCode).toBe(0);
    assertLine(out.lines, "MCP_STATUS=created");
    const doc = JSON.parse(await readFile(mcpPath, "utf-8")) as { mcpServers?: Record<string, unknown> };
    expect(doc.mcpServers?.["shell-proxy"]).toBeDefined();
  });

  it("invalid JSON without overwrite exits 2 and does not rewrite file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-mcp-int-bad-"));
    const mcpPath = join(dir, "broken.json");
    const before = "{ not-valid-json";
    await writeFile(mcpPath, before, "utf-8");
    const out = await mergeCursorMcp({
      mcpPath,
      overwrite: false,
      mode: { type: "scaffold", workflowCli: "flowctl" },
      mergeGlobal: false,
    });
    expect(out.exitCode).toBe(2);
    assertLine(out.lines, "MCP_STATUS=invalid_json");
    expect(await readFile(mcpPath, "utf-8")).toBe(before);
  });
});
