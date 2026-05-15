#!/usr/bin/env bun
import { checkIdempotency } from "@/utils/lock";

const [idemFile, key, workerId] = process.argv.slice(2);
if (!idemFile || !key || !workerId) {
  console.error("usage: idem-worker.ts <idemFile> <key> <workerId>");
  process.exit(2);
}

try {
  const { reason } = await checkIdempotency(idemFile, key, workerId);
  console.log(reason);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
