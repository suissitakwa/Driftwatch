# driftwatch

Your app makes contracts with the outside world — with Stripe, with webhook senders, with its own database. driftwatch continuously verifies they still hold.

Your monitoring tells you whether your servers are healthy. driftwatch tells you whether your **business state** is still correct.

## Module 1: Stripe drift detector (current)

Compares subscription state in Stripe against your own database and finds:

| Drift kind | Meaning | Severity |
|---|---|---|
| `paid_not_provisioned` | Customer pays in Stripe, has no access in your app | critical |
| `missing_internal` | Active Stripe subscription with no internal record at all | critical |
| `canceled_still_active` | Canceled in Stripe, still has access — you're giving it away | high |
| `missing_in_stripe` | Active internally, unknown to Stripe — never billed | high |
| `plan_mismatch` | Different plan in Stripe vs your DB | high |
| `trial_mismatch` | Trialing in Stripe, something else internally | medium |

A deterministic diff engine establishes the facts. An agent layer then hypothesizes root causes (failed webhooks, race conditions, manual edits) and recommends a safe remediation order. Agents never write to Stripe or your database.

## Quickstart

```bash
npm install
npm run build
cp .env.example .env   # fill in STRIPE_SECRET_KEY, DATABASE_URL, ANTHROPIC_API_KEY

node apps/cli/dist/index.js audit \
  --query "select stripe_customer_id, status, plan, email from subscriptions" \
  --out report.md
```

Your query must return columns `stripe_customer_id`, `status`, `plan` (optional), `email` (optional). Everything runs locally — your keys and data never leave your machine.

Exit code is 1 when critical drift is found, so `audit` drops straight into CI or cron.

## Try it in 2 minutes (demo fixture)

No SaaS required — seed a Stripe **test-mode** account and a throwaway Postgres with deliberate drift, one scenario per drift kind plus one healthy customer:

```bash
docker run --name driftwatch-demo-db -e POSTGRES_PASSWORD=demo -p 5439:5432 -d postgres:16

export STRIPE_SECRET_KEY=sk_test_...
export DATABASE_URL=postgresql://postgres:demo@localhost:5439/postgres

node apps/cli/dist/index.js seed-demo --yes   # drops/recreates the subscriptions table
node apps/cli/dist/index.js audit --out report.md
```

The audit should find exactly six drifts (alice through frank) and stay silent about grace. `seed-demo` refuses live-mode keys and is safe to re-run — it cleans up its own demo customers first.

## Architecture

```
product modules      stripe-drift · api-time-machine* · deprecation-watcher* · migration-safety*
deterministic core   connectors · diff-engine · recorder* · system-model*
agent layer          root-cause · code-impact* · reporter
surfaces             cli · github action* · scheduled watcher*
```

`*` = planned. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module roadmap.

## Monorepo layout

```
packages/core         canonical state model, finding types
packages/connectors   stripe reader, postgres reader (read-only)
packages/diff-engine  deterministic drift detection — no LLM in this path
packages/agents       root-cause diagnosis (Claude)
packages/report       markdown report renderer
apps/cli              driftwatch command
```
