import { describe, it } from "vitest";
import { runRepoBashTest } from "../integration/run-bash";

/**
 * Phase 7 matrix: `test-complexity-war-room.sh` → `e2e/complexity.test.ts`.
 * Other bash e2e remain on `npm run test:legacy` / `npm run test:e2e` (isolated tmp + state).
 */
describe("e2e / complexity (bash)", () => {
  it("test-complexity-war-room.sh", async () => {
    await runRepoBashTest("test-complexity-war-room.sh");
  });
});
