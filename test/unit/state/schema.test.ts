import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowctlStateSchema, normalizeRaw } from "@/state/schema";

const repoRoot = join(import.meta.dirname, "../../..");
const templatePath = join(repoRoot, "templates/flowctl-state.template.json");

describe("FlowctlStateSchema", () => {
  it("parses flowctl-state template after stripping _comment", () => {
    const raw = JSON.parse(readFileSync(templatePath, "utf-8"));
    const result = FlowctlStateSchema.safeParse(normalizeRaw(raw));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overall_status).toBe("not_started");
      expect(result.data.steps["1"]?.status).toBe("pending");
    }
  });

  it("rejects unknown top-level fields (no passthrough)", () => {
    const raw = {
      version: "1.0.0",
      project_name: "x",
      project_description: "",
      created_at: "",
      updated_at: "",
      current_step: 1,
      overall_status: "pending",
      steps: {},
      unexpected_field: true,
    };
    const result = FlowctlStateSchema.safeParse(normalizeRaw(raw));
    expect(result.success).toBe(false);
  });

  it("accepts step status skipped", () => {
    const raw = {
      version: "1.0.0",
      project_name: "",
      project_description: "",
      created_at: "",
      updated_at: "",
      current_step: 1,
      overall_status: "in_progress",
      steps: {
        "1": {
          name: "Req",
          agent: "pm",
          status: "skipped",
          skip_reason: "hotfix",
        },
      },
    };
    const result = FlowctlStateSchema.safeParse(normalizeRaw(raw));
    expect(result.success).toBe(true);
  });
});
