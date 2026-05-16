import { describe, it } from "vitest";
import { execa } from "execa";
import { REPO_ROOT } from "./_repo-root";
import { runRepoBashTest } from "./run-bash";

describe("integration / bash regression (Phase 7 matrix)", () => {
  it("test-workflow-tdd-regression.sh", async () => {
    await runRepoBashTest("test-workflow-tdd-regression.sh");
  });

  it("test-multi-flow-state.sh", async () => {
    await runRepoBashTest("test-multi-flow-state.sh");
  });

  it("test-merge-cursor-mcp.sh", async () => {
    await runRepoBashTest("test-merge-cursor-mcp.sh");
  });

  it("test-fork-parallel-isolation.sh", async () => {
    await runRepoBashTest("test-fork-parallel-isolation.sh");
  });

  it("pytest tests/test_error_recovery.py", async () => {
    await execa("python3", ["-m", "pytest", "tests/test_error_recovery.py", "-q"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  });
});
