/**
 * Block direct commits / pushes to main or master (port of prevent-main-*.sh).
 */
import { execFileSync } from "node:child_process";

export function shouldBlockProtectedBranch(branch: string): boolean {
  const b = branch.trim();
  return b === "main" || b === "master";
}

export function readCurrentGitBranch(repoRoot: string): string {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export type GuardKind = "pre-commit" | "pre-push";

export function messageIfBlocked(branch: string, kind: GuardKind): string | null {
  if (!shouldBlockProtectedBranch(branch)) return null;
  if (kind === "pre-commit") {
    return `Commit blocked: direct commits on '${branch}' are not allowed.\nCreate a feature branch and open a PR instead.`;
  }
  return `Push blocked: direct pushes to '${branch}' are not allowed.\nCreate a feature branch and open a PR instead.`;
}

export function checkGitGuard(
  repoRoot: string,
  kind: GuardKind,
  readBranch: (root: string) => string = readCurrentGitBranch,
): { ok: true } | { ok: false; message: string } {
  const branch = readBranch(repoRoot);
  const msg = messageIfBlocked(branch, kind);
  if (msg) return { ok: false, message: msg };
  return { ok: true };
}

export function runGitGuardMain(argv: string[]): void {
  const kind = argv[2] as GuardKind | undefined;
  const repoRoot = process.cwd();
  if (kind !== "pre-commit" && kind !== "pre-push") {
    console.error("Usage: git-guards.ts pre-commit | pre-push");
    process.exit(2);
    return;
  }
  const r = checkGitGuard(repoRoot, kind);
  if (!r.ok) {
    console.error(r.message);
    process.exit(1);
    return;
  }
  process.exit(0);
}

if (import.meta.main) {
  runGitGuardMain(process.argv);
}
