import { describe, expect, it } from "vitest";
import { DEFAULT_LEGACY_COVERAGE_THRESHOLDS } from "@/cleanup/legacy-deletions";
import vitestConfig from "../../../vitest.config";

describe("vitest.config.ts coverage (Phase C7)", () => {
  it("enforces Phase C7 vitest regression floor", () => {
    expect(vitestConfig.test?.coverage?.thresholds).toEqual({
      statements: 84,
      branches: 68,
      functions: 86,
      lines: 86,
    });
  });

  it("keeps 95% target on legacy-deletion gate", () => {
    expect(DEFAULT_LEGACY_COVERAGE_THRESHOLDS).toEqual({
      linesPct: 95,
      functionsPct: 95,
      branchesPct: 90,
    });
  });
});
