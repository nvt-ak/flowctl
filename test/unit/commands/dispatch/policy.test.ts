import { describe, expect, it } from "vitest";
import {
  PolicyViolationError,
  validateDispatchPolicy,
  validateMaxRetries,
} from "@/commands/dispatch/policy";

describe("dispatch policy", () => {
  const policy = {
    defaults: {
      allow_trust: false,
      allowed_modes: ["manual", "headless", "launch"],
    },
    roles: { pm: { allow_trust: false } },
  };

  it("rejects disallowed mode", () => {
    expect(() =>
      validateDispatchPolicy(["pm"], policy, {
        mode: "headless",
        trustRequested: false,
      }),
    ).not.toThrow();
    expect(() =>
      validateDispatchPolicy(["pm"], { ...policy, defaults: { allowed_modes: ["manual"] } }, {
        mode: "headless",
        trustRequested: false,
      }),
    ).toThrow(PolicyViolationError);
  });

  it("rejects trust when denied", () => {
    expect(() =>
      validateDispatchPolicy(["pm"], policy, {
        mode: "manual",
        trustRequested: true,
      }),
    ).toThrow(PolicyViolationError);
  });

  it("validates max retries", () => {
    expect(() => validateMaxRetries("3")).not.toThrow();
    expect(() => validateMaxRetries("abc")).toThrow(PolicyViolationError);
    expect(() => validateMaxRetries("-1")).toThrow(PolicyViolationError);
    expect(() => validateMaxRetries("100")).toThrow(PolicyViolationError);
  });
});
