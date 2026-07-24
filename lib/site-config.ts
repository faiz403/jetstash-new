export const siteConfig = {
  name: 'JetStash',
  domain: 'jetstash.co.uk',
  url: 'https://jetstash.co.uk',
  tagline: "UK travel intelligence for international journeys",
  description:
    'JetStash helps UK travellers make better international booking decisions with route status, fare patterns, booking timing and travel-readiness guidance. Our deepest verified coverage is currently South Asia and the Gulf, alongside selected destination guidance in Turkey, Morocco and the Mediterranean.',
  /**
   * Default inbox for lead-capture form submissions (contact form, quote
   * requests) — /app/api/contact and /app/api/quote-request both read
   * this as their fallback. The CONTACT_TO_EMAIL environment variable, if
   * set in Vercel, overrides this without a code change. This is the one
   * place to edit either way — never hardcode a routing address in a
   * route file directly.
   */
  contactEmail: 'faiz24485@gmail.com',
};

// The nav is the brand's spine: lead with the travel-intelligence product,
// then let the destination catalogue reveal the specialist hubs. This keeps
// Pakistan, India, the Gulf and Umrah prominent without implying they are the
// whole of JetStash.
export const mainNav = [
  { label: 'Routes', href: '/routes' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'UK Airports', href: '/airports' },
  { label: 'Travel Ready', href: '/travel-ready-check' },
  { label: 'Guides', href: '/guides' },
  { label: 'Deals', href: '/deals' },
];

export const footerNav = {
  explore: [
    { label: 'All Routes', href: '/routes' },
    { label: 'All Destinations', href: '/destinations' },
    { label: 'UK Airports', href: '/airports' },
    { label: 'Travel Ready Check', href: '/travel-ready-check' },
    { label: 'Travel Guides', href: '/guides' },
  ],
  specialist: [
    { label: 'Pakistan Hub', href: '/pakistan' },
    { label: 'India Hub', href: '/india' },
    { label: 'Gulf Hub', href: '/gulf' },
    { label: 'Umrah & Saudi', href: '/umrah' },
    { label: 'Business Class', href: '/business-class' },
    { label: 'Family Holidays', href: '/family-holidays' },
    { label: 'Request a Quote', href: '/quote-request' },
    { label: 'All Deals', href: '/deals' },
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
