import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createContext,
  getOrCreateContext,
  invalidateContextCache,
  requireStateFile,
  workflowRootFromModule,
} from "@/cli/context";

describe("cli/context", () => {
  afterEach(() => {
    invalidateContextCache();
  });

  it("workflowRootFromModule resolves to flowctl package root", () => {
    const root = workflowRootFromModule();
    expect(root).toMatch(/flowctl$/);
  });

  it("getOrCreateContext reuses the same resolved context while cached", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ctx-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });

    const first = await getOrCreateContext(repo, {});
    const second = await getOrCreateContext(repo, {});

    expect(first).toBe(second);
    expect(first.projectRoot).toBe(repo);
  });

  it("invalidateContextCache forces a new context object", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ctx-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });

    const cached = await getOrCreateContext(repo, {});
    invalidateContextCache();
    const fresh = await getOrCreateContext(repo, {});

    expect(cached.projectRoot).toBe(fresh.projectRoot);
    expect(cached).not.toBe(fresh);
  });

  it("createContext resolves state from FLOWCTL_STATE_FILE", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-ctx-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const statePath = join(tmp, "custom-state.json");
    await writeFile(statePath, '{"flow_id":"wf-test"}', "utf-8");

    const ctx = await createContext(repo, { FLOWCTL_STATE_FILE: statePath });

    expect(ctx.projectRoot).toBe(repo);
    expect(ctx.stateFile).toBe(statePath);
    expect(ctx.resolveSource).toBe("env_state_file");
    expect(ctx.paths.stateFile).toBe(statePath);
  });

  it("requireStateFile throws when state is not initialized", () => {
    expect(() =>
      requireStateFile({
        projectRoot: "/tmp",
        workflowRoot: "/pkg",
        paths: {} as never,
        stateFile: null,
        resolveSource: "not_initialized",
      }),
    ).toThrow(/Workflow state not found/);
  });

  it("requireStateFile returns path when present", () => {
    const path = "/tmp/state.json";
    expect(
      requireStateFile({
        projectRoot: "/tmp",
        workflowRoot: "/pkg",
        paths: {} as never,
        stateFile: path,
        resolveSource: "env_state_file",
      }),
    ).toBe(path);
  });
});
