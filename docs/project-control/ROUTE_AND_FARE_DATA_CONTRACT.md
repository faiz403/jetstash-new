# Route and fare data contract

- A public route needs an explicit verification object. `verifiedDate` records the real check date; `reviewDueDate` must not precede it. Once the due date passes, public directness fails closed to verification pending.
- “Verified” means the cited evidence supports the exact claim being published. Destination-level evidence must not be inflated into an exact airport, operator, frequency, duration, or nonstop claim.
- Booking-engine results can prove that a searched itinerary appeared. They must not be used alone to infer a stable route, frequency, operator commitment, future schedule, or protected connection.
- A fare may publish only when its route is currently direct or connecting and the observation has exact travel dates and GBP provenance. History remains append-only when it becomes stale or ineligible.
- Clean and self-transfer are itinerary facts. Self-transfer must be explicitly recorded by the source evidence; never infer it from price, airline count, stops, or an airport change.
- Service-ended routes retain their historical data. They may expose only an exact connecting handoff when the route has an evidenced connecting alternative; they must never render as active direct service.
- Run the portfolio validation tests whenever route, verification, fare, warning, status, or booking-provider data changes. Fix structural errors immediately; overdue-review warnings require fresh evidence, not an administrative date extension.
