import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import {
  createContext,
  invalidateContextCache,
} from "@/cli/context";
import { ensureDataDirs, refreshRuntimePaths } from "@/config/paths";
import {
  flowsJsonPath,
  mutateFlowsIndex,
  readFlowsIndex,
} from "@/config/flows-registry";
import { defaultState } from "@/state/default-state";
import { readState } from "@/state/reader";
import { FlowctlStateSchema } from "@/state/schema";
import { atomicJsonWrite } from "@/utils/json";
import { pathExists } from "@/utils/fs";
import { nowTimestamp } from "@/utils/time";

export type InitOptions = {
  project?: string;
  overwrite?: boolean;
  noSetup?: boolean;
};

async function runScaffoldMerge(
  projectRoot: string,
  workflowRoot: string,
  overwrite: boolean,
): Promise<void> {
  if (process.env.FLOWCTL_ENGINE === "ts") {
    console.log(
      chalk.yellow(
        "TS engine: skipped .cursor/mcp.json merge — Phase 4 (migration-plan §Phase 3 week 4).",
      ),
    );
    return;
  }
  const script = join(workflowRoot, "scripts", "merge_cursor_mcp.py");
  if (!(await pathExists(script))) {
    console.warn(chalk.yellow(`merge script missing: ${script}`));
    return;
  }
  const mcpPath = join(projectRoot, ".cursor", "mcp.json");
  const pyArgs = overwrite
    ? [script, "--overwrite", "--scaffold", "flowctl", mcpPath]
    : [script, "--scaffold", "flowctl", mcpPath];
  await new Promise<number>((res, rej) => {
    const ch = spawn("python3", pyArgs, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    ch.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    ch.on("error", rej);
    ch.on("close", (c) => {
      if (c === 2) {
        console.warn(
          chalk.yellow(
            ".cursor/mcp.json: invalid JSON — fix manually or run init --overwrite",
          ),
        );
      } else if (c !== 0 && stderr.includes("PermissionError")) {
        console.warn(
          chalk.yellow(".cursor/mcp.json: permission denied — skipped merge"),
        );
      } else if (c !== 0) {
        console.warn(chalk.yellow(`merge_cursor_mcp.py exited ${c}`));
      }
      res(c ?? 1);
    });
  });
}

async function copyScaffoldTree(
  src: string,
  dst: string,
  overwrite: boolean,
): Promise<void> {
  if (!(await pathExists(src))) return;
  if (!(await pathExists(dst))) {
    await cp(src, dst, { recursive: true });
    return;
  }
  if (overwrite) {
    await cp(src, dst, { recursive: true, force: true });
  }
}

async function ensureGateTemplates(
  projectRoot: string,
  workflowRoot: string,
  overwrite: boolean,
): Promise<void> {
  const pairs: [string, string][] = [
    ["qa-gate.v1.json", join("workflows", "gates", "qa-gate.v1.json")],
    ["budget-policy.v1.json", join("workflows", "policies", "budget-policy.v1.json")],
    ["role-policy.v1.json", join("workflows", "policies", "role-policy.v1.json")],
  ];
  for (const [tpl, rel] of pairs) {
    const src = join(workflowRoot, "templates", tpl);
    const dest = join(projectRoot, rel);
    if (!(await pathExists(src))) continue;
    if ((await pathExists(dest)) && !overwrite) continue;
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
  }
}

/** Copy scaffold assets (partial Phase 3 — MCP merge delegates to Python unless FLOWCTL_ENGINE=ts). */
export async function ensureProjectScaffold(
  projectRoot: string,
  workflowRoot: string,
  overwrite: boolean,
): Promise<void> {
  await mkdir(join(projectRoot, ".cursor"), { recursive: true });
  await mkdir(join(projectRoot, ".claude"), { recursive: true });
  await mkdir(join(projectRoot, "workflows", "gates"), { recursive: true });
  await mkdir(join(projectRoot, "workflows", "policies"), { recursive: true });

  await runScaffoldMerge(projectRoot, workflowRoot, overwrite);

  const settingsSrc = join(workflowRoot, ".claude", "settings.json");
  const settingsDst = join(projectRoot, ".claude", "settings.json");
  if (await pathExists(settingsSrc)) {
    if (!(await pathExists(settingsDst)) || overwrite) {
      await copyFile(settingsSrc, settingsDst);
    }
  }

  await ensureGateTemplates(projectRoot, workflowRoot, overwrite);

  for (const dir of ["agents", "commands", "rules", "skills", "templates"] as const) {
    await copyScaffoldTree(
      join(workflowRoot, ".cursor", dir),
      join(projectRoot, ".cursor", dir),
      overwrite,
    );
  }

  const crSrc = join(workflowRoot, ".cursorrules");
  const crDst = join(projectRoot, ".cursorrules");
  if (await pathExists(crSrc) && (!(await pathExists(crDst)) || overwrite)) {
    await copyFile(crSrc, crDst);
  }
}

async function bootstrapStateFile(
  projectRoot: string,
  projectName: string,
  overwrite: boolean,
): Promise<string> {
  const flowsPath = flowsJsonPath(projectRoot);

  if (overwrite && (await pathExists(flowsPath))) {
    const idx = await readFlowsIndex(projectRoot);
    const active = idx?.active_flow_id;
    const rel = active ? idx?.flows[active]?.state_file : undefined;
    if (rel) {
      const abs = resolve(projectRoot, rel);
      if (await pathExists(abs)) {
        let fid = "";
        try {
          const raw = JSON.parse(await readFile(abs, "utf-8")) as {
            flow_id?: string;
          };
          fid = (raw.flow_id ?? "").trim();
        } catch {
          fid = "";
        }
        const fresh = defaultState();
        if (fid) fresh.flow_id = fid;
        fresh.project_name = projectName;
        const now = nowTimestamp();
        fresh.created_at = now;
        fresh.updated_at = now;
        fresh.current_step = 1;
        fresh.overall_status = "in_progress";
        if (fresh.steps["1"]) fresh.steps["1"].status = "pending";
        await writeFile(
          abs,
          `${JSON.stringify(FlowctlStateSchema.parse(fresh), null, 2)}\n`,
          "utf-8",
        );
        return abs;
      }
    }
  }

  const idx = await readFlowsIndex(projectRoot);
  if (idx?.active_flow_id) {
    const rel = idx.flows[idx.active_flow_id]?.state_file;
    if (rel) {
      const abs = resolve(projectRoot, rel);
      if (await pathExists(abs)) return abs;
    }
  }

  const flowId = `wf-${randomUUID()}`;
  const short = randomUUID().replace(/-/g, "").slice(0, 10);
  const rel = `.flowctl/flows/${short}/state.json`;
  const dest = resolve(projectRoot, rel);
  const state = defaultState();
  state.flow_id = flowId;
  state.project_name = projectName;
  const now = nowTimestamp();
  state.created_at = state.created_at || now;
  state.updated_at = now;

  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

  await mutateFlowsIndex(projectRoot, (index) => {
    index.flows[flowId] = { state_file: rel, label: "" };
    index.active_flow_id = flowId;
  });

  return dest;
}

async function finalizeInitState(
  stateFile: string,
  projectName: string,
  preservedFlowId: string,
): Promise<void> {
  await atomicJsonWrite(
    stateFile,
    (cur) => {
      const next = structuredClone(cur);
      next.project_name = projectName;
      const now = nowTimestamp();
      next.created_at = next.created_at || now;
      next.updated_at = now;
      next.current_step = 1;
      next.overall_status = "in_progress";
      const fid = preservedFlowId.trim() || next.flow_id?.trim();
      if (fid) next.flow_id = fid;
      else if (!next.flow_id?.trim()) next.flow_id = `wf-${randomUUID()}`;
      if (next.steps["1"]) next.steps["1"].status = "pending";
      return FlowctlStateSchema.parse(next);
    },
    FlowctlStateSchema,
  );
}

async function writeProjectMeta(
  paths: Awaited<ReturnType<typeof refreshRuntimePaths>>,
  projectRoot: string,
  flowId: string,
  projectName: string,
): Promise<void> {
  const metaPath = join(paths.dataDir, "meta.json");
  let createdAt = new Date().toISOString();
  if (await pathExists(metaPath)) {
    try {
      const ex = JSON.parse(await readFile(metaPath, "utf-8")) as {
        created_at?: string;
      };
      if (ex.created_at) createdAt = ex.created_at;
    } catch {
      /* keep */
    }
  }
  const now = new Date().toISOString();
  const meta = {
    project_id: flowId,
    project_name: projectName,
    path: projectRoot,
    cache_dir: paths.cacheDir,
    runtime_dir: paths.runtimeDir,
    created_at: createdAt,
    last_seen: now,
  };
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.cacheDir, { recursive: true });
  await mkdir(join(paths.runtimeDir, "evidence"), { recursive: true });
  await mkdir(join(paths.runtimeDir, "release-dashboard"), { recursive: true });
  await mkdir(join(paths.flowctlHome, "projects"), { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

async function ensureGlobalConfig(flowctlHome: string): Promise<void> {
  const p = join(flowctlHome, "config.json");
  if (await pathExists(p)) return;
  await mkdir(flowctlHome, { recursive: true });
  const body = {
    version: 1,
    monitor: { default_port: 3170, auto_open_browser: true },
    defaults: { budget_per_step: 12000, prune_after_days: 30 },
    theme: "dark",
  };
  await writeFile(p, JSON.stringify(body, null, 2), "utf-8");
}

async function maybeRunSetup(
  workflowRoot: string,
  projectRoot: string,
  isNewProject: boolean,
  runSetup: boolean,
): Promise<void> {
  if (!runSetup || !isNewProject) {
    if (runSetup && !isNewProject) {
      console.log(
        chalk.cyan(
          "Project đã tồn tại — bỏ qua setup (dùng --overwrite để chạy lại setup).",
        ),
      );
    }
    return;
  }
  const setupScript = join(workflowRoot, "scripts", "setup.sh");
  if (!(await pathExists(setupScript))) {
    console.warn(chalk.yellow(`Không tìm thấy setup: ${setupScript} (bỏ qua)`));
    return;
  }
  console.log(chalk.cyan("Chạy setup (Graphify, MCP, .gitignore)..."));
  const code = await new Promise<number>((res, rej) => {
    const env = { ...process.env, FLOWCTL_PROJECT_ROOT: projectRoot };
    const sh = spawn("bash", [setupScript], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });
    sh.on("error", rej);
    sh.on("close", (c) => res(c ?? 1));
  });
  if (code === 0) console.log(chalk.green("Setup hoàn tất."));
  else
    console.warn(
      chalk.yellow(
        `setup.sh thoát ${code} — chạy lại: FLOWCTL_PROJECT_ROOT="${projectRoot}" bash "${setupScript}"`,
      ),
    );
}

/**
 * Partial `flowctl init` (Phase 3 week 4): flows bootstrap, state finalize, scaffold,
 * optional setup.sh. MCP merge delegates to merge_cursor_mcp.py unless FLOWCTL_ENGINE=ts.
 */
export async function runInit(ctx: FlowctlContext, opts: InitOptions = {}): Promise<void> {
  const skipSetup =
    opts.noSetup === true || process.env.FLOWCTL_SKIP_SETUP === "1";
  const runSetup = !skipSetup;
  const overwrite = opts.overwrite === true;

  let projectName = (opts.project ?? "").trim();
  if (!projectName) {
    projectName = ctx.projectRoot.split("/").pop() || "Project";
  }

  const hadStateBefore =
    !!ctx.stateFile && (await pathExists(ctx.stateFile));

  let preservedFlowId = "";
  if (hadStateBefore && ctx.stateFile) {
    const r = await readState(ctx.stateFile);
    if (r.ok) preservedFlowId = (r.data.flow_id ?? "").trim();
  }

  const statePath = await bootstrapStateFile(
    ctx.projectRoot,
    projectName,
    overwrite,
  );

  await ensureProjectScaffold(ctx.projectRoot, ctx.workflowRoot, overwrite);

  invalidateContextCache();
  const fresh = await createContext(ctx.projectRoot, process.env);
  const activeState = fresh.stateFile ?? statePath;

  await finalizeInitState(activeState, projectName, preservedFlowId);

  const paths = await refreshRuntimePaths(fresh.projectRoot, activeState, {
    flowctlHome: process.env.FLOWCTL_HOME,
    env: process.env as Record<string, string | undefined>,
  });

  await ensureDataDirs(paths);
  await ensureGlobalConfig(paths.flowctlHome);

  const st = await readState(activeState);
  const fid = st.ok ? (st.data.flow_id ?? "") : "";
  if (fid) {
    await writeProjectMeta(paths, ctx.projectRoot, fid, projectName);
  }

  const isNewProject = !hadStateBefore || overwrite;
  await maybeRunSetup(ctx.workflowRoot, ctx.projectRoot, isNewProject, runSetup);

  console.log("");
  console.log(chalk.green(`Project "${projectName}" đã được khởi tạo.`));
  console.log(chalk.cyan("Step hiện tại: 1 — Requirements Analysis"));
  console.log(chalk.cyan("Agent cần dùng: @pm (hỗ trợ: @tech-lead)"));
  console.log(chalk.cyan("Bước tiếp theo: flowctl start"));
  if (overwrite) {
    console.log(
      chalk.yellow(
        `Ghi đè scaffold chỉ khi thật sự cần: flowctl init --overwrite --project "${projectName}"`,
      ),
    );
  }
  if (skipSetup) {
    console.log(
      chalk.cyan("Đã bỏ qua setup (dùng --no-setup hoặc FLOWCTL_SKIP_SETUP=1)."),
    );
  }
  console.log("");
}
