# Priority route review — 3 November 2026

Prepared on `codex/route-verification-2026-11-03` from refreshed `origin/main` at
`4bcc5ea`. The supplied Claude worktree was clean, with no branch-only commits,
untracked progress files or pending edits. Existing corrections, fare observations
and route-status history are preserved. No additional unfinished route corrections
were present to recover. This review covers the three requested priority routes.

## Evidence read today

### Manchester–Lahore and Manchester–Islamabad

[Manchester Airport's PIA anniversary announcement](https://mediacentre.manchesterairport.co.uk/pia-hits-100000-passenger-milestone-as-it-marks-12-months-of-direct-services-to-pakistan-from-manchester-airport/)
is dated **26 October 2026**, after the winter schedule change. Its full text was
opened through web retrieval and independently read in Edge on **3 November 2026**.
It identifies PIA's two direct Pakistan services, reports four Manchester departures
weekly for Islamabad on Monday, Tuesday, Thursday and Saturday, and one weekly
Lahore departure on Wednesday. These are the airport's published operating patterns,
not a promise that every future date runs unchanged. No current fares are derived
from this announcement.

[Manchester Airport's current Lahore guide](https://www.manchesterairport.co.uk/destinations-and-guides/lahore/)
was read in Edge today. It explicitly describes Manchester–Lahore direct flights
and an approximate eight-hour journey. That independently supports retaining the
route's existing eight-hour planning duration. It does not itself name an operator;
the dated announcement above supports PIA. The older May launch announcement is
historical corroboration, not the new operating-pattern evidence.

[Manchester Airport's current PIA operator page](https://www.manchesterairport.co.uk/flight-operators/pakistan-international-airlines/)
was read in Edge today and confirms nonstop Manchester–Islamabad service. It does
not state frequency, weekdays or duration. The dated announcement supplies the first
two; it supplies no duration.

[Manchester Airport's Islamabad guide](https://www.manchesterairport.co.uk/destinations-and-guides/islamabad/)
was also read today and gives 6h45m. That conflicts with the older 7½-hour tracking
estimate used by JetStash. Neither figure is renewed: route and destination wording
now directs travellers to the scheduled duration. The historical tracking evidence
remains in the verification note. PIA's homepage reached a security-verification
screen in Edge; no challenge was completed and no booking form was submitted.

### Heathrow–Jeddah

[Heathrow's live SV120 departure record](https://www.heathrow.com/departures/terminal-4/flight-details/SV120)
was read in Edge on **3 November 2026**. A text-only fetch exposed only the page
shell and was not used as flight evidence. The browser rendered:

- Flight SV120, Saudia, London Heathrow (LHR) to Jeddah (JED), Tuesday 3 November.
- Status departed; actual departure 14:39, scheduled departure 14:15.
- Estimated arrival 23:20; departing Terminal 4, arriving Terminal 1.

This supports a current Saudia direct service. One flight record does not establish
a weekly count or representative route duration. The old, unreconfirmed 6h15m
figure is removed; no duration is calculated from an estimated arrival. British
Airways remains excluded, and no route-level withdrawal or service-ended event is
added. The earlier operator correction and supporting history remain intact.

## Publication and expiry

| Route | Result | Checked | Review due | Category |
|---|---|---|---|---|
| Manchester–Lahore | PIA direct; Wednesday weekly pattern; approximate 8h retained | 2026-11-03 | 2026-12-03 | RECENT / CHANGING |
| Manchester–Islamabad | PIA direct; four weekly, Mon/Tue/Thu/Sat; numeric duration removed | 2026-11-03 | 2026-12-03 | RECENT / CHANGING |
| Heathrow–Jeddah | Saudia direct; frequency unconfirmed; numeric duration removed | 2026-11-03 | 2026-12-03 | RECENT / CHANGING |

The existing 30-day cadence is retained for these recently relaunched or changing
services. All three checks remain valid through 3 December and fail closed from
4 December without a further qualifying check. Manchester–Islamabad's existing
Quick answers are reviewed against the same fresh announcement and remain bound
to this verification date. No freshness threshold, route-status event, fare record,
affiliate link or application gate changes.

## Validation

Before edits: TypeScript passed; all 5,605 tests across 288 files passed.

After changes:

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, no warnings or errors.
- `npm test -- --run`: 5,605 tests passed across 288 files.
- `npm run build`: passed, 169 pages generated. The initial sandboxed build
  could not fetch Google Fonts; the authorised network-enabled rerun succeeded.
- Generated HTML for all three route pages retains the existing Fare Signal,
  shows the 3 November check, and contains the reviewed schedule/duration wording.
- Existing expiry tests exercise 3 December validity and 4 December suppression
  across service/fare presentation, metadata, Book By, Quick answers and Arrive By
  route links. The prior BA exclusion and distinct connecting-fare safeguards pass.

No live forms, affiliate links or billable routing APIs were used. No merge or
production deployment is part of this review.
