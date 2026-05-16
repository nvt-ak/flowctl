import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tsconfig.json compilerOptions", () => {
  it("enforces noUnusedLocals and noUnusedParameters", async () => {
    const raw = await readFile(join(process.cwd(), "tsconfig.json"), "utf-8");
    const config = JSON.parse(raw) as {
      compilerOptions?: Record<string, unknown>;
    };
    expect(config.compilerOptions?.noUnusedLocals).toBe(true);
    expect(config.compilerOptions?.noUnusedParameters).toBe(true);
  });
});
