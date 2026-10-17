import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "../env";
import type { CheckoutInput, CheckoutSession, PaymentProvider } from "./provider";

/** Local/dev/test only. `env()` refuses to start in production with this on. */
export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const providerRef = `mock_cs_${randomBytes(8).toString("hex")}`;
    return {
      providerRef,
      checkoutUrl: `${env().APP_URL}/pay/mock/${encodeURIComponent(input.reference)}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }
}
