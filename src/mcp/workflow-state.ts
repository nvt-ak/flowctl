/**
 * flowctl-state MCP server (TypeScript port of scripts/workflow/mcp/workflow-state.js).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { resolveMcpStatePath } from "@/mcp/resolve-mcp-state-path";

const FlowAdvanceStepArgs = z.object({
  by: z.string().optional(),
  notes: z.string().optional(),
  skip_gate: z.boolean().optional(),
});

const FlowRequestApprovalArgs = z.object({
  note: z.string().optional(),
});

const FlowDescriptionArgs = z.object({
  description: z.string().min(1, "description is required"),
});

export type WorkflowStateDeps = {
  repoRoot: string;
  stateFile: string;
  runWorkflowCommand: (args: string[]) => string;
  readWorkflowState: () => unknown;
};

export function createWorkflowStateDeps(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): WorkflowStateDeps {
  const stateFile = resolveMcpStatePath(repoRoot, env);
  return {
    repoRoot,
    stateFile,
    runWorkflowCommand(args: string[]) {
      return execFileSync("flowctl", args.map(String), {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        env: { ...env, FLOWCTL_PROJECT_ROOT: repoRoot },
      }).trim();
    },
    readWorkflowState() {
      if (!existsSync(stateFile)) {
        return {
          error:
            "flowctl-state.json not found. Run `flowctl init --project \"Name\"` first.",
        };
      }
      return JSON.parse(readFileSync(stateFile, "utf-8")) as unknown;
    },
  };
}

export function toolGetState(deps: WorkflowStateDeps): unknown {
  return deps.readWorkflowState();
}

export function toolAddBlocker(
  deps: WorkflowStateDeps,
  args: z.infer<typeof FlowDescriptionArgs>,
): unknown {
  const output = deps.runWorkflowCommand(["blocker", "add", args.description]);
  return { ok: true, output, state: deps.readWorkflowState() };
}

export function toolAddDecision(
  deps: WorkflowStateDeps,
  args: z.infer<typeof FlowDescriptionArgs>,
): unknown {
  const output = deps.runWorkflowCommand(["decision", args.description]);
  return { ok: true, output, state: deps.readWorkflowState() };
}

export function toolAdvanceStep(
  deps: WorkflowStateDeps,
  args: z.infer<typeof FlowAdvanceStepArgs>,
): unknown {
  const approver = args.by?.trim() ? args.by : "Workflow MCP";
  const commandArgs = ["approve", "--by", approver];
  if (args.skip_gate === true) commandArgs.push("--skip-gate");
  if (args.notes?.trim()) {
    deps.runWorkflowCommand(["decision", args.notes]);
  }
  const output = deps.runWorkflowCommand(commandArgs);
  return { ok: true, output, state: deps.readWorkflowState() };
}

export function toolRequestApproval(
  deps: WorkflowStateDeps,
  args: z.infer<typeof FlowRequestApprovalArgs>,
): unknown {
  const note = args.note?.trim()
    ? args.note
    : "Approval requested via flowctl-state MCP.";
  const output = deps.runWorkflowCommand(["decision", `[APPROVAL REQUEST] ${note}`]);
  return { ok: true, output, state: deps.readWorkflowState() };
}

type WorkflowTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  schema: z.ZodType<unknown>;
  handler: (deps: WorkflowStateDeps, args: unknown) => unknown;
};

const WORKFLOW_TOOLS: WorkflowTool[] = [
  {
    name: "flow_get_state",
    description: "Read current flowctl-state.json payload.",
    inputSchema: { type: "object", properties: {} },
    schema: z.object({}),
    handler: (deps) => toolGetState(deps),
  },
  {
    name: "flow_advance_step",
    description: "Approve current step and move to the next step.",
    inputSchema: {
      type: "object",
      properties: {
        by: { type: "string" },
        notes: { type: "string" },
        skip_gate: { type: "boolean" },
      },
    },
    schema: FlowAdvanceStepArgs,
    handler: (deps, args) => toolAdvanceStep(deps, args as z.infer<typeof FlowAdvanceStepArgs>),
  },
  {
    name: "flow_request_approval",
    description: "Record an approval request note in flowctl decisions.",
    inputSchema: {
      type: "object",
      properties: { note: { type: "string" } },
    },
    schema: FlowRequestApprovalArgs,
    handler: (deps, args) =>
      toolRequestApproval(deps, args as z.infer<typeof FlowRequestApprovalArgs>),
  },
  {
    name: "flow_add_blocker",
    description: "Add blocker to current step.",
    inputSchema: {
      type: "object",
      properties: { description: { type: "string" } },
      required: ["description"],
    },
    schema: FlowDescriptionArgs,
    handler: (deps, args) => toolAddBlocker(deps, args as z.infer<typeof FlowDescriptionArgs>),
  },
  {
    name: "flow_add_decision",
    description: "Add decision to current step.",
    inputSchema: {
      type: "object",
      properties: { description: { type: "string" } },
      required: ["description"],
    },
    schema: FlowDescriptionArgs,
    handler: (deps, args) => toolAddDecision(deps, args as z.infer<typeof FlowDescriptionArgs>),
  },
];

export function handleWorkflowToolCall(
  deps: WorkflowStateDeps,
  name: string,
  rawArgs: unknown,
): { ok: true; result: unknown } | { ok: false; error: string } {
  const tool = WORKFLOW_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid arguments";
    return { ok: false, error: msg };
  }
  try {
    return { ok: true, result: tool.handler(deps, parsed.data) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function startWorkflowStateMcp(
  repoRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const deps = createWorkflowStateDeps(repoRoot, env);
  const server = new Server(
    { name: "flowctl-state", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: WORKFLOW_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const outcome = handleWorkflowToolCall(deps, req.params.name, req.params.arguments);
    if (!outcome.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: outcome.error }) }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
