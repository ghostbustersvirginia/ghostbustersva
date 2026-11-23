import { describe, expect, it } from "vitest";
import { placeHoverCard, type Box } from "../src/components/MemberCalendar/hover-position";

const viewport = { width: 1200, height: 800 };
const card = { width: 288, height: 300 };

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

describe("placeHoverCard (PRD 009, R3.3)", () => {
  it("goes to the right of the event when there's room", () => {
    const anchor = { top: 200, left: 100, width: 150, height: 24 };
    expect(placeHoverCard(anchor, card, viewport)).toEqual({ side: "right", top: 200, left: 258 });
  });

  it("goes to the left near the right edge", () => {
    const anchor = { top: 200, left: 1000, width: 150, height: 24 };
    const p = placeHoverCard(anchor, card, viewport);
    expect(p.side).toBe("left");
    expect(p.left + card.width).toBeLessThanOrEqual(anchor.left);
  });

  it("keeps the card on screen vertically", () => {
    const anchor = { top: 760, left: 100, width: 150, height: 24 };
    const p = placeHoverCard(anchor, card, viewport);
    expect(p.top + card.height).toBeLessThanOrEqual(viewport.height - 8);
  });

  it("falls back to below or above on narrow screens", () => {
    const phone = { width: 390, height: 800 };
    const below = placeHoverCard({ top: 100, left: 20, width: 350, height: 24 }, card, phone);
    expect(below.side).toBe("below");
    const above = placeHoverCard({ top: 700, left: 20, width: 350, height: 24 }, card, phone);
    expect(above.side).toBe("above");
  });

  it.each([
    { top: 10, left: 10, width: 140, height: 20 },
    { top: 400, left: 600, width: 140, height: 60 },
    { top: 780, left: 1050, width: 140, height: 20 },
    { top: 300, left: 5, width: 380, height: 40 },
  ])("never covers the event (%o)", (anchor) => {
    for (const vp of [viewport, { width: 390, height: 800 }]) {
      const a = { ...anchor, width: Math.min(anchor.width, vp.width - anchor.left) };
      const p = placeHoverCard(a, card, vp);
      expect(overlaps(a, { top: p.top, left: p.left, ...card })).toBe(false);
    }
  });
});
