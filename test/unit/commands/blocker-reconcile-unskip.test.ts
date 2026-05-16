import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowctlContext } from "@/cli/context";
import {
  runBlockerReconcile,
} from "@/commands/blocker";
import { runUnskip } from "@/commands/skip";
import { refreshRuntimePaths } from "@/config/paths";
import { defaultState } from "@/state/default-state";
import { FlowctlStateSchema } from "@/state/schema";
import { initStateFile, writeState } from "@/state/writer";

describe("blocker reconcile + unskip (bash parity)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    dirs.length = 0;
  });

  async function tmpRepo(): Promise<{ repo: string; ctx: FlowctlContext }> {
    const tmp = await mkdtemp(join(tmpdir(), "flowctl-br-"));
    dirs.push(tmp);
    const repo = join(tmp, "repo");
    await mkdir(join(repo, "workflows", "dispatch"), { recursive: true });
    const stateFile = join(repo, ".flowctl", "flows", "x1", "state.json");
    await initStateFile(stateFile);
    const state = defaultState();
    state.flow_id = "wf-12345678-abcd-ef00-000000000000";
    state.project_name = "Demo";
    state.current_step = 1;
    const step1 = state.steps["1"];
    if (!step1) throw new Error("fixture: missing step 1");
    state.steps["1"] = {
      ...step1,
      name: "Requirements",
      agent: "pm",
      status: "in_progress",
      blockers: [],
    };
    await writeState(stateFile, FlowctlStateSchema.parse(state));
    const paths = await refreshRuntimePaths(repo, stateFile);
    const ctx: FlowctlContext = {
      projectRoot: repo,
      workflowRoot: join(repo, ".."),
      paths,
      stateFile,
      resolveSource: "env_state_file",
    };
    return { repo, ctx };
  }

  it("reconcile resolves blocker when all backtick paths exist", async () => {
    const { ctx, repo } = await tmpRepo();
    await writeFile(join(repo, "proof.txt"), "ok", "utf-8");
    const stateFile = ctx.stateFile!;
    const st = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    st.steps["1"]!.blockers = [
      {
        id: "B1",
        description: "Add file `proof.txt`",
        created_at: "2026-01-01",
        resolved: false,
      },
    ];
    await writeState(stateFile, st);

    await runBlockerReconcile(ctx);

    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    const b = after.steps["1"]!.blockers[0]!;
    expect(b.resolved).toBe(true);
    expect(b.resolved_by).toBe("reconcile");
    expect(b.resolution_note).toContain("backtick");
  });

  it("reconcile uses role-policy rule when description references role-policy.v1.json", async () => {
    const { ctx, repo } = await tmpRepo();
    await mkdir(join(repo, "workflows", "policies"), { recursive: true });
    await writeFile(
      join(repo, "workflows", "policies", "role-policy.v1.json"),
      JSON.stringify({
        roles: {
          backend: {},
          frontend: {},
        },
      }),
      "utf-8",
    );
    const stateFile = ctx.stateFile!;
    const st = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    st.steps["1"]!.blockers = [
      {
        id: "B2",
        description: "Missing entries in role-policy.v1.json",
        created_at: "2026-01-01",
        resolved: false,
      },
    ];
    await writeState(stateFile, st);

    await runBlockerReconcile(ctx);

    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    expect(after.steps["1"]!.blockers[0]!.resolved).toBe(true);
    expect(after.steps["1"]!.blockers[0]!.resolution_note).toContain(
      "role-policy covers",
    );
  });

  it("reconcile leaves blocker open when no rule matches", async () => {
    const { ctx } = await tmpRepo();
    const stateFile = ctx.stateFile!;
    const st = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    st.steps["1"]!.blockers = [
      {
        id: "B-open",
        description: "Waiting on external vendor sign-off",
        created_at: "2026-01-01",
        resolved: false,
      },
    ];
    await writeState(stateFile, st);

    const logs: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    await runBlockerReconcile(ctx);

    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    expect(after.steps["1"]!.blockers[0]!.resolved).toBe(false);
    expect(logs.join("\n")).toContain("OPEN|B-open|");
    log.mockRestore();
  });

  it("reconcile resolves when requirements and architecture docs exist", async () => {
    const { ctx, repo } = await tmpRepo();
    await mkdir(join(repo, "docs"), { recursive: true });
    await writeFile(join(repo, "docs", "requirements.md"), "# req\n", "utf-8");
    await writeFile(join(repo, "docs", "architecture.md"), "# arch\n", "utf-8");
    const stateFile = ctx.stateFile!;
    const st = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    st.steps["1"]!.blockers = [
      {
        id: "B-docs",
        description: "Need docs/requirements.md and docs/architecture.md",
        created_at: "2026-01-01",
        resolved: false,
      },
    ];
    await writeState(stateFile, st);

    await runBlockerReconcile(ctx);

    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    expect(after.steps["1"]!.blockers[0]!.resolved).toBe(true);
    expect(after.steps["1"]!.blockers[0]!.resolution_note).toContain(
      "requirements + architecture",
    );
  });

  it("unskip throws when step is not skipped", async () => {
    const { ctx } = await tmpRepo();
    await expect(runUnskip(ctx, { step: "1", reason: "retry" })).rejects.toThrow(
      /không ở trạng thái skipped/,
    );
  });

  it("unskip restores step without pulling current_step when step is ahead", async () => {
    const { ctx } = await tmpRepo();
    const stateFile = ctx.stateFile!;
    const st = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    st.current_step = 3;
    const step3 = st.steps["3"];
    if (!step3) throw new Error("fixture: missing step 3");
    st.steps["3"] = {
      ...step3,
      status: "skipped",
      skip_reason: "api-only",
      skip_type: "preset",
      skipped_by: "PM",
      skipped_at: "2026-01-02",
    };
    await writeState(stateFile, st);

    await runUnskip(ctx, { step: "3", reason: "need design" });

    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    expect(after.current_step).toBe(3);
    expect(after.steps["3"]!.status).toBe("pending");
  });

  it("unskip restores step and pulls current_step back; removes context digest", async () => {
    const { ctx, repo } = await tmpRepo();
    const stateFile = ctx.stateFile!;
    const st = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    st.current_step = 5;
    const step3 = st.steps["3"];
    if (!step3) throw new Error("fixture: missing step 3");
    st.steps["3"] = {
      ...step3,
      status: "skipped",
      skip_reason: "test",
      skip_type: "hotfix",
      skipped_by: "PM",
      skipped_at: "2026-01-02",
    };
    await writeState(stateFile, st);

    const digestDir = join(
      repo,
      "workflows",
      "12345678",
      "dispatch",
      "step-3",
    );
    await mkdir(digestDir, { recursive: true });
    const digestPath = join(digestDir, "context-digest.md");
    await writeFile(digestPath, "# digest", "utf-8");

    await runUnskip(ctx, { step: "3", reason: "need design" });

    const after = FlowctlStateSchema.parse(
      JSON.parse(await readFile(stateFile, "utf-8")),
    );
    expect(after.current_step).toBe(3);
    expect(after.steps["3"]!.status).toBe("pending");
    expect(after.steps["3"]!.skip_reason).toBe("");
    await expect(readFile(digestPath, "utf-8")).rejects.toThrow();
  });
});
