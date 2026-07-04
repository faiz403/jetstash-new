export interface CommunityNoteScope {
  routeSlug?: string;
  destinationSlug?: string;
  airportSlug?: string;
}

export interface CommunityNote {
  id: string;
  scope: CommunityNoteScope;
  authorLabel: string;
  date: string;
  body: string;
  verified: boolean;
}

/**
 * Real traveller-submitted notes, scoped to a route, destination, or
 * airport. Deliberately seeded empty — there is no submission pipeline
 * yet, and fabricating "user" testimonials would be exactly the kind of
 * dark pattern this codebase's no-fabricated-content rule exists to
 * prevent (see CLAUDE.md and README's "No fabricated content"). Populate
 * this once a real submission + moderation flow exists; until then,
 * components render an honest empty state, matching the existing
 * NoFareFallback pattern rather than pretending content exists.
 */
export const communityNotes: CommunityNote[] = [];

export function getCommunityNotesForScope(scope: CommunityNoteScope) {
  return communityNotes.filter(
    (n) =>
      (scope.routeSlug !== undefined && n.scope.routeSlug === scope.routeSlug) ||
      (scope.destinationSlug !== undefined && n.scope.destinationSlug === scope.destinationSlug) ||
      (scope.airportSlug !== undefined && n.scope.airportSlug === scope.airportSlug)
  );
}
