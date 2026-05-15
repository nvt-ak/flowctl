import chalk from "chalk";
import type { FlowctlContext } from "@/cli/context";
import { requireStateFile } from "@/cli/context";
import { readState } from "@/state/reader";
import { getStep, requireCurrentStep } from "@/workflow/step-utils";

const ASSESS_HINTS: Record<number, string> = {
  2: "Skip nếu: hotfix rõ ràng, không thay đổi architecture",
  3: "Skip nếu: API-only, bug fix không có UI, backend refactor",
  5: "Skip nếu: không có UI changes, API-only service",
  6: "Skip nếu: chỉ sửa 1 isolated service, không cross-service",
  7: "Hiếm khi skip — chỉ bỏ nếu hotfix production cực khẩn",
  8: "Skip nếu: infrastructure đã sẵn, chỉ hotfix nhỏ",
};

export async function runAssess(ctx: FlowctlContext): Promise<void> {
  const stateFile = requireStateFile(ctx);
  const read = await readState(stateFile);
  if (!read.ok) throw new Error(read.error);
  const current = requireCurrentStep(read.data);
  const project = read.data.project_name ?? "";

  console.log(chalk.blue.bold("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.blue.bold(`   Workflow Assessment — ${project}`));
  console.log(chalk.blue.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
  console.log(
    chalk.cyan("PM: Đánh giá từng step dưới đây và quyết định skip nếu không cần thiết.\n"),
  );
  console.log("  Step  Status    Tên                    Gợi ý skip");
  console.log(`  ${"─".repeat(70)}`);

  for (let n = 1; n <= 9; n++) {
    const s = getStep(read.data, n);
    const status = s?.status ?? "pending";
    const name = (s?.name ?? "").padEnd(22);
    const hint = ASSESS_HINTS[n] ?? "";
    const marker = n === current ? "→" : " ";
    console.log(`  ${marker} ${n}    ${status.padEnd(9)}  ${name} ${hint}`);
  }

  console.log(chalk.cyan("\nPresets có sẵn:"));
  console.log("  --preset hotfix        → skip steps 2,3,5,6");
  console.log("  --preset api-only      → skip steps 3,5");
  console.log("");
}
