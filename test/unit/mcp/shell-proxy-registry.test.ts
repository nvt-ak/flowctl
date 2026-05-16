import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RegistryStore, readProjectIdentity } from "@/mcp/shell-proxy/registry";

describe("mcp/shell-proxy/registry", () => {
  it("readProjectIdentity uses flow_id and project_name from state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-id-"));
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({ flow_id: "wf-20260101-abcd", project_name: "My Flow" }),
      "utf-8",
    );
    expect(readProjectIdentity(stateFile, dir)).toEqual({
      id: "wf-20260101-abcd",
      name: "My Flow",
    });
  });

  it("readProjectIdentity falls back when state file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-miss-"));
    const stateFile = join(dir, "missing-state.json");
    const id = readProjectIdentity(stateFile, dir);
    expect(id.name).toBe(join(dir).split("/").pop());
    expect(id.id).toMatch(/^path-[a-f0-9]{8}$/);
  });

  it("RegistryStore.upsert creates and updates project entry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-upsert-"));
    const flowctlHome = join(dir, "home");
    const registryFile = join(flowctlHome, "registry.json");
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        project_name: "Upsert Demo",
        current_step: 2,
        overall_status: "active",
        steps: { "2": { blockers: [{ resolved: false }] } },
      }),
      "utf-8",
    );
    const store = new RegistryStore(
      registryFile,
      flowctlHome,
      stateFile,
      dir,
      join(dir, "cache"),
      "proj-1",
      "Upsert Demo",
    );
    store.upsert();
    const first = JSON.parse(readFileSync(registryFile, "utf-8")) as {
      projects: Record<string, { current_step?: number; open_blockers?: number }>;
    };
    expect(first.projects["proj-1"]?.current_step).toBe(2);
    expect(first.projects["proj-1"]?.open_blockers).toBe(1);

    store.upsert({ overall_status: "done" });
    const second = JSON.parse(readFileSync(registryFile, "utf-8")) as {
      projects: Record<string, { overall_status?: string }>;
    };
    expect(second.projects["proj-1"]?.overall_status).toBe("done");
  });

  it("RegistryStore.upsert succeeds under concurrent writers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-lock-"));
    const flowctlHome = join(dir, "home");
    const registryFile = join(flowctlHome, "registry.json");
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(stateFile, JSON.stringify({ project_name: "Lock" }), "utf-8");

    const mkStore = (id: string) =>
      new RegistryStore(
        registryFile,
        flowctlHome,
        stateFile,
        dir,
        join(dir, "cache"),
        id,
        "Lock",
      );

    await Promise.all([mkStore("proj-a").upsert(), mkStore("proj-b").upsert()]);
    const registry = JSON.parse(readFileSync(registryFile, "utf-8")) as {
      projects: Record<string, unknown>;
    };
    expect(registry.projects["proj-a"]).toBeDefined();
    expect(registry.projects["proj-b"]).toBeDefined();
  });
});
