import type { Metadata } from 'next';
import { RegionHubPage } from '@/components/sections/region-hub-page';
import { getDestinationsByRegion } from '@/data/destinations';

export const metadata: Metadata = {
  title: 'Gulf Travel Hub — Dubai, Doha & UAE Flights from the UK',
  description:
    'Flights and travel guidance for Dubai and Doha from UK airports, including stopover routes, visa rules and seasonal pricing.',
};

export default function GulfHubPage() {
  const destinations = getDestinationsByRegion('gulf');

  return (
    <RegionHubPage
      eyebrow="Gulf Hub"
      title="The Gulf, beyond the stopover"
      intro="Dubai and Doha work as standalone family holidays, weekend city breaks, or the most comfortable way to break up a longer journey south or east."
      destinationsInRegion={destinations}
      airportsServed={['London Heathrow', 'Manchester', 'Birmingham', 'London Gatwick', 'Glasgow', 'Leeds Bradford']}
      visaNote="UK passport holders receive a visa on arrival for both the UAE and Qatar, typically valid for 30 days and free of charge. Always check the latest requirements with the relevant embassy before travel, as policies can change."
      practicalNotes={[
        {
          title: 'Winter is peak season — and peak price',
          body: 'November through March brings the most comfortable weather to the Gulf, which means UK school holiday periods within that window carry a significant price premium. Late spring and early autumn offer a reasonable balance of heat and value.',
        },
        {
          title: 'Stopover deals can beat a direct ticket to your final destination',
          body: 'If you are ultimately headed further east, a Dubai or Doha stopover fare sometimes works out cheaper than a one-stop ticket booked purely as a connection — worth comparing both ways.',
        },
        {
          title: 'Ramadan changes the pace of the city, not the price',
          body: 'Restaurant hours and some attractions adjust during Ramadan, but this rarely affects flight pricing directly. Plan logistics around it rather than expecting a fare difference.',
        },
      ]}
    />
  );
}
