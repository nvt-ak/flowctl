import { z } from "zod";

const BlockerSchema = z.object({
  id: z.string(),
  description: z.string(),
  created_at: z.string(),
  resolved: z.boolean(),
  resolved_at: z.string().optional(),
  resolved_by: z.string().optional(),
  source: z.string().optional(),
});

const DecisionSchema = z.object({
  id: z.string(),
  description: z.string(),
  date: z.string(),
  type: z.string().optional(),
  source: z.string().optional(),
});

const DeliverableSchema = z.union([
  z.string(),
  z.object({
    claim: z.string(),
    path: z.string(),
    verified: z.boolean(),
    source: z.string(),
  }),
]);

const DispatchRiskSchema = z
  .object({
    high_risk: z.boolean().optional(),
    impacted_modules: z.number().optional(),
    dispatch_count: z.number().default(0),
  })
  .optional();

const StepSchema = z.object({
  name: z.string(),
  agent: z.string(),
  support_agents: z.array(z.string()).default([]),
  status: z.enum([
    "pending",
    "in_progress",
    "completed",
    "rejected",
    "skipped",
  ]),
  started_at: z.string().nullable().default(null),
  completed_at: z.string().nullable().default(null),
  approved_at: z.string().nullable().default(null),
  approved_by: z.string().nullable().default(null),
  approval_status: z.string().nullable().default(null),
  graphify_snapshot: z.unknown().nullable().default(null),
  notes: z.string().default(""),
  deliverables: z.array(DeliverableSchema).default([]),
  blockers: z.array(BlockerSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  dispatch_risk: DispatchRiskSchema,
  skip_reason: z.string().optional(),
  skip_type: z.string().optional(),
  skipped_by: z.string().optional(),
  skipped_at: z.string().optional(),
});

export const FlowctlStateSchema = z.object({
  version: z.string().default("1.0.0"),
  flow_id: z.string().default(""),
  project_name: z.string().default(""),
  project_description: z.string().default(""),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
  current_step: z.number().default(1),
  overall_status: z.enum([
    "not_started",
    "pending",
    "in_progress",
    "completed",
    "rejected",
  ]),
  steps: z.record(z.string(), StepSchema),
  graphify: z
    .object({
      last_indexed: z.string().nullable().default(null),
      graph_path: z.string().default(".graphify/graph.json"),
      snapshots: z.array(z.unknown()).default([]),
    })
    .optional(),
  gitnexus: z
    .object({
      last_analyzed: z.string().nullable().default(null),
      total_changes_tracked: z.number().default(0),
    })
    .optional(),
  metrics: z
    .object({
      total_blockers: z.number().default(0),
      total_decisions: z.number().default(0),
      steps_completed: z.number().default(0),
      on_schedule: z.boolean().default(true),
    })
    .optional(),
  settings: z
    .object({
      war_room_threshold: z.number().nullable().optional(),
    })
    .optional(),
}).strict();

export type FlowctlState = z.infer<typeof FlowctlStateSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Blocker = z.infer<typeof BlockerSchema>;
export type Decision = z.infer<typeof DecisionSchema>;

/** Strip template-only keys before Zod parse. */
export function normalizeRaw(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const { _comment: _ignored, ...rest } = raw as Record<string, unknown>;
  return rest;
}
