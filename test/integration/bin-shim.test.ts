import { execa } from "execa";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./_repo-root";

describe("integration / bin/flowctl shim (Phase 8)", () => {
  it("bin/flowctl is valid bash", async () => {
    const r = await execa("bash", ["-n", join(REPO_ROOT, "bin/flowctl")], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    expect(r.exitCode).toBe(0);
  });

  it("FLOWCTL_ENGINE=ts runs TypeScript CLI (--version)", async () => {
    const bun = await execa("bash", ["-c", "command -v bun"], {
      stdio: "pipe",
      reject: false,
    });
    if (bun.exitCode !== 0) {
      throw new Error("bun is required on PATH for this integration test (same as vitest runner)");
    }

    const r = await execa("bash", [join(REPO_ROOT, "bin/flowctl"), "--version"], {
      cwd: REPO_ROOT,
      env: { ...process.env, FLOWCTL_ENGINE: "ts" },
      stdio: "pipe",
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim().length).toBeGreaterThan(0);
  });
});
