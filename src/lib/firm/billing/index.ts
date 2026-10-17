import "server-only";
import { env } from "../env";
import { MockProvider } from "./mock";
import { PayMongoProvider } from "./paymongo";
import type { PaymentProvider } from "./provider";

export function getProvider(): PaymentProvider {
  return env().BILLING_PROVIDER === "paymongo" ? new PayMongoProvider() : new MockProvider();
}
