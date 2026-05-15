#!/usr/bin/env bun
/** Subprocess helper: set steps.1.notes for concurrency tests. */
import { setPath } from "@/state/writer";

const stateFile = process.argv[2];
const workerId = process.argv[3] ?? "w";
if (!stateFile) {
  console.error("usage: concurrent-set-path.ts <stateFile> [workerId]");
  process.exit(2);
}

await setPath(stateFile, "steps.1.notes", `worker-${workerId}`);
console.log(`OK|${workerId}`);
