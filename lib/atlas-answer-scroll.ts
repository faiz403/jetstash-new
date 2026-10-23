/**
 * Which edge to align the Atlas answer card to when a deliberate selection brings it into view below lg.
 *
 * Map taps: the visitor is scrolled down at the map, so always put the card's top just under the sticky header (the global
 * scroll-padding-top supplies that offset). Chip taps: the chips are at the top and the card opens right below them, so
 * scroll only the minimum, except when the card is taller than the visible area: `nearest` can do nothing for a card that
 * spans both viewport edges, so align its top instead and the verdict is what the visitor sees first.
 */
export function getAnswerScrollBlock(input: {
  source: 'chip' | 'map';
  cardHeight: number;
  viewportHeight: number;
}): 'start' | 'nearest' {
  if (input.source === 'map') return 'start';
  return input.cardHeight > input.viewportHeight - 140 ? 'start' : 'nearest';
}

/**
 * Classifies an interaction as an explicit activation that should bring the answer card (or the next-step hint) into view,
 * or null when it should not. Pure so the rules are unit-tested; the component feeds it facts read from the event target.
 *
 *  - Only controls count: native chip buttons, SVG controls with role="button", and the SVG country labels that select a
 *    country (inert SVG text, such as the departure-airport label, never counts). Background presses, swipes, hover and plain focus never reach here.
 *  - A native <button> is activated by the browser's own click (Space fires on key release), so its keydown is ignored:
 *    reacting to it would scroll against the previous selection, and Enter would otherwise raise a second request.
 *    SVG controls have no native activation, so their Enter/Space keydown is the activation.
 */
export function getAnswerScrollSource(input: {
  event: 'click' | 'keydown';
  controlTag: string | null;
  isRoleButton: boolean;
  /** An SVG country label that really activates its country (marked data-atlas-country-label); other SVG text is inert. */
  isCountryLabel: boolean;
  insideMapStrip: boolean;
  insideChipGroup: boolean;
}): 'chip' | 'map' | null {
  const tag = input.controlTag?.toLowerCase() ?? null;
  if (!tag) return null;
  const isNativeButton = tag === 'button';
  const isMapControl = input.isRoleButton || (tag === 'text' && input.isCountryLabel);
  if (!isNativeButton && !isMapControl) return null;
  if (input.event === 'keydown' && isNativeButton) return null;
  if (input.insideMapStrip) return 'map';
  if (input.insideChipGroup) return 'chip';
  return null;
}
