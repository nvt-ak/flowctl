/** Token estimation + USD cost (parity with shell-proxy.js). */

export const ANTHROPIC_SONNET_PRICE = { input: 3.0, output: 15.0 };

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  const chars = text.length;
  const quotes = (text.match(/"/g) || []).length;
  const nonAscii = [...text].filter((c) => c.charCodeAt(0) > 127).length;
  const jsonRatio = quotes / Math.max(chars, 1);
  const vietRatio = nonAscii / Math.max(chars, 1);
  if (jsonRatio > 0.05) return Math.ceil(chars / 3);
  if (vietRatio > 0.15) return Math.ceil(chars / 2);
  return Math.ceil(chars / 4);
}

export function costUsd(inputTok: number, outputTok: number): number {
  return (inputTok * ANTHROPIC_SONNET_PRICE.input + outputTok * ANTHROPIC_SONNET_PRICE.output) / 1_000_000;
}

/** Bash-equivalent token cost per tool (shell-proxy.js BASH_EQUIV). */
export const BASH_EQUIV: Record<string, number> = {
  wf_state: 1900,
  wf_git: 1000,
  wf_step_context: 4800,
  wf_files: 500,
  wf_read: 700,
  wf_env: 300,
  wf_reports_status: 600,
};
