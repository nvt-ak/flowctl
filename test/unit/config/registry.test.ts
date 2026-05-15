import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
