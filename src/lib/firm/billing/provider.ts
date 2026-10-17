export type CheckoutInput = {
  reference: string;
  amount: number; // centavos
  description: string;
  customerName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  providerRef: string;
  checkoutUrl: string;
  expiresAt: Date | null;
};

export interface PaymentProvider {
  readonly name: "paymongo" | "mock";
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
}

/** A webhook reduced to the few facts the order state machine needs. */
export type PaidEvent = {
  eventId: string;
  type: string;
  providerRef: string | null;
  reference: string | null;
  /** Centavos actually paid, or null if the payload did not say. */
  paidAmount: number | null;
};

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}
