import { describe, expect, it } from "vitest";
import { computeSignature, parseSignatureHeader, verifySignature } from "@/lib/firm/billing/signature";

const secret = "whsk_test_secret";
const body = JSON.stringify({ data: { id: "evt_1" } });
const t = "1496734173";
const good = computeSignature(secret, t, body);

describe("webhook signature", () => {
  it("accepts a valid test-mode signature", () => {
    expect(verifySignature({ secret, header: `t=${t},te=${good},li=`, rawBody: body, mode: "test" })).toBe(true);
  });
  it("accepts a valid live-mode signature", () => {
    expect(verifySignature({ secret, header: `t=${t},te=,li=${good}`, rawBody: body, mode: "live" })).toBe(true);
  });
  it("rejects a test signature when running in live mode (and vice versa)", () => {
    expect(verifySignature({ secret, header: `t=${t},te=${good}`, rawBody: body, mode: "live" })).toBe(false);
    expect(verifySignature({ secret, header: `t=${t},li=${good}`, rawBody: body, mode: "test" })).toBe(false);
  });
  it("rejects a tampered body", () => {
    expect(verifySignature({ secret, header: `t=${t},te=${good}`, rawBody: body + " ", mode: "test" })).toBe(false);
  });
  it("rejects a tampered timestamp", () => {
    expect(verifySignature({ secret, header: `t=1,te=${good}`, rawBody: body, mode: "test" })).toBe(false);
  });
  it("rejects the wrong secret, missing header, garbage and non-hex", () => {
    expect(verifySignature({ secret: "other", header: `t=${t},te=${good}`, rawBody: body, mode: "test" })).toBe(false);
    expect(verifySignature({ secret, header: null, rawBody: body, mode: "test" })).toBe(false);
    expect(verifySignature({ secret, header: "garbage", rawBody: body, mode: "test" })).toBe(false);
    expect(verifySignature({ secret, header: `t=${t},te=zzzz`, rawBody: body, mode: "test" })).toBe(false);
    expect(verifySignature({ secret, header: `t=${t},te=ab`, rawBody: body, mode: "test" })).toBe(false);
  });
  it("parses the header", () => {
    expect(parseSignatureHeader("t=5,te=aa,li=bb")).toEqual({ t: "5", te: "aa", li: "bb" });
    expect(parseSignatureHeader("te=aa")).toBeNull();
  });
});
