import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runFlowSwitch } from "@/commands/flow/switch";
import { flowsJsonPath, writeFlowsIndex } from "@/config/flows-registry";
import { makeCtx } from "../../../helpers/ctx";

const FLOW_A = "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee";
const FLOW_B = "wf-bbbb2222-cccc-dddd-eeee-ffffffffffff";

describe("commands/flow/switch", () => {
  async function seedFlows(projectRoot: string): Promise<void> {
    await writeFlowsIndex(projectRoot, {
      version: 1,
      active_flow_id: FLOW_A,
      flows: {
        [FLOW_A]: {
          state_file: ".flowctl/flows/a/state.json",
          label: "a",
        },
        [FLOW_B]: {
          state_file: ".flowctl/flows/b/state.json",
          label: "b",
        },
      },
    });
  }

  it("updates active_flow_id in flows.json", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await seedFlows(ctx.projectRoot);
      await runFlowSwitch(ctx, FLOW_B);
      const raw = JSON.parse(await readFile(flowsJsonPath(ctx.projectRoot), "utf-8"));
      expect(raw.active_flow_id).toBe(FLOW_B);
    });

    expect(logs.join("\n")).toContain(`active_flow_id set to ${FLOW_B}`);

    log.mockRestore();
  });

  it("resolves flow id by 8-char hex prefix", async () => {
    await makeCtx(async (ctx) => {
      await seedFlows(ctx.projectRoot);
      await runFlowSwitch(ctx, "bbbb2222");
      const raw = JSON.parse(await readFile(flowsJsonPath(ctx.projectRoot), "utf-8"));
      expect(raw.active_flow_id).toBe(FLOW_B);
    });
  });

  it("rejects empty target and unknown flow", async () => {
    await makeCtx(async (ctx) => {
      await seedFlows(ctx.projectRoot);
      await expect(runFlowSwitch(ctx, "   ")).rejects.toThrow(/Missing flow id/i);
      await expect(runFlowSwitch(ctx, "wf-deadbeef")).rejects.toThrow(/No flow matches/i);
    });
  });

  it("errors when flows.json is absent", async () => {
    await makeCtx(async (ctx) => {
      await expect(runFlowSwitch(ctx, FLOW_A)).rejects.toThrow(/flows\.json/i);
    });
  });
});
