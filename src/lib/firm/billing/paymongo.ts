import "server-only";
import { env } from "../env";
import { ProviderError, type CheckoutInput, type CheckoutSession, type PaidEvent, type PaymentProvider } from "./provider";

const API = "https://api.paymongo.com/v2";
export const PAID_EVENT_TYPES = new Set(["checkout_session.payment.paid"]);

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export class PayMongoProvider implements PaymentProvider {
  readonly name = "paymongo" as const;

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const key = env().PAYMONGO_SECRET_KEY;
    if (!key) throw new ProviderError("PAYMONGO_SECRET_KEY is not configured.");

    const res = await fetch(`${API}/checkout_sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ name: input.description, amount: input.amount, currency: "PHP", quantity: 1 }],
            payment_method_types: ["gcash", "qrph", "card"],
            reference_number: input.reference,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            description: input.description,
            billing: { name: input.customerName, email: input.customerEmail },
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await res.json().catch(() => null)) as Json | null;
    if (!res.ok) {
      // Log status only — the body can echo customer details.
      throw new ProviderError(`PayMongo rejected checkout creation (HTTP ${res.status}).`, res.status);
    }
    const data = obj(body?.data);
    const attrs = obj(data?.attributes);
    const id = str(data?.id);
    const url = str(attrs?.checkout_url);
    if (!id || !url) throw new ProviderError("PayMongo response was missing an id or checkout_url.");
    const expires = typeof attrs?.expires_at === "number" ? new Date(attrs.expires_at * 1000) : null;
    return { providerRef: id, checkoutUrl: url, expiresAt: expires };
  }
}

/**
 * Reduces PayMongo's event envelope (`data.attributes.type` + the resource at
 * `data.attributes.data`) to what we need. Anything not found stays null, and
 * the caller treats missing facts as "needs human review", never as success.
 */
export function parsePayMongoEvent(raw: unknown): PaidEvent | null {
  const root = obj(obj(raw)?.data);
  const attrs = obj(root?.attributes);
  const eventId = str(root?.id);
  const type = str(attrs?.type);
  if (!eventId || !type) return null;

  const resource = obj(attrs?.data);
  const rAttrs = obj(resource?.attributes);
  const payments = Array.isArray(rAttrs?.payments) ? (rAttrs!.payments as unknown[]) : [];
  const firstPayment = obj(obj(payments[0])?.attributes);
  const amount = typeof firstPayment?.amount === "number" ? firstPayment.amount : null;

  return {
    eventId,
    type,
    providerRef: str(resource?.id),
    reference: str(rAttrs?.reference_number),
    paidAmount: amount,
  };
}
