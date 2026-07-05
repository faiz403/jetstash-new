export const siteConfig = {
  name: 'JetStash',
  domain: 'jetstash.co.uk',
  url: 'https://jetstash.co.uk',
  tagline: "The UK's travel intelligence platform for South Asia, the Gulf and beyond",
  description:
    'JetStash tracks route history, fare patterns and booking windows from UK airports to Pakistan, India, the Gulf, Turkey, Morocco and the wider Mediterranean — with dedicated hubs for family travel, Umrah and business class.',
};

// The nav is the brand's spine: the four core corridors in commercial order
// (matching the homepage hub ordering), then the full destination catalogue
// (the only nav path to Turkey, Morocco and the Mediterranean), then the two
// revenue verticals. Family Holidays stays in the footer and hub cross-links.
export const mainNav = [
  { label: 'India', href: '/india' },
  { label: 'Pakistan', href: '/pakistan' },
  { label: 'Umrah', href: '/umrah' },
  { label: 'Gulf', href: '/gulf' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'Business Class', href: '/business-class' },
  { label: 'Deals', href: '/deals' },
];

export const footerNav = {
  regions: [
    { label: 'Pakistan Hub', href: '/pakistan' },
    { label: 'India Hub', href: '/india' },
    { label: 'Gulf Hub', href: '/gulf' },
    { label: 'Umrah & Saudi', href: '/umrah' },
  ],
  travel: [
    { label: 'Family Holidays', href: '/family-holidays' },
    { label: 'Business Class', href: '/business-class' },
    { label: 'Request a Quote', href: '/quote-request' },
    { label: 'All Deals', href: '/deals' },
    { label: 'All Routes', href: '/routes' },
    { label: 'All Destinations', href: '/destinations' },
    { label: 'Travel Guides', href: '/guides' },
    { label: 'UK Airports', href: '/airports' },
  ],
  company: [
    { label: 'About JetStash', href: '/about' },
    { label: 'Travel Club', href: '/travel-club' },
    { label: 'Contact', href: '/contact' },
    { label: 'Affiliate Disclosure', href: '/affiliate-disclosure' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
  ],
};

export const regionGroups = {
  pakistan: {
    label: 'Pakistan',
    slug: 'pakistan',
    destinationSlugs: ['lahore', 'islamabad', 'karachi'],
  },
  india: {
    label: 'India',
    slug: 'india',
    destinationSlugs: ['delhi', 'mumbai', 'ahmedabad', 'amritsar'],
  },
  gulf: {
    label: 'Gulf',
    slug: 'gulf',
    destinationSlugs: ['dubai', 'doha'],
  },
  umrah: {
    label: 'Umrah & Saudi',
    slug: 'umrah',
    destinationSlugs: ['jeddah', 'madinah'],
  },
  mediterranean: {
    label: 'Mediterranean & Beyond',
    slug: 'mediterranean',
    destinationSlugs: ['istanbul', 'antalya', 'dalaman', 'bodrum', 'izmir', 'barcelona', 'faro', 'athens', 'rome'],
  },
  northAfrica: {
    label: 'North Africa',
    slug: 'north-africa',
    destinationSlugs: ['marrakech', 'agadir', 'casablanca', 'tangier'],
  },
};
