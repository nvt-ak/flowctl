import { execa } from "execa";
import { join } from "node:path";
import { REPO_ROOT } from "./_repo-root";

/** Run a repo `test/*.sh` script from REPO_ROOT (exit non-zero propagates). */
export async function runRepoBashTest(scriptUnderTestDir: string): Promise<void> {
  const script = join(REPO_ROOT, "test", scriptUnderTestDir);
  const env = { ...process.env };
  // Vitest worker / IDE may set active flow; fork-isolation script expects a clean slate for TC-09/10.
  delete env.FLOWCTL_ACTIVE_FLOW;
  delete env.FLOWCTL_STATE_FILE;
  await execa("bash", [script], { cwd: REPO_ROOT, stdio: "pipe", env });
}
