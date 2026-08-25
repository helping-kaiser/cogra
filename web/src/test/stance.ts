// MSW handlers for the standing every stance control reads at rest
// (design.md §8.3, "at rest the target shows the standing").
//
// A surface test that leaves these out does not merely skip an
// assertion: the read goes unhandled, the control degrades to its
// "no stance yet" affordance, and the test still passes while the
// standing never renders. That is the hole these close.
//
// `viewerStance` hangs off three concrete types under three different
// roots, so the shape is built once here rather than three times in
// every surface test.

import { graphql, HttpResponse } from "msw";
import type { RequestHandler } from "msw";

/** A seeded standing: where the fold nets, and how many records it folds. */
export type SeededStance = {
  readonly pDirected: number;
  readonly pInterest: number;
  readonly recordCount?: number;
};

function viewerStance(stance: SeededStance | undefined) {
  if (stance === undefined) return null;
  const recordCount = stance.recordCount ?? 1;
  return {
    __typename: "StanceBundle",
    pDirected: stance.pDirected,
    pInterest: stance.pInterest,
    recordCount,
    inert: stance.pDirected === 0 || stance.pInterest === 0,
    severed: stance.pDirected === 0 && stance.pInterest === 0,
    severanceCost: recordCount,
    projected: null,
  };
}

function root(operation: string, field: string, typename: string, seeded: Record<string, SeededStance>) {
  return graphql.query(operation, ({ variables }) => {
    const id = String(variables.id);
    return HttpResponse.json({
      data: { [field]: { __typename: typename, id, viewerStance: viewerStance(seeded[id]) } },
    });
  });
}

/**
 * Handlers for all three roots, keyed by target id. An id with nothing
 * seeded answers with no bundle at all, which is the unauthenticated
 * shape — the control degrades to the affordance, as it should.
 */
export function stanceHandlers(seeded: Record<string, SeededStance> = {}): RequestHandler[] {
  return [
    root("PostStance", "post", "Post", seeded),
    root("CommentStance", "comment", "Comment", seeded),
    root("ProfileStance", "user", "User", seeded),
  ];
}
