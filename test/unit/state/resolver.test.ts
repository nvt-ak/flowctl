import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrateLegacyState } from "@/state/migrate";
import { resolveStatePathWithMigration } from "@/state/resolve-with-migration";
import { resolveStatePath } from "@/state/resolver";

describe("resolveStatePath", () => {
  it("relative FLOWCTL_STATE_FILE from repo root", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-res-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const aPath = join(tmp, "a.json");
    await writeFile(aPath, '{"flow_id":"wf-x"}');
    const result = await resolveStatePath(repo, {
      FLOWCTL_STATE_FILE: "../a.json",
    });
    expect(result.source).toBe("env_state_file");
    expect(result.stateFile).toMatch(/a\.json$/);
  });

  it("absolute FLOWCTL_STATE_FILE", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-res-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const bPath = join(tmp, "b.json");
    await writeFile(bPath, '{"flow_id":"wf-y"}');
    const result = await resolveStatePath(repo, {
      FLOWCTL_STATE_FILE: bPath,
    });
    expect(result.source).toBe("env_state_file");
    expect(result.stateFile).toBe(bPath);
  });

  it("not_initialized when no flows index", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-res-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const result = await resolveStatePath(repo, {});
    expect(result.source).toBe("not_initialized");
    expect(result.stateFile).toBeNull();
  });

  it("flows.json active_flow_id resolves state_file", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-res-"));
    const repo = join(tmp, "repo");
    const zzDir = join(repo, ".flowctl", "flows", "zz");
    await mkdir(zzDir, { recursive: true });
    await writeFile(
      join(zzDir, "state.json"),
      '{"flow_id":"wf-aaaaaaaa-bbbb-cccc-dddddddddddd"}',
    );
    await writeFile(
      join(repo, ".flowctl", "flows.json"),
      JSON.stringify({
        version: 1,
        active_flow_id: "wf-aaaaaaaa-bbbb-cccc-dddddddddddd",
        flows: {
          "wf-aaaaaaaa-bbbb-cccc-dddddddddddd": {
            state_file: ".flowctl/flows/zz/state.json",
            label: "test",
          },
        },
      }),
    );
    const result = await resolveStatePath(repo, {});
    expect(result.source).toBe("flows_json");
    expect(result.stateFile).toMatch(/zz[/\\]state\.json$/);
  });

  it("FLOWCTL_ACTIVE_FLOW selects flow entry", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-res-"));
    const repo = join(tmp, "repo");
    const fid = "wf-11111111-2222-3333-444444444444";
    const flowDir = join(repo, ".flowctl", "flows", "ab");
    await mkdir(flowDir, { recursive: true });
    await writeFile(join(flowDir, "state.json"), `{"flow_id":"${fid}"}`);
    await writeFile(
      join(repo, ".flowctl", "flows.json"),
      JSON.stringify({
        version: 1,
        active_flow_id: "wf-other",
        flows: {
          [fid]: { state_file: ".flowctl/flows/ab/state.json", label: "b" },
        },
      }),
    );
    const result = await resolveStatePath(repo, {
      FLOWCTL_ACTIVE_FLOW: fid,
    });
    expect(result.source).toBe("flows_json");
    expect(result.stateFile).toMatch(/ab[/\\]state\.json$/);
  });

  it("registry miss with active flow only → not_initialized", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-res-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const home = join(tmp, "home");
    await mkdir(join(home, "projects"), { recursive: true });
    const result = await resolveStatePath(
      repo,
      { FLOWCTL_ACTIVE_FLOW: "wf-missing-00000000-0000-0000-000000000001" },
      { flowctlHome: home },
    );
    expect(result.source).toBe("not_initialized");
  });
});

describe("resolveStatePathWithMigration", () => {
  it("migrates legacy root state and returns migrated_legacy", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-mig-"));
    const repo = join(tmp, "repo");
    await mkdir(repo, { recursive: true });
    const fid = "wf-aaaaaaaa-bbbb-cccc-dddddddddddd";
    await writeFile(
      join(repo, "flowctl-state.json"),
      JSON.stringify({ flow_id: fid, project_name: "P", current_step: 1 }),
    );
    const result = await resolveStatePathWithMigration(repo, {});
    expect(result.source).toBe("migrated_legacy");
    expect(result.stateFile).toMatch(/state\.json$/);
    const { pathExists } = await import("@/utils/fs");
    expect(await pathExists(join(repo, "flowctl-state.json"))).toBe(false);
  });
});
