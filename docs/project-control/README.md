# JetStash Project Control

This folder is the single source of truth for what JetStash has finished, what is being worked on,
what comes next, and which ideas have been accepted or rejected.

It exists to prevent two recurring problems:

1. finished work being proposed or tested again because an older roadmap still lists it; and
2. strategic decisions being rediscovered without the context that led to them.

## Read these first

Every new development or strategy session must read these files before proposing work:

1. [`STATUS.md`](./STATUS.md) — the current production baseline and the next task;
2. [`COMPLETED.md`](./COMPLETED.md) — the append-only record of finished work;
3. [`ROADMAP.md`](./ROADMAP.md) — active, queued and deferred work;
4. [`DECISIONS.md`](./DECISIONS.md) — approved, evolved, deferred and rejected ideas.

Historical phase reports elsewhere in `/docs` remain valuable evidence, but they do not override
this folder when their task status is stale. `JETSTASH_PRINCIPLES.md` remains the authority for
standing product, trust and architecture rules.

## Status vocabulary

- **ACTIVE** — work is currently in progress.
- **NEXT** — the next approved task after the active task.
- **QUEUED** — approved, but not next.
- **DEFERRED** — worth revisiting, but deliberately not on the current delivery path.
- **DONE** — completed. Do not reopen without new evidence of a defect, regression or changed need.
- **REJECTED** — do not suggest again unless materially new evidence changes the decision.
- **NEEDS EVIDENCE** — a claim or task cannot be treated as complete yet.

## Evidence vocabulary

Every completed item records why it is considered complete:

- **Repository verified** — present in code or Git history.
- **Production verified** — checked on the live production site or production deployment.
- **Founder confirmed** — the founder confirmed completion, but the repository does not contain a
  durable test report. This is enough to avoid routine repetition; re-check only after a relevant
  code, environment or provider change.

Never upgrade a task from `NEEDS EVIDENCE` to `DONE` based on an assumption.

## Update protocol

For every meaningful task:

1. Check `COMPLETED.md` before starting.
2. Add or update the task in `STATUS.md` and `ROADMAP.md`.
3. When the work is genuinely finished, move it to `COMPLETED.md` in the same PR or immediately
   after production verification.
4. Record a commit, PR, production check, test result or founder confirmation.
5. Remove the item from the active queue; do not leave a second contradictory copy behind.
6. Record strategic changes in `DECISIONS.md`.

The completed ledger is append-only. Corrections should add a dated note explaining what changed,
not silently erase the historical record.

## Current baseline

This tracker was reconciled on **24 July 2026** against:

- GitHub `main` at `498f980425b2907d09544e80244cba0a88a3b2d7`;
- the live JetStash homepage after Route Status V1 and the Manchester-to-Mumbai visual shipped;
- existing repository documentation and Git history; and
- founder confirmations captured during the July 2026 working sessions.
