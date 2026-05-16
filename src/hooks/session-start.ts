/**
 * Claude Code SessionStart — print workflow systemMessage JSON (port of flowctl.sh hook inline).
 */
import { existsSync, readFileSync } from "node:fs";

export function buildSessionStartMessage(stateFile: string): string | null {
  if (!existsSync(stateFile)) return null;
  try {
    const d = JSON.parse(readFileSync(stateFile, "utf-8")) as {
      current_step?: number;
      steps?: Record<
        string,
        { name?: string; agent?: string; blockers?: { resolved?: boolean }[] }
      >;
      overall_status?: string;
      project_name?: string;
    };
    const s = d.current_step ?? 0;
    const step = d.steps?.[String(s)] ?? {};
    const name = step.name ?? "";
    const agent = step.agent ?? "";
    const status = d.overall_status ?? "not_started";
    const blockers = (step.blockers ?? []).filter((b) => !b.resolved).length;
    const projectName = d.project_name ?? "?";
    return JSON.stringify({
      systemMessage: `[Workflow] ${projectName} | ${status} | Step ${s}: ${name} | @${agent} | Blockers: ${blockers} | Use wf_state() not cat | Monitor: flowctl monitor`,
    });
  } catch {
    return null;
  }
}
