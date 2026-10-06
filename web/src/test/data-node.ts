// Test-id matchers for the registered design nodes (`src/lib/ui/data-node.ts`).
//
// A registered element's `data-testid` is its dot-path, shared by every
// instance on screen, and its instance is told apart by `data-testid-key`. So
// a pin names both: Testing Library's `*ByTestId` queries take a function
// matcher (`(content, element) => boolean`), which is how one is built here
// rather than a hand-rolled `querySelector` — the `getBy`/`findBy`/`queryBy`
// semantics, and their errors, stay Testing Library's own.

import type { MatcherFunction } from "@testing-library/react";

/** The element a registered node names: its path and, for an instance, its key. */
export function byNode(path: string, key?: string): MatcherFunction {
  return (content, element) =>
    content === path && (key === undefined || element?.getAttribute("data-testid-key") === key);
}

/**
 * Any one of several ids — for a control whose id depends on the SCREEN it is
 * on rather than on what it is: the wizard's forward control is `wizard-next`
 * on the stages whose boards are not registered and `composeDetails.next` on
 * the one that is, and a test driving the whole flow presses it on each.
 */
export function byAnyTestId(...ids: readonly string[]): MatcherFunction {
  return (content) => ids.includes(content);
}
