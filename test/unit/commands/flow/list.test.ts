import { describe, expect, it, vi } from "vitest";
import { runFlowList } from "@/commands/flow/list";
import { writeFlowsIndex } from "@/config/flows-registry";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/flow/list", () => {
  it("prints guidance when flows.json is missing", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runFlowList(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("No .flowctl/flows.json");
    expect(out).toContain("STATE_FILE");

    log.mockRestore();
  });

  it("lists flows and marks active flow", async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await writeFlowsIndex(ctx.projectRoot, {
        version: 1,
        active_flow_id: "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee",
        flows: {
          "wf-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee": {
            state_file: ".flowctl/flows/t1/state.json",
            label: "primary",
          },
          "wf-bbbb2222-cccc-dddd-eeee-ffffffffffff": {
            state_file: ".flowctl/flows/t2/state.json",
            label: "secondary",
          },
        },
      });
      await runFlowList(ctx);
    });

    const out = logs.join("\n");
    expect(out).toContain("active_flow_id:");
    expect(out).toContain("wf-aaaa1111");
    expect(out).toContain("<-- active");
    expect(out).toContain('"primary"');
    expect(out).toContain("wf-bbbb2222");

    log.mockRestore();
  });
});
