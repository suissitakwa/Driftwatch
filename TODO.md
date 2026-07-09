# Next session

Master plan: [docs/PLAN.md](docs/PLAN.md). This file only ever holds the next session and the parked list.

## Session 2 — first real run (~2 h)

- [ ] Get sk_test_ key from Stripe dashboard; start demo Postgres (docker one-liner in README)
- [ ] `seed-demo --yes` then `audit` — verify exactly 6 findings, 0 for grace
- [ ] Fix every rough edge hit along the way; commit each fix
- [ ] Leftover from session 1: add repo description + topics on GitHub (stripe, drift-detection, ai-agents, typescript)

## Done so far

- [x] Session 1 (2026-07-09): repo public at github.com/suissitakwa/Driftwatch, MIT license, scaffold pushed, LF line endings enforced

- [x] Monorepo scaffold: core, connectors, diff-engine, agents, report, cli — builds clean
- [x] Diff engine verified against synthetic drift (3 kinds + healthy customer)
- [x] `seed-demo` command with test-mode-only and `--yes` guards
- [x] npm name `driftwatch` confirmed unclaimed (2026-07-09)

## Parked (do not build yet)

- watch mode / alerting (after validation gate — PLAN.md phase 4)
- one-time-payment mode (orders vs charges; would make the retail project a live demo target)
- api-time-machine recorder (module 2 — PLAN.md phase 3)
- HTML report styling
