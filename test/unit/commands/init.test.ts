import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowctlContext } from "@/cli/context";
import { ensureProjectScaffold, runInit } from "@/commands/init";
import { runSetup } from "@/commands/init/setup";
import { refreshRuntimePaths } from "@/config/paths";
import { pathExists } from "@/utils/fs";
import { withTmpDir } from "../../helpers/fs";

vi.mock("@/commands/init/setup", () => ({
  runSetup: vi.fn(() => Promise.resolve(0)),
}));

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("commands/init ensureProjectScaffold", () => {
  it("creates project scaffold dirs under a fresh temp project", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-init-"));
    await ensureProjectScaffold(projectRoot, REPO_ROOT, false);
    expect(await pathExists(join(projectRoot, ".cursor"))).toBe(true);
    expect(await pathExists(join(projectRoot, "workflows", "gates"))).toBe(true);
  }, 120_000);

  it("does not overwrite existing .cursor tree when overwrite is false", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-init-noow-"));
    const agentsDir = join(projectRoot, ".cursor", "agents");
    await mkdir(agentsDir, { recursive: true });
    const marker = join(agentsDir, ".scaffold-marker");
    await writeFile(marker, "stale-local", "utf-8");

    await ensureProjectScaffold(projectRoot, REPO_ROOT, false);

    expect(await readFile(marker, "utf-8")).toBe("stale-local");
  }, 120_000);

  it("refreshes scaffold tree when overwrite is true", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "flowctl-init-ow-"));
    await ensureProjectScaffold(projectRoot, REPO_ROOT, false);

    const indexMd = join(projectRoot, ".cursor", "INDEX.md");
    const srcIndex = join(REPO_ROOT, ".cursor", "INDEX.md");
    if (!(await pathExists(indexMd)) || !(await pathExists(srcIndex))) {
      return;
    }
    await writeFile(indexMd, "stale-local", "utf-8");

    await ensureProjectScaffold(projectRoot, REPO_ROOT, true);

    expect(await readFile(indexMd, "utf-8")).toBe(await readFile(srcIndex, "utf-8"));
  }, 120_000);
});

describe("commands/init runInit", () => {
  beforeEach(() => {
    vi.mocked(runSetup).mockReset();
    vi.mocked(runSetup).mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FLOWCTL_SKIP_SETUP;
  });

  async function initCtx(repo: string, workflowRoot: string): Promise<FlowctlContext> {
    const paths = await refreshRuntimePaths(repo);
    return {
      projectRoot: repo,
      workflowRoot,
      paths,
      stateFile: null,
      resolveSource: "cwd",
    };
  }

  it("skips setup when --no-setup is set", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await withTmpDir("flowctl-init-run-", async (root) => {
      const repo = join(root, "repo");
      await mkdir(repo, { recursive: true });
      const ctx = await initCtx(repo, REPO_ROOT);
      await runInit(ctx, { project: "Demo", noSetup: true });
    });

    expect(runSetup).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("Skipped setup");
    log.mockRestore();
  });

  it("warns and continues when setup throws", async () => {
    vi.mocked(runSetup).mockRejectedValueOnce(new Error("setup.sh failed"));
    const warns: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation((msg: unknown) => {
      warns.push(String(msg));
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await withTmpDir("flowctl-init-err-", async (root) => {
      const repo = join(root, "repo");
      await mkdir(repo, { recursive: true });
      const ctx = await initCtx(repo, REPO_ROOT);
      await runInit(ctx, { project: "Demo" });
    });

    expect(runSetup).toHaveBeenCalled();
    expect(warns.join("\n")).toContain("setup failed");
    expect(warns.join("\n")).toContain("setup.sh failed");
    warn.mockRestore();
    log.mockRestore();
  });

  it("warns when setup exits non-zero", async () => {
    vi.mocked(runSetup).mockResolvedValueOnce(1);
    const warns: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation((msg: unknown) => {
      warns.push(String(msg));
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await withTmpDir("flowctl-init-code-", async (root) => {
      const repo = join(root, "repo");
      await mkdir(repo, { recursive: true });
      const ctx = await initCtx(repo, REPO_ROOT);
      await runInit(ctx, { project: "Demo" });
    });

    expect(warns.join("\n")).toContain("setup exited 1");
    warn.mockRestore();
    log.mockRestore();
  });

  it("prints overwrite hint when --overwrite is set", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await withTmpDir("flowctl-init-owrun-", async (root) => {
      const repo = join(root, "repo");
      await mkdir(repo, { recursive: true });
      const ctx = await initCtx(repo, REPO_ROOT);
      await runInit(ctx, { project: "Demo", overwrite: true, noSetup: true });
    });

    expect(logs.join("\n")).toContain("Overwrite scaffold");
    log.mockRestore();
  });
});
