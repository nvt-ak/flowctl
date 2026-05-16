import { afterEach, describe, expect, it, vi } from "vitest";
import { runDispatch } from "@/commands/dispatch/index";
import { PolicyViolationError } from "@/commands/dispatch/policy";
import * as brief from "@/commands/dispatch/brief";
import * as policy from "@/commands/dispatch/policy";
import * as lock from "@/utils/lock";
import { setPath } from "@/state/writer";
import { makeCtx } from "../../../helpers/ctx";

describe("commands/dispatch/index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("rejects both --launch and --headless", async () => {
    await makeCtx(async (ctx) => {
      await expect(
        runDispatch(ctx, { launch: true, headless: true }),
      ).rejects.toThrow("Cannot use both");
    });
  });

  it("manual mode prints spawn hints without idempotency checks", async () => {
    const idem = vi.spyOn(lock, "checkIdempotency");
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runDispatch(ctx, {});
    });

    expect(logs.join("\n")).toContain("Manual mode");
    expect(idem).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("dry-run prints dry-run banner and skips idempotency", async () => {
    const idem = vi.spyOn(lock, "checkIdempotency");
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runDispatch(ctx, { dryRun: true, headless: true });
    });

    expect(logs.join("\n")).toContain("[dry-run]");
    expect(idem).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("headless mode runs idempotency per role", async () => {
    const idem = vi
      .spyOn(lock, "checkIdempotency")
      .mockResolvedValue({ decision: "LAUNCH", reason: "new" });
    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await makeCtx(async (ctx) => {
      await runDispatch(ctx, { headless: true });
    });

    expect(idem).toHaveBeenCalled();
    expect(logs.join("\n")).toContain("[dispatch] @pm");
    log.mockRestore();
  });

  it("filters roles with --role", async () => {
    const generate = vi.spyOn(brief, "generateRoleBriefs").mockResolvedValue(undefined);
    await makeCtx(async (ctx) => {
      await runDispatch(ctx, { role: "@tech-lead", dryRun: true });
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["tech-lead"] }),
    );
    generate.mockRestore();
  });

  it("throws when filtered role is missing on step", async () => {
    await makeCtx(async (ctx) => {
      await expect(runDispatch(ctx, { role: "qa" })).rejects.toThrow(
        "No role 'qa'",
      );
    });
  });

  it("sets exit code 2 on policy violation", async () => {
    vi.spyOn(policy, "validateDispatchPolicy").mockImplementation(() => {
      throw new PolicyViolationError(["mode headless not allowed"]);
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await makeCtx(async (ctx) => {
      await runDispatch(ctx, { headless: true });
    });

    expect(process.exitCode).toBe(2);
    error.mockRestore();
  });

  it("throws when step has no agents", async () => {
    await makeCtx(async (ctx) => {
      await setPath(ctx.stateFile!, "steps.1.agent", "");
      await setPath(ctx.stateFile!, "steps.1.support_agents", []);
      await expect(runDispatch(ctx, {})).rejects.toThrow("no agents assigned");
    });
  });
});
