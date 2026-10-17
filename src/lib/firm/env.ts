import "server-only";
import { z } from "zod";

const Schema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  BILLING_PROVIDER: z.enum(["mock", "paymongo"]).default("mock"),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  /** Which signature field in the Paymongo-Signature header to trust. */
  PAYMONGO_MODE: z.enum(["test", "live"]).default("test"),
  EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Tala Books <no-reply@example.com>"),
  CRON_SECRET: z.string().optional(),
});

export type FirmEnv = z.infer<typeof Schema>;

let cached: FirmEnv | null = null;

/** Validated lazily (not at import) so `next build` works without secrets. */
export function env(): FirmEnv {
  if (cached) return cached;
  const e = Schema.parse(process.env);
  if (process.env.NODE_ENV === "production") {
    if (e.BILLING_PROVIDER === "mock") throw new Error("BILLING_PROVIDER=mock is not allowed in production.");
    if (e.BILLING_PROVIDER === "paymongo" && (!e.PAYMONGO_SECRET_KEY || !e.PAYMONGO_WEBHOOK_SECRET)) {
      throw new Error("PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET are required.");
    }
    if (e.EMAIL_DRIVER === "resend" && !e.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required.");
    if (!e.CRON_SECRET) throw new Error("CRON_SECRET is required in production.");
  }
  cached = e;
  return e;
}
