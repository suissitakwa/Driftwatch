# driftwatch — execution plan

Written 2026-07-09. Master plan; TODO.md holds only the next session's tasks.

## Context and constraints

- **Primary goal (next 4–6 weeks): portfolio for job applications.** A polished public repo, a demo GIF, and interview stories. Business validation is the secondary, opportunistic goal.
- **Time budget: 5–10 h/week** — plan in ~2-hour sessions, 3–4 per week. Every task below fits one session; if it doesn't fit, it gets split or parked.
- **Public from day 1** — consistent commit history is itself the signal.
- npm name `driftwatch` is unclaimed (checked 2026-07-09); `drift-watch` is taken. Claim ours at phase 3.

## What "recruiter-ready" means (milestone M1 — the only deadline that matters)

A stranger landing on the repo within 60 seconds sees: what it does (README pitch + GIF), that it's real (CI badge, tests), and that it's designed (ARCHITECTURE.md). Concretely:

- [ ] Public GitHub repo, MIT license, clean commit history
- [ ] Demo GIF: seed-demo → audit → 6 findings + agent diagnosis → exit 1
- [ ] Diff engine fully unit-tested; CI green badge
- [ ] README answers "why not just monitoring?" in the first three lines
- [ ] One end-to-end run against real Stripe test mode has actually happened

## Phase 1 — recruiter-ready module 1 (~6 sessions, weeks 1–2.5)

| # | Session (≈2 h) | Done when |
|---|---|---|
| 1 | Go public: GitHub repo, MIT LICENSE, first commit, push. | Repo is live and public |
| 2 | First real run: Stripe test key, demo Postgres, `seed-demo --yes`, `audit`. Fix every rough edge hit. | Report shows exactly 6 findings, 0 for grace |
| 3 | Unit tests for diff-engine (vitest): every drift kind, healthy case, sort order, empty inputs. | `npm test` green |
| 4 | CI: GitHub Action (build + test on push), badge in README. | Badge green on main |
| 5 | Agent v2: fetch recent `customer.subscription.*` events for affected customers, pass to root-cause agent so it can point at the missing-webhook window. | Diagnosis names concrete event gaps, not generic hypotheses |
| 6 | Demo GIF (vhs or terminalizer) + README final pass. | M1 checklist above fully ticked |

## Phase 2 — cash in the portfolio (~2 sessions, week 3)

| # | Session | Done when |
|---|---|---|
| 7 | Resume + LinkedIn + interview-prep Notion: add driftwatch with the three stories — (a) deterministic-core-vs-agents boundary and why, (b) monorepo abstractions extracted not designed, (c) safety guards (test-mode-only, --yes, read-only). | Stories written down, resume updated |
| 8 | Publish `driftwatch` to npm (`npx driftwatch` works from a clean machine). | Smoke test passes on a machine without the repo |

## Phase 3 — module 2: api-time-machine (~6–8 sessions, weeks 4–6)

The recruiter-wow module; the recorder it forces into existence is the platform's shared core. Session-level breakdown happens at phase start, but the shape:

1. Recorder: local proxy/endpoint capturing Stripe webhooks to an event store (2 sessions)
2. Mutations: duplicate, reorder, delay, drop-field, old-API-version (2 sessions)
3. Replay against a target URL + reuse diff-engine for end-state assertion (2 sessions)
4. Demo: retail project's checkout surviving (or not) mutated webhooks + GIF (1–2 sessions)

## Phase 4 — business validation (opportunistic, no deadline)

Runs in the gaps, never blocking phases 1–3: landing page, "free drift audit" offer on Indie Hackers / r/SaaS / X, target 10 audits. **Kill-condition unchanged:** fewer than 3 real-drift hits out of 10 audits → OSS/portfolio path only, no watch-mode product. Write outcomes in `docs/VALIDATION.md` as they happen.

## Rules to keep this alive at 5–10 h/week

1. **One session, one commit minimum** — even a failed experiment gets committed with what was learned.
2. **No module 2 code before M1 is fully ticked.** Scope creep is the #1 killer; the parked list in TODO.md absorbs every "wouldn't it be cool if".
3. **Session logs beat memory:** end each session by updating TODO.md's "next session" line — future-you starts in 30 seconds instead of 20 minutes of re-orientation.
4. **Job applications always preempt driftwatch.** This project supports the job search; it must never compete with it.

## Deferred decisions (deliberately not decided now)

- Pricing/packaging of watch mode — only after the validation gate
- HTML report styling — markdown is enough until a founder asks
- GitHub-Action distribution of modules 3/4 — decided at phase-3 end
- Renaming (if a conflict with `drift-watch` npm package ever matters) — revisit at npm publish

## Risks

| Risk | Mitigation |
|---|---|
| Time starvation / motivation dip | Session-sized tasks, public commits, rule 1 |
| Scope creep into the platform vision | Rule 2; ARCHITECTURE.md holds the vision so code doesn't have to |
| Job search intensifies and pauses the project | Fine by design — M1 is self-contained value; rules say job search wins |
| Stripe API surface changes | SDK pinned; seed fixture makes regressions visible in minutes |
