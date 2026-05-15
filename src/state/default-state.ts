import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FlowctlStateSchema,
  normalizeRaw,
  type FlowctlState,
} from "@/state/schema";

const templatePath = join(
  import.meta.dirname,
  "../../templates/flowctl-state.template.json",
);

let cachedTemplate: FlowctlState | null = null;

/** Load validated default state from the repo template. */
export function defaultState(): FlowctlState {
  if (!cachedTemplate) {
    const raw = JSON.parse(readFileSync(templatePath, "utf-8"));
    const parsed = FlowctlStateSchema.parse(normalizeRaw(raw));
    cachedTemplate = parsed;
  }
  return structuredClone(cachedTemplate);
}
