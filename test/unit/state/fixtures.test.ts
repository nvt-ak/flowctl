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

  it("parses any *.json under tests/ that look like workflow state", () => {
    const testsDir = join(repoRoot, "tests");
    const candidates: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, name.name);
        if (name.isDirectory()) walk(p);
        else if (name.name.endsWith(".json") && name.name.includes("state")) {
          candidates.push(p);
        }
      }
    };
    try {
      walk(testsDir);
    } catch {
      /* tests dir only */
    }
    for (const file of candidates) {
      const raw = JSON.parse(readFileSync(file, "utf-8"));
      const result = FlowctlStateSchema.safeParse(normalizeRaw(raw));
      expect(result.success, `fixture ${file}`).toBe(true);
    }
  });
});
