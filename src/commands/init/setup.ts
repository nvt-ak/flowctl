/**
 * Port of `scripts/setup.sh` — Graphify, GitNexus, MCP merge, .gitignore (Phase 3 init).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import chalk from "chalk";
import { mergeCursorMcp, type MergeCursorMcpResult } from "@/integrations/mcp-merge";
import { pathExists } from "@/utils/fs";

export type SetupMode = "all" | "mcp-only" | "index-only" | "no-index";

export type SetupRunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

export type SetupLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  ok: (msg: string) => void;
  err: (msg: string) => void;
};

export type SetupDeps = {
  projectRoot: string;
  workflowRoot: string;
  commandExists: (cmd: string) => boolean | Promise<boolean>;
  run: (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<SetupRunResult>;
  log?: SetupLogger;
  mergeMcp?: (opts: {
    mcpPath: string;
    overwrite: boolean;
    mode: { type: "setup" };
  }) => Promise<MergeCursorMcpResult>;
};

export const GRAPHIFY_IGNORE_TEMPLATE = `# flowctl: exclude workflow/config files from code graph
CLAUDE.md
AGENTS.md
*.md
.cursor/
workflows/
plans/
graphify-out/
scripts/
*.sh
*.json
*.yaml
*.yml
`;

export const GITIGNORE_ENTRIES = [
  "graphify-out/cache/",
  "graphify-out/memory/",
  ".gitnexus/",
  "node_modules/",
  "__pycache__/",
  "*.pyc",
  ".env",
  ".env.local",
  ".flowctl/",
  ".flowctl/projects/",
  ".flowctl-local/",
];

const GRAPH_JSON_NEGATION = "!graphify-out/graph.json";

export function parseSetupMode(argv: string[]): SetupMode {
  const arg = (argv[0] ?? "all").trim();
  switch (arg) {
    case "--mcp-only":
      return "mcp-only";
    case "--index-only":
      return "index-only";
    case "--no-index":
      return "no-index";
    default:
      return "all";
  }
}

export function appendGitignoreEntries(
  existing: string,
  entries: string[],
): { text: string; added: string[] } {
  const lines = existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n` : existing;
  const present = new Set(
    lines
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0),
  );
  const added: string[] = [];
  let text = lines;
  for (const entry of entries) {
    if (entry.startsWith("#")) continue;
    if (present.has(entry)) continue;
    text += `${entry}\n`;
    present.add(entry);
    added.push(entry);
  }
  if (!present.has(GRAPH_JSON_NEGATION)) {
    text += `${GRAPH_JSON_NEGATION}\n`;
    added.push(GRAPH_JSON_NEGATION);
  }
  return { text, added };
}

export async function updateGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = join(projectRoot, ".gitignore");
  let existing = "";
  if (await pathExists(gitignorePath)) {
    existing = await readFile(gitignorePath, "utf-8");
  }
  const { text } = appendGitignoreEntries(existing, GITIGNORE_ENTRIES);
  await writeFile(gitignorePath, text, "utf-8");
}

export async function ensureGraphifyIgnore(projectRoot: string): Promise<boolean> {
  const ignorePath = join(projectRoot, ".graphifyignore");
  if (await pathExists(ignorePath)) return false;
  await writeFile(ignorePath, GRAPHIFY_IGNORE_TEMPLATE, "utf-8");
  return true;
}

async function defaultCommandExists(cmd: string): Promise<boolean> {
  try {
    const r = await execa("which", [cmd], { reject: false, stdio: "pipe" });
    return r.exitCode === 0 && (r.stdout ?? "").trim().length > 0;
  } catch {
    return false;
  }
}

async function defaultRun(
  cmd: string,
  args: string[],
  opts?: { cwd?: string },
): Promise<SetupRunResult> {
  const r = await execa(cmd, args, {
    cwd: opts?.cwd,
    reject: false,
    stdio: "pipe",
  });
  return {
    ok: r.exitCode === 0,
    stdout: String(r.stdout ?? ""),
    stderr: String(r.stderr ?? ""),
  };
}

function defaultLogger(): SetupLogger {
  return {
    info: (msg) => console.log(chalk.cyan(`[→] ${msg}`)),
    warn: (msg) => console.warn(chalk.yellow(`[!] ${msg}`)),
    ok: (msg) => console.log(chalk.green(`[✓] ${msg}`)),
    err: (msg) => {
      console.error(chalk.red(`[✗] ${msg}`));
    },
  };
}

export function createDefaultSetupDeps(
  projectRoot: string,
  workflowRoot: string,
): SetupDeps {
  return {
    projectRoot,
    workflowRoot,
    commandExists: defaultCommandExists,
    run: defaultRun,
    log: defaultLogger(),
    mergeMcp: (opts) =>
      mergeCursorMcp({
        mcpPath: opts.mcpPath,
        overwrite: opts.overwrite,
        mode: opts.mode,
      }),
  };
}

export async function checkPrerequisites(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();
  log.info("Checking prerequisites...");

  const hasPython = await deps.commandExists("python3");
  if (!hasPython) {
    throw new Error("Python 3 is required. Install from https://python.org");
  }

  const hasPip =
    (await deps.commandExists("pip")) || (await deps.commandExists("pip3"));
  if (!hasPip) {
    throw new Error("pip is required. Run: python3 -m ensurepip");
  }

  if (!(await deps.commandExists("node"))) {
    log.warn("Node.js not found — GitNexus MCP will be skipped");
  }
  if (!(await deps.commandExists("npm"))) {
    log.warn("npm not found — GitNexus MCP will be skipped");
  }

  log.ok("Prerequisites OK");
}

async function pythonImportsGraphify(deps: SetupDeps): Promise<boolean> {
  const r = await deps.run("python3", ["-c", "import graphify"], {
    cwd: deps.projectRoot,
  });
  return r.ok;
}

async function pipInstallGraphify(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();
  const pip = (await deps.commandExists("pip")) ? "pip" : "pip3";
  const r = await deps.run(pip, ["install", "graphifyy", "--quiet"], {
    cwd: deps.projectRoot,
  });
  if (!r.ok) {
    throw new Error(
      `Could not install Graphify. Run manually: ${pip} install graphifyy`,
    );
  }
  log.ok("Graphify installed");
}

export async function installGraphify(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();
  log.info("Installing Graphify (codebase knowledge graph)...");

  if (await pythonImportsGraphify(deps)) {
    log.ok("Graphify already installed (skip)");
    return;
  }

  await pipInstallGraphify(deps);
}

export async function installGitnexus(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();

  if (!(await deps.commandExists("node"))) {
    log.warn("Skipping GitNexus (Node.js not available)");
    return;
  }

  log.info("Installing GitNexus (code intelligence engine)...");

  const versionCheck = await deps.run("npx", ["gitnexus", "--version"], {
    cwd: deps.projectRoot,
  });
  if (versionCheck.ok) {
    log.ok("GitNexus already available (skip)");
    return;
  }

  const gitnexusDir = join(deps.projectRoot, ".gitnexus");
  await mkdir(gitnexusDir, { recursive: true });
  const install = await deps.run(
    "npm",
    ["install", "--prefix", gitnexusDir, "gitnexus"],
    { cwd: deps.projectRoot },
  );
  if (!install.ok) {
    log.warn("npm install gitnexus failed — will use npx gitnexus when needed");
    return;
  }

  log.ok("GitNexus ready (via npx)");
}

export async function installMcpDeps(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();

  if (
    !(await deps.commandExists("node")) ||
    !(await deps.commandExists("npm"))
  ) {
    log.warn("Skipping MCP deps (Node.js/npm not available)");
    return;
  }

  const flowctlPkgDir = deps.workflowRoot;
  const pkgJson = join(flowctlPkgDir, "package.json");
  const mcpModules = join(flowctlPkgDir, "node_modules", "@modelcontextprotocol");

  if (!(await pathExists(pkgJson)) || (await pathExists(mcpModules))) {
    log.ok("MCP dependencies OK (skip)");
    return;
  }

  log.info("Installing MCP SDK dependencies (dev/source mode)...");
  const r = await deps.run(
    "npm",
    ["install", "--prefix", flowctlPkgDir, "--prefer-offline"],
    { cwd: flowctlPkgDir },
  );
  if (r.ok) {
    log.ok("MCP dependencies installed");
  } else {
    log.warn(
      `npm install failed — run manually: cd ${flowctlPkgDir} && npm install`,
    );
  }
}

export async function indexCodebase(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();
  log.info("Indexing codebase with Graphify...");

  if (await ensureGraphifyIgnore(deps.projectRoot)) {
    log.ok(".graphifyignore created");
  }

  if (await pythonImportsGraphify(deps)) {
    const hook = await deps.run(
      "python3",
      ["-m", "graphify", "hook", "install"],
      { cwd: deps.projectRoot },
    );
    if (hook.ok) {
      log.ok("Graphify git hooks installed");
    } else {
      log.warn(
        "graphify hook install failed — graph will not auto-update on commit",
      );
    }
  }

  const index = await deps.run(
    "python3",
    ["-m", "graphify", "update", "."],
    { cwd: deps.projectRoot },
  );
  if (index.ok) {
    log.ok("Graphify index complete → graphify-out/graph.json");
  } else {
    log.warn("graphify index failed — run manually: python3 -m graphify update .");
  }
}

export async function configureCursorMcp(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();
  const merge = deps.mergeMcp ?? createDefaultSetupDeps(deps.projectRoot, deps.workflowRoot).mergeMcp!;
  log.info("Configuring Cursor MCP servers...");

  const cursorDir = join(deps.projectRoot, ".cursor");
  await mkdir(cursorDir, { recursive: true });
  const mcpPath = join(cursorDir, "mcp.json");

  const result = await merge({
    mcpPath,
    overwrite: false,
    mode: { type: "setup" },
  });

  if (result.exitCode === 2) {
    log.warn(
      ".cursor/mcp.json is invalid — fix manually or run flowctl init --overwrite then setup again",
    );
    return;
  }

  if (result.exitCode !== 0) {
    throw new Error(`mergeCursorMcp failed (exit ${result.exitCode})`);
  }

  const statusLine =
    result.lines.find((l) => l.startsWith("MCP_STATUS=")) ?? "MCP_STATUS=updated";
  const status = statusLine.replace("MCP_STATUS=", "");
  switch (status) {
    case "created":
      log.ok(".cursor/mcp.json created");
      break;
    case "overwritten":
      log.ok(".cursor/mcp.json overwritten (setup template)");
      break;
    case "merged":
      log.ok(".cursor/mcp.json merged (added missing flowctl servers)");
      break;
    case "unchanged":
      log.ok(".cursor/mcp.json in sync (no missing flowctl servers)");
      break;
    default:
      log.ok(".cursor/mcp.json updated");
  }
}

export async function startMcpServers(deps: SetupDeps): Promise<void> {
  const log = deps.log ?? defaultLogger();
  log.info("Starting MCP servers...");

  if (await pythonImportsGraphify(deps)) {
    log.ok("Graphify installed — Cursor will start MCP from mcp.json when needed");
  } else {
    log.warn("Graphify not installed — run: pip install graphifyy");
  }

  log.ok("MCP servers configured. Cursor will start them when needed.");
}

function printSummary(): void {
  console.log("");
  console.log(chalk.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.green("   Setup complete!"));
  console.log(chalk.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log("");
  console.log(chalk.cyan("  Next steps:"));
  console.log("  1. Reload Cursor window (Cmd/Ctrl+Shift+P → Reload)");
  console.log("  2. Check MCP servers: Cursor → Settings → MCP");
  console.log(chalk.cyan("  3. Start workflow: ") + chalk.yellow("flowctl start"));
  console.log(chalk.cyan("  4. Status: ") + chalk.yellow("flowctl status"));
  console.log("");
}

export async function runSetup(options: {
  projectRoot?: string;
  workflowRoot?: string;
  mode?: SetupMode;
  argv?: string[];
  deps?: SetupDeps;
  printSummary?: boolean;
}): Promise<number> {
  const projectRoot =
    options.projectRoot ??
    process.env.FLOWCTL_PROJECT_ROOT ??
    process.cwd();
  const workflowRoot = options.workflowRoot ?? projectRoot;
  const mode = options.mode ?? parseSetupMode(options.argv ?? []);
  const deps =
    options.deps ?? createDefaultSetupDeps(projectRoot, workflowRoot);
  const log = deps.log ?? defaultLogger();

  console.log("");
  console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.blue("   IT Product Team Workflow — Setup"));
  console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log("");
  log.info(`Project root: ${projectRoot}`);

  switch (mode) {
    case "mcp-only":
      await checkPrerequisites(deps);
      await configureCursorMcp(deps);
      break;
    case "index-only":
      await installGraphify(deps);
      await indexCodebase(deps);
      break;
    case "no-index":
      await checkPrerequisites(deps);
      await installMcpDeps(deps);
      await installGraphify(deps);
      await installGitnexus(deps);
      await configureCursorMcp(deps);
      await updateGitignore(projectRoot);
      await startMcpServers(deps);
      break;
    case "all":
    default:
      await checkPrerequisites(deps);
      await installMcpDeps(deps);
      await installGraphify(deps);
      await installGitnexus(deps);
      await indexCodebase(deps);
      await configureCursorMcp(deps);
      await updateGitignore(projectRoot);
      await startMcpServers(deps);
      break;
  }

  if (options.printSummary !== false && (mode === "all" || mode === "no-index")) {
    printSummary();
  }

  return 0;
}
