import { describe, expect, it } from "vitest";
import vitestConfig from "../../../vitest.config";

describe("vitest.config.ts coverage (Phase C0)", () => {
  it("enforces gradual floor thresholds before 95% legacy-deletion gate", () => {
    const coverage = vitestConfig.test?.coverage;
    expect(coverage?.thresholds).toEqual({
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    });
  });
});
