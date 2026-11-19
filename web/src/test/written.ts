// The person-written-text rule at a site (`lib/ui/written.ts`; jakob's hand
// test 2026-11-19). jsdom lays nothing out: this pins that a place hands its
// words to the rule; the phone-fit sweep's WORDS check measures the boxes.

import { expect } from "vitest";

import { WRITTEN } from "@/lib/ui/written";

/** Multi-line person text: it wears the rule and is never ellipsized as a whole. */
export function expectWrapsLongWords(box: HTMLElement) {
  const classes = box.className.toString().split(/\s+/);
  expect(classes).toContain(WRITTEN);
  expect(classes).not.toEqual(expect.arrayContaining([expect.stringMatching(/^(truncate|text-ellipsis|whitespace-nowrap)$/)]));
}
