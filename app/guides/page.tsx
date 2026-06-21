import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Travel Guides',
  description: 'Practical guides for UK travellers heading to Pakistan, India, the Gulf and beyond.',
};

const guides = [
  {
    title: 'How visa processing time should shape your booking date',
    body: 'For Pakistan, India and Saudi Arabia, visa processing — not flight pricing — is often the real constraint on how late you can book. e-Visas for India and Pakistan are typically processed within 4–7 days, but delays happen, particularly during high-demand periods. Build at least 2–3 weeks of buffer before your travel date if you haven\'t applied yet, and treat "fastest possible visa turnaround" as a worst case, not a plan.',
  },
  {
    title: 'Why Eid and Diwali pricing behaves differently to UK school holidays',
    body: 'UK school holiday pricing follows a predictable pattern most travel sites are built around. Eid and Diwali don\'t follow the same calendar logic — they shift each year and create demand spikes that aren\'t tied to half-term dates. If your travel is tied to a festival, treat the festival date as your primary planning anchor, then check UK school holiday overlap separately.',
  },
  {
    title: 'Comparing direct versus Gulf-connecting fares properly',
    body: 'A one-stop fare via Dubai, Doha or Abu Dhabi is sometimes cheaper than a direct flight to Pakistan or India — but the comparison needs to include total journey time, connection risk, and whether checked luggage transfers automatically. For trips with young children or elderly relatives, a direct flight is often worth a moderate price premium.',
  },
  {
    title: 'What "package" actually means for Umrah trips',
    body: 'Umrah packages bundle flights, hotels and transport, but the proportion of nights in Makkah versus Madinah — and the distance of each hotel from the Haram — varies enormously between operators advertising similar prices. Ask for the specific hotel names before booking, not just the star rating.',
  },
  {
    title: 'When business class sales actually happen',
    body: 'Long-haul business class fares to the Gulf and South Asia don\'t follow the same "book 6 weeks ahead" logic as economy. Airline-specific sales and shifts in corporate travel demand matter more than your booking window — it\'s worth checking fares periodically rather than assuming an early booking guarantees the best price.',
  },
  {
    title: 'Why UK school holidays and Eid/Diwali rarely line up — and what that means for price',
    body: 'School holiday dates are fixed by term calendars; Eid and Diwali shift each year against the Islamic and Hindu lunar calendars. In years where a festival falls inside a UK school holiday window, expect the steepest fares of the year — both demand spikes hit the same dates at once. Check both calendars separately before assuming "half-term" and "Eid" mean the same pricing pattern every year.',
  },
  {
    title: 'An eSIM is usually cheaper and easier than a local SIM for most of these routes',
    body: 'For Pakistan, India and the Gulf, an eSIM bought before departure avoids the airport SIM-shop queue and the risk of an unregistered number being blocked after a few days — a known issue with some Pakistani networks for foreign-registered SIMs. Compare a dedicated travel eSIM provider (such as Airalo or Holafly) against your UK provider\'s roaming add-on; for trips longer than a week, a local eSIM is almost always the cheaper option, but check your phone supports eSIM before relying on it as your only option.',
  },
  {
    title: 'Travel insurance for family-visit trips needs checking more carefully than for a holiday',
    body: 'Many standard travel insurance policies treat "visiting friends and relatives" trips differently from holidays, and some exclude claims if you\'re staying with family rather than in a hotel — always check the policy wording rather than assuming a generic annual policy covers this trip type. For Umrah specifically, confirm the policy explicitly covers pilgrimage travel, as some standard policies exclude it by default.',
  },
  {
    title: 'Checked baggage allowances vary more than people expect on these routes',
    body: 'PIA, Air India and Saudia all have different standard checked baggage allowances to British Airways or Emirates on the same general route — and family-visit travellers carrying gifts or shopping routinely exceed whichever allowance applies. Check your specific airline\'s allowance at the time of booking rather than assuming "international flight" means a standard 23kg, and pre-purchase extra baggage online rather than paying the airport rate.',
  },
  {
    title: 'Comparing airlines on the same route is worth the extra five minutes',
    body: 'On routes served by more than one carrier — Heathrow to Delhi, for example, where British Airways, Virgin Atlantic and Air India all operate directly — service standards, baggage allowances and typical pricing all differ meaningfully. Don\'t default to whichever airline appears first in a search; compare at least two before booking, particularly for a long-haul family trip.',
  },
];

export default function GuidesPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">Travel Guides</Badge>
          <h1 className="mt-4 font-display text-4xl text-sand-50 sm:text-5xl">Practical guides</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-300">
            The detail that actually affects your booking — not generic packing-list content.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <div className="flex flex-col gap-10">
            {guides.map((guide) => (
              <article key={guide.title} className="border-b border-ink-100 pb-10 last:border-0">
                <h2 className="font-display text-2xl text-ink-900">{guide.title}</h2>
                <p className="mt-3 leading-relaxed text-ink-600">{guide.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
