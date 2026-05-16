import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateLegacyDeletionGate } from "@/cleanup/legacy-deletion-gate";
import { runLegacyDeletionGate } from "@/commands/legacy-deletion-gate";
import type { FlowctlContext } from "@/cli/context";

describe("runLegacyDeletionGate", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("sets exitCode 1 when gate fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-cli-"));
    const ctx = { projectRoot: root } as FlowctlContext;
    process.exitCode = 0;
    await runLegacyDeletionGate(ctx, { skipRun: true });
    expect(process.exitCode).toBe(1);
  });

  it("leaves exitCode 0 when gate passes", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-cli-pass-"));
    await mkdir(join(root, "coverage"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 95 },
          functions: { pct: 95 },
          branches: { pct: 90 },
          statements: { pct: 95 },
        },
      }),
      "utf-8",
    );
    const ctx = { projectRoot: root } as FlowctlContext;
    process.exitCode = 0;
    await runLegacyDeletionGate(ctx, { skipRun: true });
    expect(process.exitCode).toBe(0);
  });
});

describe("evaluateLegacyDeletionGate subprocess failures", () => {
  it("records failing typecheck, vitest, and integration runners", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-gate-fail-"));
    await mkdir(join(root, "coverage"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(
      join(root, "coverage", "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 95 },
          functions: { pct: 95 },
          branches: { pct: 90 },
          statements: { pct: 95 },
        },
      }),
      "utf-8",
    );

    const result = await evaluateLegacyDeletionGate({
      projectRoot: root,
      coverageSummaryPath: join(root, "coverage", "coverage-summary.json"),
      runTypecheck: async () => {
        throw new Error("tsc failed");
      },
      runUnitCoverage: async () => {
        throw new Error("vitest failed");
      },
      runIntegration: async () => {
        throw new Error("integration failed");
      },
    });

    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "typecheck")?.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "vitest-coverage")?.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "integration")?.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "coverage")?.pass).toBe(true);
    expect(result.checks.find((c) => c.name === "src-imports")?.pass).toBe(true);
  });

  it("fails coverage when summary JSON is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowctl-legacy-gate-bad-json-"));
    await mkdir(join(root, "coverage"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "coverage", "coverage-summary.json"), "{not-json", "utf-8");

    const result = await evaluateLegacyDeletionGate({
      projectRoot: root,
      coverageSummaryPath: join(root, "coverage", "coverage-summary.json"),
      skipRun: true,
    });

    expect(result.checks.find((c) => c.name === "coverage")?.pass).toBe(false);
    expect(result.checks.find((c) => c.name === "coverage")?.detail).toMatch(/failed to read/i);
  });
});
