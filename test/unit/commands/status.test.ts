import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runStatus } from "@/commands/status";
import { setPath } from "@/state/writer";
import * as fsUtil from "@/utils/fs";
import { makeCtx } from "../../helpers/ctx";

describe("commands/status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints workflow status for current project", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        await setPath(ctx.stateFile!, "project_name", "Status Demo");
        await setPath(ctx.stateFile!, "overall_status", "in_progress");
        await runStatus(ctx, {});
      },
      { currentStep: 2 },
    );

    const out = logs.join("\n");
    expect(out).toContain("Workflow Status");
    expect(out).toContain("Status Demo");
    expect(out).toContain("in_progress");
    expect(out).toContain("flowctl approve");

    log.mockRestore();
  });

  it("lists all projects when --all is set", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      const registryFile = ctx.paths.registryFile;
      await mkdir(dirname(registryFile), { recursive: true });
      await writeFile(
        registryFile,
        JSON.stringify(
          {
            version: 1,
            projects: {
              "proj-a": {
                project_id: "proj-a",
                project_name: "Alpha",
                path: "/tmp/alpha",
                current_step: 3,
                overall_status: "in_progress",
                open_blockers: 2,
                last_seen: new Date().toISOString(),
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      await runStatus(ctx, { all: true });
    });

    const out = logs.join("\n");
    expect(out).toContain("All Projects");
    expect(out).toContain("Alpha");
    expect(out).toContain("blocker(s)");

    log.mockRestore();
  });

  it("prints registry hint when --all and registry file is missing", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      const original = fsUtil.pathExists;
      vi.spyOn(fsUtil, "pathExists").mockImplementation(async (target) => {
        if (target === ctx.paths.registryFile) return false;
        return original(target);
      });
      await runStatus(ctx, { all: true });
    });

    expect(logs.join("\n")).toContain("Registry not found");

    log.mockRestore();
  });
});
