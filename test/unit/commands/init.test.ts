import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ensureProjectScaffold } from "@/commands/init";
import { pathExists } from "@/utils/fs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("commands/init ensureProjectScaffold", () => {
  it("creates project scaffold dirs under a fresh temp project", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-init-"));
    await ensureProjectScaffold(projectRoot, REPO_ROOT, false);
    expect(await pathExists(join(projectRoot, ".cursor"))).toBe(true);
    expect(await pathExists(join(projectRoot, "workflows", "gates"))).toBe(true);
  }, 120_000);
});
