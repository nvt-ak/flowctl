import { mkdtemp } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { refreshRuntimePaths } from "@/config/paths";
import { flowsJsonPath } from "@/config/flows-registry";
import { runFlow } from "@/commands/flow/index";
import { runFork } from "@/commands/fork";
import type { FlowctlContext } from "@/cli/context";

describe("flow and fork", () => {
  const dirs: string[] = [];
  afterEach(() => {
    dirs.length = 0;
  });

  async function ctx(repo: string): Promise<FlowctlContext> {
    const paths = await refreshRuntimePaths(repo, null);
    return {
      projectRoot: repo,
      workflowRoot: join(repo, ".."),
      paths,
      stateFile: null,
      resolveSource: "not_initialized",
    };
  }

  it("flow new creates flows.json entry", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-flow-"));
    dirs.push(tmp);
    const c = await ctx(tmp);
    await runFlow(c, "new", [], { label: "test-flow", project: "Demo" });
    const raw = JSON.parse(await readFile(flowsJsonPath(tmp), "utf-8"));
    expect(Object.keys(raw.flows).length).toBe(1);
    expect(raw.active_flow_id).toMatch(/^wf-/);
  });

  it("fork prints export and registers flow without stealing active", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-fork-"));
    dirs.push(tmp);
    const c = await ctx(tmp);
    await runFlow(c, "new", [], { project: "Base" });
    const before = JSON.parse(await readFile(flowsJsonPath(tmp), "utf-8"));
    const activeBefore = before.active_flow_id;

    const logs: string[] = [];
    const errLogs: string[] = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    console.error = (...args: unknown[]) => errLogs.push(args.join(" "));

    try {
      await runFork(c, { label: "parallel-task" });
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    expect(logs.some((l) => l.startsWith("export FLOWCTL_ACTIVE_FLOW=wf-"))).toBe(
      true,
    );
    const after = JSON.parse(await readFile(flowsJsonPath(tmp), "utf-8"));
    expect(Object.keys(after.flows).length).toBe(2);
    expect(after.active_flow_id).toBe(activeBefore);
  });
});
