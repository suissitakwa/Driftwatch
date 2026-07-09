import Stripe from "stripe";
import type { CanonicalState, EntitlementStatus } from "@driftwatch/core";

const STATUS_MAP: Record<Stripe.Subscription.Status, EntitlementStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  incomplete: "none",
  incomplete_expired: "none",
  paused: "none",
};

const RANK: Record<EntitlementStatus, number> = {
  active: 4,
  trialing: 3,
  past_due: 2,
  canceled: 1,
  none: 0,
};

function monthlyCents(sub: Stripe.Subscription): number {
  const item = sub.items.data[0];
  const price = item?.price;
  if (!price?.recurring || price.unit_amount == null) return 0;
  const amount = price.unit_amount * (item.quantity ?? 1);
  if (price.recurring.interval === "month") return amount;
  if (price.recurring.interval === "year") return Math.round(amount / 12);
  return 0;
}

export async function fetchStripeStates(
  apiKey: string,
): Promise<CanonicalState[]> {
  const stripe = new Stripe(apiKey);
  const byCustomer = new Map<string, CanonicalState>();
  for await (const sub of stripe.subscriptions.list({
    status: "all",
    limit: 100,
  })) {
    const customerRef =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const state: CanonicalState = {
      customerRef,
      status: STATUS_MAP[sub.status] ?? "none",
      plan: sub.items.data[0]?.price?.id,
      mrrCents: monthlyCents(sub),
    };
    const existing = byCustomer.get(customerRef);
    if (!existing || RANK[state.status] > RANK[existing.status]) {
      byCustomer.set(customerRef, state);
    }
  }
  return [...byCustomer.values()];
}
