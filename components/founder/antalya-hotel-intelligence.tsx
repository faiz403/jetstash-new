import type { HotelEvidenceItem, HotelEvidenceRecord, HotelEvidenceSource } from '@/data/hotel-evidence';

function formatCheckedDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function stateLabel(state: HotelEvidenceItem['state']): string {
  return {
    evidenced: 'Evidenced',
    'not-stated': 'Not stated',
    unknown: 'Unknown',
    conflicted: 'Conflicting evidence',
    unresolved: 'Unresolved',
  }[state];
}

function providerLocationRelationship(record: HotelEvidenceRecord): string {
  return record.geography.providerGeographyConflict === 'yes'
    ? 'Different geography level'
    : record.geography.providerGeographyConflict === 'no'
      ? 'Aligned at supported level'
      : 'Unresolved';
}

function locationConfidence(record: HotelEvidenceRecord): string {
  return record.geography.classificationConfidence === 'strong' ? 'Strong' : 'Usable with caveat';
}

function travellerLocationCopy(record: HotelEvidenceRecord): string {
  const { geography } = record;
  if (geography.providerGeographyConflict === 'yes' && geography.classificationNotes.includes('Lara Beach proper')) {
    return `Booking sites may group the property under ${geography.providerMarketingLocationLabel}, while the sourced address places it more precisely in ${geography.operationalArea}. JetStash keeps that distinction visible rather than treating the property as Lara Beach proper.`;
  }
  if (geography.providerGeographyConflict === 'no') {
    return `The provider's ${geography.providerMarketingLocationLabel} positioning is supported by the available location evidence, while ${geography.operationalSubArea} gives the more precise sub-area.`;
  }
  const sideCentre = record.locationJourneyContext.townCityHistoricRelationships.find((item) => item.claim === 'Side Centre relationship');
  const sideDistance = sideCentre?.value.replace(/^Approximately/, 'approximately').replace(/\.$/, '') ?? 'distance from Side Centre is evidenced';
  return `The property is in ${geography.operationalSubArea} rather than Side historic core. Sources place it ${sideDistance}, but they do not establish a walkable route.`;
}

function SourceLine({ source }: { source: HotelEvidenceSource }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed text-ink-300">
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-2 hover:text-brass-200">
        {source.name}
      </a>
      <span>checked {formatCheckedDate(source.checkedDate)}</span>
    </li>
  );
}

function EvidenceItem({ item }: { item: HotelEvidenceItem }) {
  return (
    <li className="border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-sand-50">{item.claim}</p>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-300">
          {stateLabel(item.state)}
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-300">{item.value}</p>
      {item.method && <p className="mt-1 text-xs leading-relaxed text-ink-400">Method: {item.method}</p>}
      {item.limitation && <p className="mt-1 text-xs leading-relaxed text-brass-200">Limit: {item.limitation}</p>}
      <ul className="mt-2 space-y-1">
        {item.sources.map((source) => <SourceLine key={`${item.claim}-${source.name}`} source={source} />)}
      </ul>
    </li>
  );
}

function LocationInsight({ record }: { record: HotelEvidenceRecord }) {
  const conflictCopy = record.geography.providerGeographyConflict === 'yes'
    ? 'The provider label and the sourced operational context are not the same level of description, so JetStash keeps both visible.'
    : record.geography.providerGeographyConflict === 'no'
      ? 'The provider label and the sourced operational context align at the level supported by the evidence.'
      : 'The available sources do not establish whether the provider label and operational context conflict.';

  return (
    <section className="min-w-0 rounded-md border border-brass-500/35 bg-ink-900/70 p-5 shadow-panel sm:p-6" aria-label={`${record.hotelName} location insight`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass-300">Location intelligence</p>
          <h2 className="mt-2 font-display text-2xl tracking-tight text-sand-50 sm:text-3xl">{record.hotelName}</h2>
        </div>
        <div className="min-w-0 max-w-full text-left sm:text-right">
          <span className="inline-flex max-w-full rounded-full border border-brass-300/40 px-3 py-1 text-xs font-semibold text-brass-200">
            Location confidence: {locationConfidence(record)}
          </span>
          <p className="mt-2 break-words text-xs text-ink-300">Provider / location relationship: <span className="font-semibold text-sand-100">{providerLocationRelationship(record)}</span></p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-y border-white/10 py-5 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Provider area</p>
          <p className="mt-1 text-lg text-sand-50">{record.geography.providerMarketingLocationLabel}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">JetStash area context</p>
          <p className="mt-1 text-lg text-brass-200">{record.geography.operationalArea}</p>
          <p className="mt-1 text-xs text-ink-400">{record.geography.operationalSubArea}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Sourced address</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-ink-200">{record.geography.exactSourcedAddress}</p>
        </div>
      </div>

      <div className="min-w-0 border-l-2 border-brass-400 pl-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-300">Why this matters</p>
        <p className="mt-2 text-sm leading-relaxed text-sand-100">{travellerLocationCopy(record)}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{conflictCopy}</p>
      </div>
    </section>
  );
}

function EvidenceDetails({ record }: { record: HotelEvidenceRecord }) {
  const contextItems = [
    ...(record.locationJourneyContext.airportDistance ? [record.locationJourneyContext.airportDistance] : []),
    ...record.locationJourneyContext.airportTimeEvidence,
    ...record.locationJourneyContext.townCityHistoricRelationships,
  ];

  return (
    <div className="mt-3 grid gap-3">
      <details className="group rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-sand-50 marker:hidden">Location evidence <span className="float-right text-brass-300 transition-transform group-open:rotate-45">+</span></summary>
        <div className="mt-4 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Geography source</p>
            <ul className="mt-2 space-y-1"><SourceLine source={record.geography.geographySource} /></ul>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">Evidence state: {record.geography.providerGeographyConflict === 'yes' ? 'conflict surfaced' : record.geography.providerGeographyConflict === 'no' ? 'aligned at supported level' : 'conflict unresolved'}.</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Property source</p>
            <ul className="mt-2 space-y-1"><SourceLine source={record.officialPropertySource} /></ul>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">Provider listing: {record.provider} metadata retained as secondary context.</p>
          </div>
        </div>
      </details>

      <details className="group rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-sand-50 marker:hidden">Property evidence <span className="float-right text-brass-300 transition-transform group-open:rotate-45">+</span></summary>
        <ul className="mt-4 border-t border-white/10 pt-4"><>{record.propertyFacts.map((item) => <EvidenceItem key={item.claim} item={item} />)}</></ul>
      </details>

      <details className="group rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-sand-50 marker:hidden">Journey context and limitations <span className="float-right text-brass-300 transition-transform group-open:rotate-45">+</span></summary>
        <div className="mt-4 border-t border-white/10 pt-4">
          {contextItems.length > 0 ? <ul><>{contextItems.map((item, index) => <EvidenceItem key={`${item.claim}-${index}`} item={item} />)}</></ul> : <p className="text-sm text-ink-300">No airport-time estimate was recorded in the approved evidence.</p>}
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">Open limitations</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-brass-200">
              {[...record.locationJourneyContext.limitations, ...record.limitations].map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

export function AntalyaHotelIntelligence({ records }: { records: readonly HotelEvidenceRecord[] }) {
  return (
    <div className="min-h-screen w-full min-w-0 bg-ink-950 text-sand-50">
      <section className="relative w-full min-w-0 break-words overflow-hidden border-b border-white/10 bg-ink-900 py-12 sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(200,147,46,0.16),transparent_42%)]" aria-hidden="true" />
        <div className="relative mx-auto w-full min-w-0 max-w-content px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brass-300">Private founder preview · internal only</p>
          <h1 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-sand-50 sm:text-5xl">Antalya hotel intelligence</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-200 sm:text-lg">A location-first test of whether JetStash can explain where a property actually sits, what the evidence supports, and what remains uncertain.</p>
          <p className="mt-4 text-xs leading-relaxed text-ink-400">Three approved internal records · checked 11 August 2026 · no prices, rankings, booking links or recommendations.</p>
        </div>
      </section>

      <main className="mx-auto flex w-full min-w-0 max-w-content flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        {records.map((record) => (
          <article key={record.evidenceId} className="min-w-0">
            <LocationInsight record={record} />
            <EvidenceDetails record={record} />
          </article>
        ))}
      </main>
    </div>
  );
}
