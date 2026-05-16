import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  flowctlProjectSignals,
  prepareMonitorWebLaunch,
  resolveStateFileForRepo,
  sliceMonitorPassthrough,
} from "@/integrations/monitor-web-resolve";

describe("monitor-web-resolve", () => {
  const tmpDirs: string[] = [];
  afterEach(async () => {
    for (const d of tmpDirs.splice(0)) {
      await rm(d, { recursive: true, force: true });
    }
  });

  async function makeRepo(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "flowctl-monitor-"));
    tmpDirs.push(root);
    return root;
  }

  it("resolveStateFileForRepo returns legacy path when flows.json absent", async () => {
    const root = await makeRepo();
    const legacy = join(root, "flowctl-state.json");
    writeFileSync(legacy, '{"current_step":1}', "utf-8");
    expect(resolveStateFileForRepo(root)).toBe(resolve(legacy));
  });

  it("resolveStateFileForRepo prefers active_flow state_file when present", async () => {
    const root = await makeRepo();
    mkdirSync(join(root, ".flowctl"), { recursive: true });
    const statePath = join(root, ".flowctl", "state.json");
    writeFileSync(statePath, "{}", "utf-8");
    writeFileSync(
      join(root, ".flowctl", "flows.json"),
      JSON.stringify({
        active_flow_id: "wf-1",
        flows: { "wf-1": { state_file: ".flowctl/state.json" } },
      }),
      "utf-8",
    );
    expect(resolveStateFileForRepo(root)).toBe(resolve(statePath));
  });

  it("resolveStateFileForRepo falls back to legacy when flows has no existing state_file", async () => {
    const root = await makeRepo();
    mkdirSync(join(root, ".flowctl"), { recursive: true });
    writeFileSync(
      join(root, ".flowctl", "flows.json"),
      JSON.stringify({
        active_flow_id: "wf-1",
        flows: { "wf-1": { state_file: ".flowctl/missing.json" } },
      }),
      "utf-8",
    );
    const legacy = join(root, "flowctl-state.json");
    writeFileSync(legacy, "{}", "utf-8");
    expect(resolveStateFileForRepo(root)).toBe(resolve(legacy));
  });

  it("flowctlProjectSignals is true when only corrupt flows.json exists", async () => {
    const root = await makeRepo();
    mkdirSync(join(root, ".flowctl"), { recursive: true });
    writeFileSync(join(root, ".flowctl", "flows.json"), "{not json", "utf-8");
    expect(flowctlProjectSignals(root)).toBe(true);
  });

  it("flowctlProjectSignals is false for empty repo", async () => {
    const root = await makeRepo();
    expect(flowctlProjectSignals(root)).toBe(false);
  });

  it("prepareMonitorWebLaunch injects --global when state file missing and no --once/--global", async () => {
    const plan = prepareMonitorWebLaunch({
      workflowRoot: "/w",
      projectRoot: "/p",
      stateFile: null,
      paths: { cacheDir: "/c", eventsFile: "/e", statsFile: "/s" },
      passthroughArgs: ["--port=3171"],
      extraEnv: { FLOWCTL_HOME: "/h" },
    });
    expect(plan.argv).toEqual(["--global", "--port=3171"]);
    expect(plan.env.FLOWCTL_PROJECT_ROOT).toBe("/p");
    expect(plan.env.FLOWCTL_CACHE_DIR).toBe("/c");
    expect(plan.env.FLOWCTL_EVENTS_F).toBe("/e");
    expect(plan.env.FLOWCTL_STATS_F).toBe("/s");
    expect(plan.env.FLOWCTL_HOME).toBe("/h");
    expect(plan.scriptPath).toBe("/w/scripts/monitor-web.py");
  });

  it("prepareMonitorWebLaunch does not inject --global when state file exists", async () => {
    const root = await makeRepo();
    const state = join(root, "flowctl-state.json");
    writeFileSync(state, "{}", "utf-8");
    const plan = prepareMonitorWebLaunch({
      workflowRoot: "/w",
      projectRoot: root,
      stateFile: state,
      paths: { cacheDir: "/c", eventsFile: "/e", statsFile: "/s" },
      passthroughArgs: [],
      extraEnv: {},
    });
    expect(plan.argv).toEqual([]);
  });

  it("prepareMonitorWebLaunch does not inject --global when first arg is --once", () => {
    const plan = prepareMonitorWebLaunch({
      workflowRoot: "/w",
      projectRoot: "/p",
      stateFile: null,
      paths: { cacheDir: "/c", eventsFile: "/e", statsFile: "/s" },
      passthroughArgs: ["--once"],
      extraEnv: {},
    });
    expect(plan.argv).toEqual(["--once"]);
  });

  it("sliceMonitorPassthrough returns args after monitor or mon", () => {
    expect(sliceMonitorPassthrough(["/bin/flowctl", "monitor", "--once"])).toEqual(["--once"]);
    expect(
      sliceMonitorPassthrough(["bun", "run", "src/cli/index.ts", "monitor", "--port=3"]),
    ).toEqual(["--port=3"]);
    expect(sliceMonitorPassthrough(["node", "dist.js", "mon"])).toEqual([]);
  });
});
