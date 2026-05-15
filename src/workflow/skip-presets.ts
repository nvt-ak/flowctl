export const SKIP_PRESETS: Record<string, number[]> = {
  hotfix: [2, 3, 5, 6],
  "api-only": [3, 5],
  "backend-api": [3, 5],
  "frontend-only": [2, 4, 6, 8],
  "design-sprint": [4, 5, 6, 7, 8, 9],
  research: [3, 4, 5, 6, 7, 8, 9],
  "devops-only": [1, 2, 3, 4, 5, 6, 7],
  "qa-only": [1, 2, 3, 4, 5, 6, 8],
};

export const SKIP_REASON_LABELS: Record<string, string> = {
  "no-ui": "No UI changes",
  "no-backend": "No backend changes",
  hotfix: "Hotfix — bỏ qua ceremony",
  "api-only": "API-only — no need for Frontend/UI",
  "backend-api": "API-only — no need for Frontend/UI",
  "no-deploy": "No need for separate deploy",
  research: "Research spike — only need analysis",
  "no-integration": "No cross-service changes",
  "design-sprint": "Design sprint — only need design",
  "devops-only": "DevOps-only task",
  "frontend-only": "Frontend-only — no need for backend",
  "qa-only": "QA-only task",
};

export function skipPresetSteps(preset: string): number[] {
  return SKIP_PRESETS[preset] ?? [];
}

export function skipReasonLabel(reasonType: string): string {
  return SKIP_REASON_LABELS[reasonType] ?? "No reason";
}
