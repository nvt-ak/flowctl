import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowctlStateSchema, normalizeRaw } from "@/state/schema";

const repoRoot = join(import.meta.dirname, "../../..");

describe("state JSON fixtures", () => {
  it("parses flowctl-state template", () => {
    const raw = JSON.parse(
      readFileSync(
        join(repoRoot, "templates/flowctl-state.template.json"),
        "utf-8",
      ),
    );
    expect(FlowctlStateSchema.safeParse(normalizeRaw(raw)).success).toBe(true);
  });

  it("parses minimal states used in pytest init_safety shape", () => {
    const minimal = {
      flow_id: "wf-test",
      project_name: "P",
      project_description: "",
      created_at: "",
      updated_at: "",
      current_step: 1,
      overall_status: "pending",
      steps: {
        "1": {
          name: "Requirements",
          agent: "pm",
          status: "pending",
        },
      },
    };
    expect(FlowctlStateSchema.safeParse(normalizeRaw(minimal)).success).toBe(
      true,
    );
  });

  it("parses all committed JSON under tests/fixtures/flowctl-state/", () => {
    const dir = join(repoRoot, "tests/fixtures/flowctl-state");
    const names = readdirSync(dir).filter((n) => n.endsWith(".json"));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const raw = JSON.parse(
        readFileSync(join(dir, name), "utf-8"),
      ) as unknown;
      const result = FlowctlStateSchema.safeParse(normalizeRaw(raw));
      expect(
        result.success,
        result.success ? name : `${name}: ${result.error.message}`,
      ).toBe(true);
    }
  });
});
