'use client';

const examples = [
  ['Funeral', 'You need to reach family by a fixed time after landing.'],
  ['Wedding', 'Your flight lands in the morning and the ceremony starts a few hours later.'],
  ['Concert or match', 'You have tickets for a fixed start time after your flight.'],
  ['Important family journey', 'Someone is collecting you or you need to reach another town after landing.'],
];

export function ArriveByIntroduction() {
  return <>
    <section aria-labelledby="arrive-by-title" className="rounded-md bg-ink-900 px-5 py-8 text-white sm:px-8 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-sand-200">Arrive By · Limited beta</p>
      <h1 id="arrive-by-title" className="mt-3 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Need to be there on time?</h1>
      <p className="mt-4 max-w-2xl text-lg text-sand-100">Flying for a funeral, wedding or another important event you cannot afford to miss?</p>
      <p className="mt-3 max-w-2xl text-sand-200">Arrive By looks at your journey from home to your departure airport, through your flight and onward to your final destination. It helps you work out when to leave and whether a supported journey looks achievable.</p>
      <a href="#arrive-by-planner" onClick={() => document.getElementById('arrive-by-planner')?.focus()} className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-sand-50 px-5 py-3 font-semibold text-ink-900 hover:bg-sand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Check my journey</a>
      <p className="mt-4 max-w-2xl text-sm text-sand-200">Planning guidance, not a guarantee. Leave extra time for journeys that matter.</p>
    </section>

    <section aria-labelledby="arrive-by-question" className="py-7 sm:py-8">
      <h2 id="arrive-by-question" className="font-display text-2xl sm:text-3xl">Can I make it on time?</h2>
      <p className="mt-3 max-w-3xl text-ink-600">Using the flight times and buffers you enter, Arrive By can help show when to leave home, airport timing, your estimated final arrival and the time you may have to spare.</p>
      <p className="mt-2 max-w-3xl text-ink-600">Where supported, it also checks what happens if you miss an important onward service, with a driving fallback when that missed connection would put your ready-by time at risk.</p>
      <p className="mt-3 max-w-3xl text-sm text-ink-600">Results can be ESTIMATE ONLY or CANNOT CONFIRM. Flight delays, queues and changing transport conditions can affect your journey. You enter your flight times yourself; this is not live flight tracking.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {examples.map(([title, description]) => <div key={title} className="min-w-0 rounded-sm border border-ink-100 bg-sand-50 p-4">
          <h3 className="font-semibold text-ink-900">{title}</h3>
          <p className="mt-1 text-sm text-ink-600">{description}</p>
        </div>)}
      </div>
      <p className="mt-3 text-sm text-ink-600">An important appointment can need the same careful timing.</p>
    </section>
  </>;
}
