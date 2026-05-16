import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSessionStartMessage } from "@/hooks/session-start";

describe("hooks/session-start", () => {
  it("buildSessionStartMessage returns null when state file is missing", () => {
    expect(buildSessionStartMessage("/no/such/flowctl-state.json")).toBeNull();
  });

  it("buildSessionStartMessage returns null on invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "session-start-"));
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(stateFile, "{not json", "utf-8");
    expect(buildSessionStartMessage(stateFile)).toBeNull();
  });

  it("buildSessionStartMessage builds systemMessage with step, agent, and blocker count", async () => {
    const dir = await mkdtemp(join(tmpdir(), "session-start-"));
    const stateFile = join(dir, "flowctl-state.json");
    await writeFile(
      stateFile,
      JSON.stringify({
        project_name: "Acme",
        overall_status: "in_progress",
        current_step: 2,
        steps: {
          "2": {
            name: "Design",
            agent: "tech-lead",
            blockers: [{ resolved: false }, { resolved: true }],
          },
        },
      }),
      "utf-8",
    );

    const raw = buildSessionStartMessage(stateFile);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { systemMessage: string };
    expect(parsed.systemMessage).toContain("[Workflow] Acme");
    expect(parsed.systemMessage).toContain("in_progress");
    expect(parsed.systemMessage).toContain("Step 2: Design");
    expect(parsed.systemMessage).toContain("@tech-lead");
    expect(parsed.systemMessage).toContain("Blockers: 1");
    expect(parsed.systemMessage).toContain("wf_state()");
  });
});
