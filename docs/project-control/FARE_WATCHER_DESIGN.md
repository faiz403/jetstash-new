# Fare Watcher / Standout Fares — Design Brief

Status: design only. No monitoring, scraping or automatic publication is approved.

## Purpose

Identify internal candidates when a legitimate fare feed or partner API shows a
meaningful change against a consistent JetStash search profile. A candidate is
an editorial lead, not a customer-facing claim.

## Evidence and inputs

- Use only approved airline, metasearch API, affiliate-feed or partner-feed
  sources whose terms permit this use.
- Never scrape Google Flights, Skyscanner, Trip.com or other consumer pages.
- Keep one versioned search profile per route: passenger count, cabin,
  travel dates or horizon, baggage assumptions and currency.
- Store the checked timestamp, source, exact dates, fare, routing and evidence
  limits for every observation.

## Candidate flow

1. A permitted feed produces an observation matching a profile.
2. The system compares it with the route's recent median and recent low only
   when the comparison window and sample size are explicit.
3. It creates an internal candidate alert with the raw evidence and reason,
   such as below-median fare or unusual routing change.
4. A founder/editor rechecks the source manually and approves, edits or rejects
   the candidate.
5. Approved observations may enter the append-only archive; nothing publishes
   automatically.
6. Candidates expire automatically when their checked date, travel dates or
   source availability no longer support the claim.

## Guardrails

- Do not call a fare a deal, standout, cheapest or best without an approved
  definition and sufficient evidence.
- Unknown baggage, seat fees and mandatory charges remain unknown.
- A feed alert never changes route truth, Book By, Travel Ready or affiliate
  links.
- The public surface must show observation date and limitations, not a live-price
  promise.

## Open decisions before implementation

- Which permitted provider supplies stable API/feed access and usage rights?
- Minimum sample size and comparison window for each route profile.
- Candidate retention and audit-log location.
- Founder approval workflow and notification channel.
