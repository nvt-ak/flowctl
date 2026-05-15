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
  "no-ui": "Không có UI changes",
  "no-backend": "Không có backend changes",
  hotfix: "Hotfix — bỏ qua ceremony",
  "api-only": "API-only — không cần Frontend/UI",
  "backend-api": "API-only — không cần Frontend/UI",
  "no-deploy": "Không cần deploy riêng",
  research: "Research spike — chỉ cần phân tích",
  "no-integration": "Không có cross-service changes",
  "design-sprint": "Design sprint — chỉ cần design",
  "devops-only": "DevOps-only task",
  "frontend-only": "Frontend-only — không cần backend",
  "qa-only": "QA-only task",
};

export function skipPresetSteps(preset: string): number[] {
  return SKIP_PRESETS[preset] ?? [];
}

export function skipReasonLabel(reasonType: string): string {
  return SKIP_REASON_LABELS[reasonType] ?? "Không có lý do";
}
