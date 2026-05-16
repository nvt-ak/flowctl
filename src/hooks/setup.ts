/**
 * Install git hooks — port of scripts/hooks/setup-git-hooks.mjs (Phase 6).
 */
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const preCommit = `#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
if command -v bun &>/dev/null && [[ -f "$repo_root/src/hooks/git-guards.ts" ]]; then
  exec bun run "$repo_root/src/hooks/git-guards.ts" pre-commit
else
  exec bash "$repo_root/scripts/hooks/prevent-main-commit.sh"
fi
`;

const prePush = `#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
if command -v bun &>/dev/null && [[ -f "$repo_root/src/hooks/git-guards.ts" ]]; then
  bun run "$repo_root/src/hooks/git-guards.ts" pre-push
else
  bash "$repo_root/scripts/hooks/prevent-main-push.sh"
fi
cd "$repo_root" && npm run test:gate:local
`;

const invalidateGit = `if command -v bun &>/dev/null && [[ -f "$repo_root/src/hooks/invalidate-cache.ts" ]]; then
  bun run "$repo_root/src/hooks/invalidate-cache.ts" git 2>/dev/null || true
else
  bash "$repo_root/scripts/hooks/invalidate-cache.sh" git 2>/dev/null || true
fi`;

const postCommit = `#!/usr/bin/env bash
repo_root="$(git rev-parse --show-toplevel)"
${invalidateGit}
`;

const postMerge = `#!/usr/bin/env bash
repo_root="$(git rev-parse --show-toplevel)"
${invalidateGit}
`;

const postCheckout = `#!/usr/bin/env bash
repo_root="$(git rev-parse --show-toplevel)"
${invalidateGit}
`;

/** Hook name → script body (same semantics as setup-git-hooks.mjs). */
export function buildHookScripts(): Record<string, string> {
  return {
    "pre-commit": preCommit,
    "pre-push": prePush,
    "post-commit": postCommit,
    "post-merge": postMerge,
    "post-checkout": postCheckout,
  };
}

export function installGitHooks(repoRoot: string): void {
  const gitHooks = join(repoRoot, ".git", "hooks");
  if (!existsSync(gitHooks)) {
    console.error("Not a git repo or .git/hooks missing");
    process.exitCode = 1;
    return;
  }
  const hooks = buildHookScripts();
  for (const [name, content] of Object.entries(hooks)) {
    const path = join(gitHooks, name);
    writeFileSync(path, content, "utf8");
    chmodSync(path, 0o755);
    console.log(`✓ Installed: .git/hooks/${name}`);
  }
  console.log("\nGit hooks installed. MCP cache will auto-invalidate on git operations.");
}

export function mainSetup(): void {
  installGitHooks(process.cwd());
}

if (import.meta.main) {
  mainSetup();
}
