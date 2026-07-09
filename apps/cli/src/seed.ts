import Stripe from "stripe";
import pg from "pg";
import type { Command } from "commander";

type PlanKey = "basic" | "pro";

interface Scenario {
  key: string;
  email: string;
  stripe?: { status: "active" | "trialing" | "canceled"; plan: PlanKey };
  internal?: { status: string; plan?: PlanKey };
  expect: string;
}

const SCENARIOS: Scenario[] = [
  {
    key: "alice",
    email: "alice@driftwatch.demo",
    stripe: { status: "active", plan: "pro" },
    internal: { status: "none" },
    expect: "paid_not_provisioned (critical)",
  },
  {
    key: "bob",
    email: "bob@driftwatch.demo",
    stripe: { status: "active", plan: "pro" },
    expect: "missing_internal (critical)",
  },
  {
    key: "carol",
    email: "carol@driftwatch.demo",
    stripe: { status: "canceled", plan: "pro" },
    internal: { status: "active", plan: "pro" },
    expect: "canceled_still_active (high)",
  },
  {
    key: "dave",
    email: "dave@driftwatch.demo",
    stripe: { status: "active", plan: "pro" },
    internal: { status: "active", plan: "basic" },
    expect: "plan_mismatch (high)",
  },
  {
    key: "erin",
    email: "erin@driftwatch.demo",
    stripe: { status: "trialing", plan: "pro" },
    internal: { status: "active", plan: "pro" },
    expect: "trial_mismatch (medium)",
  },
  {
    key: "frank",
    email: "frank@driftwatch.demo",
    internal: { status: "active", plan: "basic" },
    expect: "missing_in_stripe (high)",
  },
  {
    key: "grace",
    email: "grace@driftwatch.demo",
    stripe: { status: "active", plan: "basic" },
    internal: { status: "active", plan: "basic" },
    expect: "no finding (healthy)",
  },
];

const DEMO_FLAG = "driftwatch_demo";

async function ensurePrice(
  stripe: Stripe,
  plan: PlanKey,
  unitAmount: number,
): Promise<string> {
  const lookupKey = `driftwatch_demo_${plan}`;
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0].id;
  const product = await stripe.products.create({
    name: `driftwatch demo ${plan}`,
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
  });
  return price.id;
}

async function deleteOldDemoCustomers(stripe: Stripe): Promise<number> {
  let deleted = 0;
  for await (const customer of stripe.customers.list({ limit: 100 })) {
    if (customer.metadata?.[DEMO_FLAG] === "true") {
      await stripe.customers.del(customer.id);
      deleted++;
    }
  }
  return deleted;
}

async function seedStripe(
  stripe: Stripe,
  prices: Record<PlanKey, string>,
): Promise<Map<string, string>> {
  const customerIds = new Map<string, string>();
  for (const s of SCENARIOS) {
    if (!s.stripe) continue;
    const customer = await stripe.customers.create({
      email: s.email,
      name: s.key,
      metadata: { [DEMO_FLAG]: "true" },
    });
    customerIds.set(s.key, customer.id);
    const pm = await stripe.paymentMethods.attach("pm_card_visa", {
      customer: customer.id,
    });
    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: prices[s.stripe.plan] }],
      default_payment_method: pm.id,
      ...(s.stripe.status === "trialing" ? { trial_period_days: 14 } : {}),
    });
    if (s.stripe.status === "canceled") {
      await stripe.subscriptions.cancel(sub.id);
    }
    console.log(`  stripe: ${s.key} → ${s.stripe.status} (${s.stripe.plan})`);
  }
  return customerIds;
}

async function seedDatabase(
  dbUrl: string,
  customerIds: Map<string, string>,
  prices: Record<PlanKey, string>,
): Promise<void> {
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    await pool.query("drop table if exists subscriptions");
    await pool.query(
      `create table subscriptions (
        stripe_customer_id text primary key,
        status text not null,
        plan text,
        email text
      )`,
    );
    for (const s of SCENARIOS) {
      if (!s.internal) continue;
      const ref = customerIds.get(s.key) ?? `cus_local_${s.key}`;
      await pool.query(
        "insert into subscriptions (stripe_customer_id, status, plan, email) values ($1, $2, $3, $4)",
        [
          ref,
          s.internal.status,
          s.internal.plan ? prices[s.internal.plan] : null,
          s.email,
        ],
      );
      console.log(`  db:     ${s.key} → ${s.internal.status} (${s.internal.plan ?? "no plan"})`);
    }
  } finally {
    await pool.end();
  }
}

export function registerSeedCommand(program: Command): void {
  program
    .command("seed-demo")
    .description(
      "Seed Stripe test mode + a local Postgres with deliberate drift (demo fixture)",
    )
    .option("--db-url <url>", "Postgres connection string (or DATABASE_URL)")
    .option("--yes", "confirm: DROPS and recreates the subscriptions table")
    .action(async (opts) => {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      const dbUrl = opts.dbUrl ?? process.env.DATABASE_URL;
      if (!stripeKey) exit("STRIPE_SECRET_KEY is not set");
      if (!stripeKey!.startsWith("sk_test_"))
        exit("refusing to seed: STRIPE_SECRET_KEY is not a test-mode key (sk_test_...)");
      if (!dbUrl) exit("Pass --db-url or set DATABASE_URL");
      if (!opts.yes)
        exit(
          "this DROPS the 'subscriptions' table in the target database — re-run with --yes on a demo database",
        );

      const stripe = new Stripe(stripeKey!);
      console.log("driftwatch: cleaning up previous demo customers...");
      const removed = await deleteOldDemoCustomers(stripe);
      if (removed > 0) console.log(`  removed ${removed} old demo customers`);

      const prices = {
        basic: await ensurePrice(stripe, "basic", 900),
        pro: await ensurePrice(stripe, "pro", 4900),
      };
      console.log("driftwatch: seeding Stripe test mode...");
      const customerIds = await seedStripe(stripe, prices);
      console.log("driftwatch: seeding Postgres...");
      await seedDatabase(dbUrl!, customerIds, prices);

      console.log("\nExpected findings:");
      for (const s of SCENARIOS) console.log(`  ${s.key.padEnd(6)} ${s.expect}`);
      console.log("\nNow run:\n  driftwatch audit --out report.md");
    });
}

function exit(message: string): never {
  console.error(`driftwatch: ${message}`);
  process.exit(2);
}
