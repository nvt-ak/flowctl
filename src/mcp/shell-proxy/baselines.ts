import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type BaselineEntry = { samples: number[]; avg: number };

const FALLBACK: Record<string, number> = {
  wf_state: 480,
  wf_git: 250,
  wf_step_context: 1200,
  wf_files: 120,
  wf_read: 500,
  wf_env: 80,
};

export class BaselinesStore {
  constructor(private readonly baselineFile: string) {}

  read(): Record<string, BaselineEntry> {
    if (!existsSync(this.baselineFile)) return {};
    try {
      return JSON.parse(readFileSync(this.baselineFile, "utf-8")) as Record<string, BaselineEntry>;
    } catch {
      return {};
    }
  }

  getBaseline(tool: string): number {
    const b = this.read();
    return b[tool]?.avg ?? FALLBACK[tool] ?? 200;
  }

  updateBaseline(tool: string, outputTokens: number): number {
    const b = this.read();
    const prev = b[tool] ?? { samples: [], avg: outputTokens };
    prev.samples = [...(prev.samples ?? []).slice(-9), outputTokens];
    prev.avg = Math.round(prev.samples.reduce((a, x) => a + x, 0) / prev.samples.length);
    b[tool] = prev;
    writeFileSync(this.baselineFile, JSON.stringify(b, null, 2));
    return prev.avg;
  }
}
