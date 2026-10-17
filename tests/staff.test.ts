import { describe, expect, it } from "vitest";
import { parseDateOnly, parseManilaLocal, safeMeetUrl, canWrite, isAdmin } from "@/lib/firm/staff";

describe("parseManilaLocal", () => {
  it("reads naive input as Manila time (UTC+8)", () => {
    expect(parseManilaLocal("2026-10-20T14:30")?.toISOString()).toBe("2026-10-20T06:30:00.000Z");
  });
  it("crosses midnight correctly", () => {
    expect(parseManilaLocal("2026-10-20T03:00")?.toISOString()).toBe("2026-10-19T19:00:00.000Z");
  });
  it("rejects garbage and impossible dates", () => {
    expect(parseManilaLocal("tomorrow")).toBeNull();
    expect(parseManilaLocal("2026-02-31T10:00")).toBeNull();
    expect(parseManilaLocal("2026-10-20T25:00")).toBeNull();
    expect(parseManilaLocal("2026-10-20")).toBeNull();
  });
});

describe("parseDateOnly", () => {
  it("accepts real dates at UTC midnight", () => {
    expect(parseDateOnly("2026-10-20")?.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
  it("rejects invalid ones", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("10/20/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

describe("safeMeetUrl", () => {
  it("accepts https only", () => {
    expect(safeMeetUrl("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(safeMeetUrl("http://meet.google.com/x")).toBeNull();
    expect(safeMeetUrl("javascript:alert(1)")).toBeNull();
    expect(safeMeetUrl("not a url")).toBeNull();
  });
});

describe("staff roles", () => {
  it("support is read-only; only admin administers", () => {
    expect(canWrite("SUPPORT")).toBe(false);
    expect(canWrite("PARTNER")).toBe(true);
    expect(canWrite("ADMIN")).toBe(true);
    expect(isAdmin("PARTNER")).toBe(false);
  });
});
