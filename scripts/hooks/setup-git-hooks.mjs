#!/usr/bin/env node
/**
 * Back-compat: run `bun run src/hooks/setup.ts` from repo root (Phase 6).
 * package.json `setup-hooks` calls the same path directly with Bun.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const st = spawnSync("bun", ["run", "src/hooks/setup.ts"], {
  cwd: repo,
  stdio: "inherit",
  env: process.env,
});
if (st.error) {
  if ("code" in st.error && st.error.code === "ENOENT") {
    console.error(
      "setup-git-hooks: bun not found. Install Bun (https://bun.sh) or run: npm run setup-hooks",
    );
    process.exit(1);
  }
  console.error(st.error);
  process.exit(1);
}
process.exit(typeof st.status === "number" ? st.status : 1);
