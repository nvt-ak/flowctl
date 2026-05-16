import { describe, expect, it, vi } from "vitest";
import type { FlowctlContext } from "@/cli/context";
import { runMercenary } from "@/commands/mercenary";

describe("commands/mercenary", () => {
  it("prints usage for unknown subcommand", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await runMercenary({} as FlowctlContext, "unknown-sub");
    expect(log.mock.calls.some((c) => String(c[0]).includes("Usage"))).toBe(true);
    log.mockRestore();
  });
});
