import { describe, expect, it, vi } from "vitest";
import { parseQualityGateArgs, runQualityGate } from "@/hooks/quality-gate";

describe("hooks/quality-gate", () => {
  it("parseQualityGateArgs defaults to ci", () => {
    expect(parseQualityGateArgs([])).toEqual({ mode: "ci" });
  });

  it("parseQualityGateArgs reads --mode", () => {
    expect(parseQualityGateArgs(["--mode", "local"])).toEqual({ mode: "local" });
    expect(parseQualityGateArgs(["x", "--mode", "ci"])).toEqual({ mode: "ci" });
  });

  it("parseQualityGateArgs rejects unknown mode", () => {
    expect(() => parseQualityGateArgs(["--mode", "nope"])).toThrow(/Invalid --mode/);
  });

  it("runQualityGate invokes npm with expected script per mode", async () => {
    const calls: { cmd: string; args: string[]; cwd: string }[] = [];
    const runner = vi.fn(async (cmd: string, args: string[], cwd: string) => {
      calls.push({ cmd, args, cwd });
    });

    await runQualityGate({ mode: "local", cwd: "/tmp/flowctl-a", runner });
    expect(calls).toEqual([{ cmd: "npm", args: ["run", "test:tdd"], cwd: "/tmp/flowctl-a" }]);

    calls.length = 0;
    await runQualityGate({ mode: "ci", cwd: "/tmp/flowctl-b", runner });
    expect(calls).toEqual([{ cmd: "npm", args: ["run", "ci:gate"], cwd: "/tmp/flowctl-b" }]);
  });
});
