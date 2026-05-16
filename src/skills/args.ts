/** Shared argv parsing for skills CLI scripts (list, search, load). */

export type SkillsFilterFlags = {
  role: string | null;
  tag: string | null;
  trigger: string | null;
  format: string;
  limit: number;
  consumed: Set<number>;
};

function flagValue(args: string[], flag: string): { idx: number; value: string | null } {
  const idx = args.indexOf(flag);
  if (idx < 0) return { idx: -1, value: null };
  return { idx, value: args[idx + 1] ?? null };
}

export function parseFilterFlags(
  args: string[],
  options: { defaultFormat?: string; defaultLimit?: number } = {},
): SkillsFilterFlags {
  const defaultFormat = options.defaultFormat ?? "table";
  const defaultLimit = options.defaultLimit ?? 5;

  const roleIdx = args.indexOf("--role");
  const tagIdx = args.indexOf("--tag");
  const triggerIdx = args.indexOf("--trigger");
  const limitIdx = args.indexOf("--limit");
  const formatIdx = args.indexOf("--format");

  const consumed = new Set<number>();
  for (const idx of [roleIdx, tagIdx, triggerIdx, limitIdx, formatIdx]) {
    if (idx >= 0) {
      consumed.add(idx);
      consumed.add(idx + 1);
    }
  }

  return {
    role: roleIdx >= 0 ? (args[roleIdx + 1] ?? null) : null,
    tag: tagIdx >= 0 ? (args[tagIdx + 1] ?? null) : null,
    trigger: triggerIdx >= 0 ? (args[triggerIdx + 1] ?? null) : null,
    limit: limitIdx >= 0 ? Number(args[limitIdx + 1]) || defaultLimit : defaultLimit,
    format: formatIdx >= 0 ? (args[formatIdx + 1] ?? defaultFormat) : defaultFormat,
    consumed,
  };
}

export function positionalFromArgs(args: string[], consumed: Set<number>): string {
  return args
    .filter((_, i) => !consumed.has(i))
    .join(" ")
    .trim();
}

export function parseLoadArgv(args: string[]): {
  target: string;
  format: string;
  projectRootArgs: string[];
} {
  const formatIdx = args.indexOf("--format");
  const format = formatIdx >= 0 ? (args[formatIdx + 1] ?? "body") : "body";
  const consumed = new Set<number>();
  if (formatIdx >= 0) {
    consumed.add(formatIdx);
    consumed.add(formatIdx + 1);
  }
  const target = positionalFromArgs(args, consumed);
  return { target, format, projectRootArgs: args };
}

export function parseProjectRootFlag(args: string[]): string | undefined {
  const { idx, value } = flagValue(args, "--project-root");
  return idx >= 0 && value ? value : undefined;
}
