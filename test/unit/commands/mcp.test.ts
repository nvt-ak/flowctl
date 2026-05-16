import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMcp } from "@/commands/mcp";
import * as shellProxy from "@/mcp/shell-proxy/index";
import * as workflowState from "@/mcp/workflow-state";
import { makeCtx } from "../../helpers/ctx";

describe("commands/mcp", () => {
  beforeEach(() => {
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("prints mcp.json setup snippet with shell-proxy and flowctl-state", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runMcp(ctx, { setup: true });
    });

    const out = logs.join("\n");
    expect(out).toContain("flowctl MCP Setup");
    expect(out).toContain('"shell-proxy"');
    expect(out).toContain('"flowctl-state"');
    expect(out).toContain('"--shell-proxy"');
    expect(out).toContain('"--workflow-state"');
    expect(out).toContain("${workspaceFolder}");

    log.mockRestore();
  });

  it("delegates to startShellProxyMcp when --shell-proxy is set", async () => {
    const start = vi.spyOn(shellProxy, "startShellProxyMcp").mockResolvedValue(undefined);

    await makeCtx(async (ctx) => {
      await runMcp(ctx, { shellProxy: true });
    });

    expect(start).toHaveBeenCalledTimes(1);
    const call = start.mock.calls[0]![0];
    expect(call.projectRoot).toBeTruthy();
    expect(call.env?.FLOWCTL_PROJECT_ROOT).toBeTruthy();
    expect(call.cacheDir).toBeTruthy();
  });

  it("delegates to startWorkflowStateMcp when --workflow-state is set", async () => {
    const start = vi.spyOn(workflowState, "startWorkflowStateMcp").mockResolvedValue(undefined);

    await makeCtx(async (ctx) => {
      await runMcp(ctx, { workflowState: true });
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]![0]).toBeTruthy();
  });

  it("sets exitCode when no exclusive flag is provided", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await makeCtx(async (ctx) => {
      await runMcp(ctx, {});
    });

    expect(process.exitCode).toBe(1);
    err.mockRestore();
  });
});
