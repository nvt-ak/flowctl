/**
 * Quality gate — port of scripts/hooks/run-quality-gate.sh (Phase 6).
 * `local` → npm run test:tdd | `ci` → npm run ci:gate (typecheck + unit + integration).
 */
import { execa } from "execa";

export type QualityGateMode = "ci" | "local";

export function parseQualityGateArgs(argv: string[]): { mode: QualityGateMode } {
  const args = argv.filter((a) => a !== "--");
  let mode: QualityGateMode = "ci";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--mode") {
      const v = args[i + 1];
      if (v !== "ci" && v !== "local") {
        throw new Error(`Invalid --mode: ${String(v)} (expected ci|local)`);
      }
      mode = v;
      i += 1;
    }
  }
  return { mode };
}

export type QualityGateRunner = (cmd: string, args: string[], cwd: string) => Promise<void>;

export async function runQualityGate(options: {
  mode: QualityGateMode;
  cwd: string;
  runner?: QualityGateRunner;
}): Promise<void> {
  const npmScript = options.mode === "local" ? "test:tdd" : "ci:gate";
  const run = options.runner ?? defaultNpmRunner;
  await run("npm", ["run", npmScript], options.cwd);
}

async function defaultNpmRunner(cmd: string, args: string[], cwd: string): Promise<void> {
  await execa(cmd, args, { stdio: "inherit", cwd });
}

export async function mainQualityGate(argv: string[]): Promise<void> {
  const cwd = process.cwd();
  const { mode } = parseQualityGateArgs(argv);
  await runQualityGate({ mode, cwd });
}

if (import.meta.main) {
  void mainQualityGate(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
