import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';

export const metadata: Metadata = {
  alternates: { canonical: '/pakistan' },
  title: 'Pakistan Travel Hub — Flights from the UK',
  description:
    'Flights and travel guidance for Lahore, Islamabad and Karachi from UK airports, including visa requirements and Eid travel timing.',
};

export default function PakistanHubPage() {
  const destinations = getDestinationsByRegion('pakistan');

  return (
    <RegionHubPage
      eyebrow="Pakistan Hub"
      title="Pakistan, covered properly"
      intro="Lahore, Islamabad and Karachi get the same depth of coverage here as any European city break — because for a huge number of UK travellers, this is the route that actually matters."
      destinationsInRegion={destinations}
      airportsServed={['Manchester', 'Birmingham', 'London Heathrow']}
      showFamilyVisitCallout
      quoteRegion="pakistan"
      heroKey="pakistan"
      visaNote="UK passport holders require a visa to enter Pakistan. The e-Visa system processes most tourist and family-visit applications within 7 days when applied for in advance. NICOP holders (Pakistan-origin UK nationals) typically do not require a separate visa — confirm current requirements with NADRA or your nearest Pakistani consulate."
      practicalNotes={[
        {
          title: 'Eid and wedding season push fares up sharply',
          body: 'The weeks around Eid al-Fitr, Eid al-Adha and the UK summer holidays see the highest demand on Pakistan routes. Booking 2–3 months ahead of these windows typically holds the best fares.',
        },
        {
          title: 'Manchester is usually the most direct option in the north',
          body: 'PIA and other carriers run direct Manchester–Lahore and Manchester–Islamabad services, often at a lower fare than connecting through London for travellers based in the North West, Yorkshire or the Midlands.',
        },
        {
          title: 'Connecting via the Gulf can be cheaper for Karachi',
          body: 'Emirates, Qatar Airways and Etihad all run competitive one-stop options to Karachi via Dubai, Doha or Abu Dhabi — worth comparing against direct fares, particularly outside peak season.',
        },
      ]}
    />
  );
}
