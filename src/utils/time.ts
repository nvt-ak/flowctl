/** Local timestamp matching bash `wf_now` format. */
export function nowTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function utcIsoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
