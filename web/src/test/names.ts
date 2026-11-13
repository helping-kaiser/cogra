// Assertions for the long-name law at a site (NamesLong.md; the helpers in
// `lib/ui/names.tsx`). jsdom lays nothing out: these pin that a place hands
// its words to the right helper; the conformance harness measures the boxes.

import { expect } from "vitest";

/** The board's longest legal handle (`NamesLong.jsx`: `@` + 30). */
export const LONG_HANDLE = "maximiliana_featherstone_haugh";

const classes = (element: Element) => element.className.toString().split(/\s+/);

/**
 * Wrapping text (NamesLong.md:11-17): the box is never ellipsized as a whole,
 * other tokens may break, and every `@handle` in it is one unit — whole on a
 * line, end-cut past one — with its trailing punctuation beside it.
 */
export function expectWrapsWithUnits(box: HTMLElement, handles: readonly string[], tail?: string) {
  expect(classes(box)).not.toEqual(
    expect.arrayContaining([expect.stringMatching(/^(truncate|line-clamp-\d|whitespace-nowrap)$/)]),
  );
  expect(classes(box)).toContain("[overflow-wrap:anywhere]");
  const units = [...box.querySelectorAll("[data-name-unit]")] as HTMLElement[];
  expect(units.map((unit) => unit.firstElementChild?.textContent)).toEqual(handles);
  for (const unit of units) {
    expect(classes(unit)).toEqual(expect.arrayContaining(["inline-flex", "max-w-full", "whitespace-nowrap"]));
    expect(classes(unit.firstElementChild as Element)).toEqual(
      expect.arrayContaining(["min-w-0", "overflow-hidden", "text-ellipsis"]),
    );
  }
  if (tail !== undefined) expect(units[0].children[1]?.textContent).toBe(tail);
}

/**
 * A one-line place whose words follow the handle (NamesLong.md:5-7): the line
 * is split, the handle the one part that yields, the words never shrinking.
 */
export function expectLineYieldsHandle(box: HTMLElement, handle: string, after: string) {
  const line = box.querySelector("[data-name-line]") as HTMLElement | null;
  expect(line).not.toBeNull();
  const parts = [...(line as HTMLElement).children] as HTMLElement[];
  const yielding = parts.find((part) => part.textContent === handle);
  expect(yielding).toBeDefined();
  expect(classes(yielding as HTMLElement)).toEqual(
    expect.arrayContaining(["min-w-0", "overflow-hidden", "text-ellipsis", "whitespace-nowrap"]),
  );
  const words = parts[parts.length - 1];
  expect(words.textContent).toBe(after);
  expect(classes(words)).toContain("flex-none");
}
