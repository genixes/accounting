import { describe, expect, it } from "vitest";
import { slugify, withSuffix } from "@/lib/firm/slug";
import { generateOtp, hashOtp, otpMatches } from "@/lib/firm/otp";
import { formatPeso, PLANS } from "@/lib/firm/plans";

describe("slugify", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("Maria's Shop & Co.")).toBe("maria-s-shop-and-co");
    expect(slugify("  Ñandú  Crafts ")).toBe("nandu-crafts");
  });
  it("never returns something too short or empty", () => {
    expect(slugify("!!").length).toBeGreaterThanOrEqual(3);
    expect(slugify("")).toMatch(/^client-/);
  });
  it("suffixes collisions", () => {
    expect(withSuffix("a-shop", 0)).toBe("a-shop");
    expect(withSuffix("a-shop", 1)).toBe("a-shop-2");
  });
});

describe("otp", () => {
  it("is always six digits", () => {
    for (let i = 0; i < 500; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
  it("matches only the right email+code", () => {
    const h = hashOtp("A@x.com", "123456");
    expect(otpMatches("a@x.com", "123456", h)).toBe(true); // email case-insensitive
    expect(otpMatches("a@x.com", "123457", h)).toBe(false);
    expect(otpMatches("b@x.com", "123456", h)).toBe(false);
  });
});

describe("plans", () => {
  it("keeps money as positive integer centavos", () => {
    for (const p of Object.values(PLANS)) {
      expect(Number.isInteger(p.amount)).toBe(true);
      expect(p.amount).toBeGreaterThan(0);
    }
    expect(formatPeso(150_000)).toContain("1,500");
  });
});
