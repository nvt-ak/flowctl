import { execa } from "execa";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./_repo-root";

describe("integration / monitor CLI (Phase 5 bridge)", () => {
  it("monitor --once runs python monitor-web.py and prints JSON", async () => {
    const py = await execa("bash", ["-c", "command -v python3"], {
      stdio: "pipe",
      reject: false,
    });
    if (py.exitCode !== 0) {
      throw new Error("python3 is required on PATH for this integration test");
    }

    const r = await execa(
      "bun",
      ["run", join(REPO_ROOT, "src/cli/index.ts"), "monitor", "--once"],
      { cwd: REPO_ROOT, stdio: "pipe" },
    );
    expect(r.exitCode).toBe(0);
    const trimmed = r.stdout.trim();
    expect(trimmed.startsWith("{") || trimmed.startsWith("[")).toBe(true);
  });
});
