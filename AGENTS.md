# AGENTS.md — rules for Codex (and any non-Claude agent) working on JetStash

`CLAUDE.md` is the source of truth for architecture and project rules. If this file and
`CLAUDE.md` ever disagree, `CLAUDE.md` wins.

## Reading efficiently
- Read `CLAUDE.md` at the start of every task.
- Consult `docs/project-control/STATUS.md`, `docs/project-control/DECISIONS.md` and other
  project documentation only when they are relevant to the task in hand.
- Do not load extensive project history or unrelated documents unnecessarily.

## Read-only by default
- All investigations and audits are READ-ONLY unless the founder specifically authorises
  changes.
- Approval must be specific to the task and the action. Never assume approval to edit,
  commit, push, merge or deploy from earlier instructions or from a request to investigate.

## Working rules (non-negotiable)
- One task, one agent, one clearly defined outcome. Investigate one specific problem, report
  the evidence, and only expand scope if the findings justify it. No broad audits unless the
  founder explicitly authorises them.
- Never push, merge, or deploy without the founder's explicit approval for that specific
  action. A merge to `main` deploys to Vercel Production automatically.
- Propose changes first; do not push extra commits to an open PR without approval.
- One tool per branch: never work on a branch or worktree another agent (e.g. Claude Code)
  is using. Start new work from up-to-date `origin/main` on a new branch.
- `main` is protected: a PR and a passing `quality` check are required. Never bypass it.

## Content integrity (fabricated content is a bug)
- No invented prices, stats, urgency, schedules or traction. Every claim must trace to a
  data file or be clearly marked as a placeholder.
- Fare data is append-only in `data/fare-observations.ts`: never overwrite or re-date a
  historical observation; add a new one. Advance future search dates, never past ones.
- Never claim "direct" or "non-self-transfer" without evidence for both legs.
- Never claim fares were "checked by a person" when they were collected by automation.
- Treat `data/route-status-events.ts` as JetStash's internal route-status record. Changes to
  route or service claims require reliable evidence from authoritative airline or airport
  sources and must follow the existing verification rules; never infer them from search
  results alone.
- No hardcoded prices on deal cards; no hardcoded colours outside the design tokens.

## Quality gate before proposing a merge
`npx tsc --noEmit`, `npm run lint`, `npm test -- --run`, and `npm run build` must pass
(`next build` does not run lint).

## Never
- Commit secrets, keys or tokens. Never print them in output.
- Submit live site forms, click affiliate links with tracking parameters, or trigger
  billable API calls (e.g. Arrive By routing) without approval.
- Spend money, change account/billing settings, or install tools/services without approval.
