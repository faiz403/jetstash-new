# Engineering Operations & Recovery Runbook

**Purpose:** a practical founder-run procedure for keeping JetStash available, truthful and recoverable at its current scale. This document covers production incidents, partner and email dependencies, account recovery, and the bounded security decisions recorded by the Astra #18 review.

## First response to any production concern

1. Record the UTC time, affected URL or workflow, visible symptom, and the last known good production commit/deployment.
2. Check the live public homepage, `/routes`, one affected route page, and `/sitemap.xml`. Do not infer a wider outage from a single page.
3. Check the latest Vercel deployment and its build log. Check the linked GitHub pull request and its `quality` workflow where relevant.
4. Decide whether the issue is a code/deployment failure, a content/evidence error, a partner/email failure, or an external service issue.
5. If travellers could receive incorrect route, fare, travel-document or booking-handoff information, fail closed on that public claim or handoff first. Preserve the evidence and record the correction through the normal PR process.

## Release and rollback

Every normal change goes through a pull request, the GitHub Actions `quality` workflow and the automatic Vercel preview. Production is deployed automatically from a merged `main` commit.

If a deployment is unhealthy:

1. Identify the last production deployment known to be healthy and its merge commit.
2. Prefer a small revert pull request of the offending merge commit. Do not rewrite `main`, force-push, or make an unrelated cleanup while responding.
3. Let the quality workflow and Vercel preview complete, merge the revert, and wait for the single automatic production deployment.
4. Recheck the affected public URL plus `/`, `/routes` and `/sitemap.xml`; confirm the production deployment points at the expected revert commit.
5. Record the incident, its trigger, the corrective PR and the verification result in the project-control ledger.

For a stale factual claim, the corrective change must retain or improve the product's fail-closed behaviour. Do not replace a broken claim with a generic booking handoff, inferred schedule, invented fare, or unsupported visa advice.

## Dependency and build safety

- Run the quality workflow for every pull request: clean install, full test suite, TypeScript, lint, production build and a tracked-file diff check.
- Review production dependency advisories during a planned dependency update or a relevant security event. Do not make a breaking framework upgrade solely to silence an audit report.
- The Astra #18 review found a production dependency advisory path through Next.js's bundled PostCSS, where the available fix required a major Next.js upgrade. That upgrade is deferred until it can be planned, tested and reviewed as an application change. Reassess if a compatible fix becomes available or the framework is upgraded for another approved reason.
- `next lint` is deprecated upstream. Keep the current lint command until the planned Next.js upgrade; migrate the lint path as part of that bounded upgrade, not as unrelated churn.

## Security controls and explicit boundaries

- Environment files and Vercel metadata are excluded from version control. Never place credentials, API keys, dashboard exports, partner reports or recovery codes in the repository, PRs or issue comments.
- Keep the existing CSP in **report-only** mode. It must not be enforced until JetStash has a reporting destination and a preview-based compatibility check for every required third-party integration. The absence of a reporting endpoint is the current blocker; report-only headers are not evidence that enforcement would be safe.
- Contact and Route Watch forms validate input, use a honeypot and apply the current process-local limiter. Do not add a distributed limiter speculatively. Revisit it if there is real abuse, repeated process restarts that bypass the limit, meaningful submission volume, or a hosting/provider limit.
- Add application error monitoring only when a concrete trigger exists: recurring unexplained errors, meaningful traffic that makes manual detection unreliable, a provider integration failure, or a production incident that cannot be diagnosed from existing logs and deployment history.

## Email, forms and partner dependencies

### A form or email report appears broken

1. Reproduce once with a harmless test submission; do not repeatedly submit real customer data.
2. Check the relevant deployment, configured provider status and the error presented to the user.
3. Confirm whether the problem is intake, provider delivery, or founder follow-up.
4. If email delivery is unavailable, keep the public form honest about what JetStash can do and restore the provider/configuration before advertising a response promise.
5. Record the failure and restoration outside public repository content if it contains customer data.

### Partner handoff or attribution is unavailable

1. Confirm the exact route, airport pair, dates and CTA surface.
2. Preserve the raw partner response or dashboard evidence privately.
3. Keep JetStash's existing exact-airport and fail-closed handoff rules. Do not substitute a generic city link or claim booking/commission attribution without provider evidence.
4. Treat a partner click as a click, not a booking or revenue, until the partner's reporting confirms the later event.
5. Escalate to the partner using the existing business thread; do not add tracking or public claims merely to compensate for missing provider reporting.

## Founder access recovery

Maintain recovery access outside the repository for these services: GitHub, Vercel, domain/DNS, JetStash business email, form/email providers, analytics, Trip.com, KAYAK and any future affiliate or payment provider.

If access is lost:

1. Use the provider's official recovery flow and retained recovery method; never commit recovery information to Git.
2. For GitHub, restore account access first, then verify repository ownership, `main`, Actions, rulesets, secrets and installed GitHub Apps.
3. For Vercel, verify the production project, linked GitHub repository, environment variables, deployment aliases and team access before redeploying.
4. For domain/DNS, verify the registrar account, nameservers, Vercel domain records and business-email records before changing application code.
5. Rotate a credential if it may have been exposed, then update the provider environment setting and redeploy through a reviewed PR where required.
6. Record the recovery outcome privately. Repository history cannot recover third-party credentials, inboxes, dashboards, analytics, partner reporting or DNS ownership.

GitHub currently indicates that the founder account has one verified email address. Add a second verified recovery email and enable/retain a secure second-factor recovery method through the account's official settings. This is founder account administration, not a repository code change.

## Evidence and incident record

For every material incident or trust correction, preserve:

- when it was detected and by whom;
- affected customer surfaces and whether a traveller could have acted on it;
- the evidence used to diagnose it;
- the PR/commit and deployment that corrected it;
- the verification result; and
- the condition that would justify reopening the issue.

Use `docs/project-control/STATUS.md`, `COMPLETED.md` and `DECISIONS.md` for durable project decisions and completed work. Keep customer information, access recovery details, provider dashboards and sensitive logs outside the repository.