import { readFile } from "node:fs/promises";
import { z } from "zod";
import { pathExists } from "@/utils/fs";

export type DispatchMode = "manual" | "headless" | "launch";

const RolePolicySchema = z.object({
  version: z.string().optional(),
  defaults: z
    .object({
      allow_trust: z.boolean().optional(),
      allowed_modes: z.array(z.string()).optional(),
    })
    .optional(),
  roles: z
    .record(
      z.string(),
      z.object({
        allow_trust: z.boolean().optional(),
        allowed_modes: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export type RolePolicy = z.infer<typeof RolePolicySchema>;

export class PolicyViolationError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`POLICY_VIOLATION|${violations.join(" ; ")}`);
    this.violations = violations;
  }
}

export async function loadRolePolicy(
  policyFile: string,
): Promise<RolePolicy> {
  if (!(await pathExists(policyFile))) {
    return {
      defaults: {
        allow_trust: false,
        allowed_modes: ["manual", "headless", "launch"],
      },
      roles: {},
    };
  }
  const raw = JSON.parse(await readFile(policyFile, "utf-8"));
  return RolePolicySchema.parse(raw);
}

export function validateDispatchPolicy(
  roles: string[],
  policy: RolePolicy,
  opts: { mode: DispatchMode; trustRequested: boolean },
): void {
  const defaults = policy.defaults ?? {};
  const roleOverrides = policy.roles ?? {};
  const violations: string[] = [];

  for (const role of roles) {
    const roleCfg = roleOverrides[role] ?? {};
    const allowTrust = roleCfg.allow_trust ?? defaults.allow_trust ?? false;
    const modes =
      roleCfg.allowed_modes ??
      defaults.allowed_modes ??
      (["manual", "headless", "launch"] as DispatchMode[]);

    if (!modes.includes(opts.mode)) {
      violations.push(
        `@${role}: mode '${opts.mode}' not allowed (allowed=${modes.join(",")})`,
      );
    }
    if (opts.trustRequested && !allowTrust) {
      violations.push(`@${role}: --trust is denied by policy`);
    }
  }

  if (violations.length > 0) {
    throw new PolicyViolationError(violations);
  }
}

export function validateMaxRetries(raw: string): void {
  let n: number;
  try {
    n = Number.parseInt(raw, 10);
  } catch {
    throw new PolicyViolationError([
      `max_retries_invalid|value=${JSON.stringify(raw)}`,
    ]);
  }
  if (Number.isNaN(n) || String(n) !== raw.trim()) {
    throw new PolicyViolationError([
      `max_retries_invalid|value=${JSON.stringify(raw)}`,
    ]);
  }
  if (n < 0) {
    throw new PolicyViolationError([`max_retries_negative|value=${n}`]);
  }
  if (n > 20) {
    throw new PolicyViolationError([`max_retries_excessive|value=${n}`]);
  }
}
