export const siteConfig = {
  name: 'JetStash',
  domain: 'jetstash.co.uk',
  url: 'https://jetstash.co.uk',
  tagline: "UK travel intelligence for international journeys",
  // Metadata audit (Aug 2026): was 302 characters — the homepage's own
  // <meta description> and, via the root layout, the site-wide default
  // used on any page without one of its own. Shortened to one sentence
  // that still states what JetStash does and where its verified coverage
  // is deepest, without the second sentence's fuller region list (South
  // Asia, the Gulf, Turkey, Morocco, the Mediterranean) — a search snippet
  // isn't the place for an exhaustive list, and each region already has
  // its own hub page description for that.
  description:
    'JetStash helps UK travellers make better booking decisions: route status, fare patterns, booking timing and travel-readiness guidance, deepest in South Asia and the Gulf.',
  /**
   * Default inbox for lead-capture form submissions (contact form, quote
   * requests) — /app/api/contact and /app/api/quote-request both read
   * this as their fallback. The CONTACT_TO_EMAIL environment variable, if
   * set in Vercel, overrides this without a code change. This is the one
   * place to edit either way — never hardcode a routing address in a
   * route file directly.
   */
  contactEmail: 'contact@jetstash.co.uk',
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
  // A9 reposition (August 2026): was 'Deals', which implies JetStash has
  // proven a price is unusually good against historical data — it hasn't.
  // Exhaustive Tracked Fares (PR #140, August 2026): this entry now points
  // at /tracked-fares, not /deals — the label finally leads to what it
  // promises, every current display-ready Fare Signal (79 of 88 routes
  // today), not the smaller curated Deal selection. Deliberately not a
  // second primary-nav item for /deals (Option B, founder decision,
  // 17 August 2026): two adjacent "fare" concepts in primary nav would
  // read as unexplained duplication and push the product back toward a
  // generic deals-site feel. /deals remains real and valuable — reachable
  // via footerNav.specialist below and a restrained cross-link from
  // /tracked-fares itself, never removed.
  { label: 'Tracked Fares', href: '/tracked-fares' },
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
    // A9 reposition (August 2026): matches the mainNav label above — see its
    // comment for why. Exhaustive Tracked Fares (PR #140): now points at
    // /tracked-fares, matching mainNav's own repointing.
    { label: 'Tracked Fares', href: '/tracked-fares' },
    // Exhaustive Tracked Fares (PR #140, August 2026): /deals stays
    // reachable — deliberately footer-only, not primary nav (Option B) —
    // now that "Tracked Fares" itself points elsewhere.
    { label: 'Deals', href: '/deals' },
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
    destinationSlugs: ['delhi', 'mumbai', 'ahmedabad', 'amritsar', 'bengaluru'],
  },
  bangladesh: {
    label: 'Bangladesh',
    slug: 'bangladesh',
    destinationSlugs: ['dhaka', 'sylhet'],
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
