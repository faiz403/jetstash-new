import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';

// Pure ISR, matching the route detail pages — RegionHubPage renders
// getEffectiveRoutePresentation() and DealCard, both of which must
// regenerate without a deploy once a ledger event's effective date passes.
export const revalidate = 21600;

export const metadata: Metadata = {
  alternates: { canonical: '/gulf' },
  title: 'Gulf Travel Hub: Dubai, Doha & UAE Flights from the UK',
  description:
    'Flights and travel guidance for Dubai and Doha from UK airports, including stopover routes, visa rules and seasonal pricing.',
};

export default function GulfHubPage() {
  const destinations = getDestinationsByRegion('gulf');

  return (
    <RegionHubPage
      eyebrow="Gulf Hub"
      title="The Gulf, beyond the stopover"
      intro="Dubai and Doha work as standalone family holidays, weekend city breaks, or a way to break up a longer journey south or east."
      destinationsInRegion={destinations}
      airportsServed={['London Heathrow', 'Manchester', 'Birmingham', 'London Gatwick', 'Glasgow', 'Leeds Bradford']}
      quoteRegion="gulf"
      heroKey="gulf"
      visaNote="UAE: Current GOV.UK guidance says travellers using a full British Citizen passport can receive visitor or tourist permission free on arrival for up to 90 days within a 180-day period. The allowance may be continuous or split across multiple visits. Qatar: For tourism, travellers using a full British Citizen passport can receive free visitor permission on arrival for up to 30 days initially. Longer stays need an extension through Qatar's Ministry of Interior before expiry. Check the current official requirements for your passport, trip and supporting documents."
      practicalNotes={[
        {
          title: 'Winter is the Gulf\'s most comfortable season',
          body: 'November through March brings the most comfortable weather to the Gulf, and it overlaps UK school holidays, so check dated fares for your own dates early. JetStash tracks dated fare observations, not a seasonal price pattern.',
        },
        {
          title: 'Compare a stopover with a one-stop connection',
          body: 'If you are ultimately headed further east, compare a Dubai or Doha stopover with a one-stop ticket booked purely as a connection, and compare the total journey time as well as the fare.',
        },
        {
          title: 'Ramadan changes the pace of the city',
          body: 'Restaurant hours and some attractions adjust during Ramadan. JetStash has not tracked whether Ramadan changes flight prices on these routes, so compare dated fares for your dates.',
        },
      ]}
    />
  );
}
