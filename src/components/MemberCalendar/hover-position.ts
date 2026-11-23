/**
 * Where to put the month/week hover card (PRD 009, R3.3): beside the event,
 * never on top of it, and kept inside the viewport.
 */

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  top: number;
  left: number;
  side: "right" | "left" | "below" | "above";
}

const GAP = 8;
const MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/**
 * Prefers the right of the event, then the left, then below, then above.
 * The vertical (or horizontal) position is clamped so the card stays on screen.
 */
export function placeHoverCard(
  anchor: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const fitsRight = anchor.left + anchor.width + GAP + card.width + MARGIN <= viewport.width;
  const fitsLeft = anchor.left - GAP - card.width - MARGIN >= 0;
  const alignedTop = clamp(anchor.top, MARGIN, viewport.height - card.height - MARGIN);

  if (fitsRight) {
    return { side: "right", top: alignedTop, left: anchor.left + anchor.width + GAP };
  }
  if (fitsLeft) {
    return { side: "left", top: alignedTop, left: anchor.left - GAP - card.width };
  }

  const alignedLeft = clamp(anchor.left, MARGIN, viewport.width - card.width - MARGIN);
  const below = anchor.top + anchor.height + GAP;
  if (below + card.height + MARGIN <= viewport.height) {
    return { side: "below", top: below, left: alignedLeft };
  }
  return {
    side: "above",
    top: Math.max(MARGIN, anchor.top - GAP - card.height),
    left: alignedLeft,
  };
}
