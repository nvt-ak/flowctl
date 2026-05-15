import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeSlug, refreshRuntimePaths } from "@/config/paths";

describe("makeSlug", () => {
  it("lowercases and hyphenates project names", () => {
    expect(makeSlug("My Cool App!")).toBe("my-cool-app");
  });

  it("truncates to 32 characters", () => {
    expect(makeSlug("a".repeat(50)).length).toBeLessThanOrEqual(32);
  });
});

describe("refreshRuntimePaths", () => {
  it("derives workflow lock from state file hash", async () => {
    const tmp = await mkdtemp(join(homedir(), "flowctl-paths-"));
    const repo = join(tmp, "repo");
    const stateFile = join(repo, ".flowctl", "flows", "ab", "state.json");
    await mkdir(join(repo, ".flowctl", "flows", "ab"), { recursive: true });
    await writeFile(
      stateFile,
      JSON.stringify({
        flow_id: "wf-11111111-2222-3333-444444444444",
        project_name: "Demo",
      }),
    );

    const paths = await refreshRuntimePaths(repo, stateFile, {
      flowctlHome: join(tmp, "home"),
    });
    const expectedHash = createHash("sha256")
      .update(stateFile)
      .digest("hex")
      .slice(0, 16);
    expect(paths.workflowLockDir).toBe(
      join(repo, ".flowctl", "locks", expectedHash),
    );
  });

  it("uses flowctl home project dir when state has flow_id", async () => {
    const tmp = await mkdtemp(join(homedir(), "flowctl-paths-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const flowctlHome = join(tmp, "home");
    const stateFile = join(repo, "state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        flow_id: "wf-aaaaaaaa-bbbb-cccc-dddddddddddd",
        project_name: "My App",
      }),
    );

    const paths = await refreshRuntimePaths(repo, stateFile, { flowctlHome });
    expect(paths.dataDir).toBe(
      join(flowctlHome, "projects", "my-app-aaaaaaaa"),
    );
    expect(paths.idempotencyFile).toBe(
      join(paths.runtimeDir, "idempotency.json"),
    );
    expect(paths.registryFile).toBe(join(flowctlHome, "registry.json"));
  });

  it("falls back to repo .cache when state file missing flow_id", async () => {
    const tmp = await mkdtemp(join(homedir(), "flowctl-paths-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });

    const paths = await refreshRuntimePaths(repo, null, {
      flowctlHome: join(tmp, "home"),
    });
    expect(paths.dataDir).toBe(join(repo, ".cache", "flowctl"));
    expect(paths.dispatchBase).toBe(join(repo, "workflows", "dispatch"));
  });

  it("scopes dispatch paths to flow short id", async () => {
    const tmp = await mkdtemp(join(homedir(), "flowctl-paths-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const stateFile = join(repo, "state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        flow_id: "wf-deadbeef-cafe-babe-feedfacecafe",
        project_name: "X",
      }),
    );

    const paths = await refreshRuntimePaths(repo, stateFile, {
      flowctlHome: join(tmp, "home"),
    });
    expect(paths.dispatchBase).toBe(join(repo, "workflows", "deadbeef", "dispatch"));
    expect(paths.gateReportsDir).toBe(
      join(repo, "workflows", "deadbeef", "gates", "reports"),
    );
    expect(paths.evidenceDir).toBe(join(paths.runtimeDir, "evidence"));
    expect(paths.rolePolicyFile).toBe(
      join(repo, "workflows", "policies", "role-policy.v1.json"),
    );
    expect(resolve(paths.qaGateFile)).toBe(
      resolve(repo, "workflows", "gates", "qa-gate.v1.json"),
    );
  });
});
