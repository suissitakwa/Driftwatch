# driftwatch architecture

## Thesis

Every integration failure is a contract violation. driftwatch verifies four contract surfaces with one shared core:

| Module | Contract surface | Question it answers | Runtime |
|---|---|---|---|
| 1. stripe-drift | Runtime state | Does Stripe agree with our database right now? | scheduled / on demand |
| 2. api-time-machine | Behavior | Does our code survive the messy traffic the world actually sends? | CI |
| 3. deprecation-watcher | Upstream contract | Is a provider about to change an API we depend on? | scheduled |
| 4. migration-safety | Internal schema | Will this migration break code that is still deployed? | CI (PR check) |

## Design rules

1. **Deterministic engines establish facts; agents explain and propose.** No LLM in the diff, replay, or scan paths. Agents receive facts as JSON and produce diagnosis, impact analysis, and suggested fixes. Agents never write to external systems.
2. **Everything runs in the user's environment.** Keys and data never leave their machine. This is the trust wedge against SaaS competitors.
3. **Extract abstractions from working modules, not up front.** The shared core grows only when a second module needs a piece.

## Shared core (grows module by module)

- `connectors` — read-only clients (Stripe, Postgres). Module 2 adds the webhook recorder; module 3 adds changelog fetchers; module 4 adds schema introspection.
- `diff-engine` — canonical-state comparison. Module 2 reuses it to compare expected vs actual state after replay.
- `system-model` (planned, module 3) — graph of what code touches what APIs, tables, and payload fields. Shared by modules 3 and 4.
- `agents` — root-cause, code-impact, reporter. Shared by all modules.

## Build order and what each step proves

1. **Weeks 1–2 — stripe-drift**: proves diff engine + agent layer; enables the free-audit validation experiment.
2. **Weeks 3–4 — api-time-machine**: proves recorder + replay; forces extraction of the shared core; OSS launch candidate.
3. **Week 5 — deprecation-watcher**: proves the code scanner (system-model v1); ships as a GitHub Action.
4. **Week 6 — migration-safety**: reuses scanner + schema introspection + agents; second GitHub Action.

## Two runtimes, one library

Modules 1 and 3 run on schedules against live systems; modules 2 and 4 run at CI time against a release candidate. The core is a library both contexts call — never a server the CI step must reach.
