/** One place to rename the product. Placeholder name until the brand is chosen. */
export const BRAND = {
  name: "Tala Books",
  tagline: "Bookkeeping and tax readiness for online sellers and freelancers.",
  supportEmail: process.env.SUPPORT_EMAIL || "hello@example.com",
} as const;

/** Bump when the privacy notice text changes; stored with every consent. */
export const CONSENT_VERSION = "2026-10-v1";
