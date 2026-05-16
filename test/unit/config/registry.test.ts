import { mkdir, readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  flowsJsonPath,
  mutateFlowsIndex,
  readFlowsIndex,
  resolveFlowId,
  withFlowsIndexLock,
  writeFlowsIndex,
} from "@/config/flows-registry";
import { readRegistry, upsertRegistryProject } from "@/config/registry";

describe("registry", () => {
  it("upserts and reads project entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-reg-"));
    const registryFile = join(dir, "registry.json");

    await upsertRegistryProject(registryFile, "wf-1", {
      project_id: "wf-1",
      project_name: "Demo",
      path: "/tmp/demo",
      last_seen: new Date().toISOString(),
    });

    const registry = await readRegistry(registryFile);
    expect(registry.projects["wf-1"]?.project_name).toBe("Demo");

    const raw = JSON.parse(await readFile(registryFile, "utf-8")) as {
      projects: Record<string, unknown>;
    };
    expect(Object.keys(raw.projects)).toContain("wf-1");
  });
});

describe("flows-registry", () => {
  it("writeFlowsIndex and readFlowsIndex round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flows-"));
    const index = {
      version: 1,
      active_flow_id: "wf-a",
      flows: {
        "wf-a": { state_file: ".flowctl/flows/a/state.json", label: "A" },
      },
    };

    await writeFlowsIndex(dir, index);
    const path = flowsJsonPath(dir);
    const raw = JSON.parse(await readFile(path, "utf-8")) as typeof index;
    expect(raw.active_flow_id).toBe("wf-a");

    const loaded = await readFlowsIndex(dir);
    expect(loaded?.flows["wf-a"]?.label).toBe("A");
  });

  it("readFlowsIndex returns null when flows.json is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flows-"));
    expect(await readFlowsIndex(dir)).toBeNull();
  });

  it("withFlowsIndexLock acquires lock and returns fn result", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flows-"));
    await mkdir(join(dir, ".flowctl"), { recursive: true });

    const result = await withFlowsIndexLock(dir, async () => {
      await writeFlowsIndex(dir, {
        version: 1,
        active_flow_id: "wf-1",
        flows: { "wf-1": { state_file: "a.json", label: "locked" } },
      });
      return "ok";
    });

    expect(result).toBe("ok");
    const index = await readFlowsIndex(dir);
    expect(index?.flows["wf-1"]?.label).toBe("locked");
  });

  it("mutateFlowsIndex bootstraps default index when flows.json is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flows-"));
    await mkdir(join(dir, ".flowctl"), { recursive: true });

    const index = await mutateFlowsIndex(dir, (idx) => {
      idx.flows["wf-boot"] = { state_file: "boot.json", label: "boot" };
    });

    expect(index.version).toBe(1);
    expect(index.flows["wf-boot"]?.label).toBe("boot");
  });

  it("mutateFlowsIndex updates an existing flows.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "flowctl-flows-"));
    await writeFlowsIndex(dir, { version: 1, active_flow_id: "", flows: {} });

    const index = await mutateFlowsIndex(dir, (idx) => {
      idx.active_flow_id = "wf-new";
      idx.flows["wf-new"] = { state_file: "s.json", label: "new" };
    });

    expect(index.active_flow_id).toBe("wf-new");
    expect((await readFlowsIndex(dir))?.flows["wf-new"]?.label).toBe("new");
  });

  it("resolveFlowId matches exact id and prefix", () => {
    const index = {
      version: 1,
      active_flow_id: "",
      flows: {
        "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee": {
          state_file: "a.json",
          label: "",
        },
      },
    };
    expect(resolveFlowId(index, "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(
      "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(resolveFlowId(index, "aaaa1111")).toBe(
      "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(resolveFlowId(index, "wf-unknown")).toBeNull();
  });
});
