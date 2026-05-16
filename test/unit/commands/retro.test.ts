import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runRetro } from "@/commands/retro";
import { appendPath, setPath } from "@/state/writer";
import { makeCtx } from "../../helpers/ctx";

describe("commands/retro", () => {
  it("writes lessons.json with retro payload for explicit step", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(
      async (ctx) => {
        await setPath(ctx.stateFile!, "steps.1.name", "Requirements");
        await appendPath(ctx.stateFile!, "steps.1.decisions", {
          id: "dec-1",
          date: "2026-05-17",
          type: "scope",
          description: "MVP only",
          source: "pm",
        });
        await appendPath(ctx.stateFile!, "steps.1.blockers", {
          id: "blk-1",
          created_at: "2026-05-17",
          description: "API schema pending",
          source: "workflows/dispatch/step-1/reports/backend-report.md",
          resolved: false,
        });
        const mercDir = join(ctx.paths.dispatchBase, "step-1", "mercenaries");
        await mkdir(mercDir, { recursive: true });
        await writeFile(join(mercDir, "security-scan-output.md"), "# scan\n", "utf-8");

        await runRetro(ctx, "1");

        const lessonsPath = join(ctx.paths.retroDir, "lessons.json");
        const lessons = JSON.parse(await readFile(lessonsPath, "utf-8")) as {
          steps: Record<string, { step: string; n_decisions: number; mercenaries_used: string[] }>;
        };
        expect(lessons.steps["1"]?.step).toBe("1");
        expect(lessons.steps["1"]?.n_decisions).toBe(1);
        expect(lessons.steps["1"]?.mercenaries_used).toContain("security");
      },
      { currentStep: 2 },
    );

    const out = logs.join("\n");
    expect(out).toContain("RETRO — Step 1");
    expect(out).toContain("Decisions made");
    expect(out).toContain("Lessons saved");

    log.mockRestore();
  });

  it("defaults to previous step when step arg is omitted", async () => {
    await makeCtx(
      async (ctx) => {
        await setPath(ctx.stateFile!, "current_step", 3);
        await runRetro(ctx);
        const lessonsPath = join(ctx.paths.retroDir, "lessons.json");
        const lessons = JSON.parse(await readFile(lessonsPath, "utf-8")) as {
          steps: Record<string, unknown>;
        };
        expect(lessons.steps["2"]).toBeDefined();
      },
      { currentStep: 3 },
    );
  });
});
