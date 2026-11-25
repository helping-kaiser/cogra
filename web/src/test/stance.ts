// MSW handlers for the standing every stance control reads at rest
// (design.md §8.3, "at rest the target shows the standing").
//
// A surface test that leaves these out does not merely skip an
// assertion: the read goes unhandled, the control degrades to its
// "no stance yet" affordance, and the test still passes while the
// standing never renders. That is the hole these close.
//
// `viewerStance` hangs off four concrete types under four different
// roots, so the shape is built once here rather than four times in
// every surface test. A topic's identity is its canonical name rather
// than a UUID (hashtag.md §1), so that one root is keyed on `name`.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";
import type { RequestHandler } from "msw";

/** A seeded standing: where the fold nets, and how many records it folds. */
export type SeededStance = {
  readonly pDirected: number;
  readonly pInterest: number;
  readonly recordCount?: number;
  /**
   * The raw sums behind the fold (design.md §8.3). They default to the
   * folded pair, which is the ordinary case of a bundle inside the clip;
   * a fixture pinning "clipped is not hidden" sets them beyond `±1`.
   */
  readonly rawPDirected?: number;
  readonly rawPInterest?: number;
};

/**
 * A target the viewer has never stanced: a real bundle folding no
 * records. Null is a different answer — it says there is no viewer at
 * all — and reserving it for that is what lets a test tell the two apart.
 */
const NEVER_STANCED: SeededStance = { pDirected: 0, pInterest: 0, recordCount: 0 };

/** The `viewerStance` payload for a standing. */
export function stanceBundle(stance: SeededStance) {
  const recordCount = stance.recordCount ?? 1;
  return {
    __typename: "StanceBundle",
    pDirected: stance.pDirected,
    pInterest: stance.pInterest,
    rawPDirected: stance.rawPDirected ?? stance.pDirected,
    rawPInterest: stance.rawPInterest ?? stance.pInterest,
    recordCount,
    inert: stance.pDirected === 0 || stance.pInterest === 0,
    severed: stance.pDirected === 0 && stance.pInterest === 0,
    severanceCost: recordCount,
    projected: null,
  };
}

function root(
  operation: string,
  field: string,
  typename: string,
  seeded: Record<string, SeededStance>,
  /** Which variable names the target — `name` for the topic root. */
  key: "id" | "name" = "id",
) {
  return gqlLink.query(operation, ({ variables }) => {
    const id = String(variables[key]);
    return HttpResponse.json({
      data: {
        [field]: {
          __typename: typename,
          id,
          viewerStance: stanceBundle(seeded[id] ?? NEVER_STANCED),
        },
      },
    });
  });
}

/**
 * The page read (`PageStances`): every id answered in its slot, in order.
 * The seam reads a slot by its id alone — the id names the node — so the
 * slot's kind is not something a surface test has to seed; it answers as a
 * post.
 */
function pageRoot(seeded: Record<string, SeededStance>) {
  return gqlLink.query("PageStances", ({ variables }) => {
    const ids = (variables.ids as readonly unknown[]).map(String);
    return HttpResponse.json({
      data: {
        nodes: ids.map((id) => ({
          __typename: "Post",
          id,
          viewerStance: stanceBundle(seeded[id] ?? NEVER_STANCED),
        })),
      },
    });
  });
}

/**
 * Handlers for all four roots and the page read, keyed by target id — a
 * topic's being its canonical name, the same key the seam hands the
 * control. An id with nothing seeded answers as a target this viewer has
 * never stanced, so the control shows the affordance — the ordinary case,
 * not a refusal.
 */
export function stanceHandlers(seeded: Record<string, SeededStance> = {}): RequestHandler[] {
  return [
    root("PostStance", "post", "Post", seeded),
    root("CommentStance", "comment", "Comment", seeded),
    root("ProfileStance", "user", "User", seeded),
    root("HashtagStance", "hashtag", "Hashtag", seeded, "name"),
    pageRoot(seeded),
  ];
}

/** A seeded borrowed stance: the view's own landed bundle, as a guest reads it. */
export type SeededBorrowed = {
  readonly pDirected: number;
  readonly pInterest: number;
  readonly recordCount?: number;
  readonly severed?: boolean;
};

function borrowedRoot(
  operation: string,
  field: string,
  typename: string,
  seeded: Record<string, SeededBorrowed>,
  key: "id" | "name" = "id",
) {
  return gqlLink.query(operation, ({ variables }) => {
    const id = String(variables[key]);
    const held = seeded[id];
    return HttpResponse.json({
      data: {
        [field]: {
          __typename: typename,
          id,
          borrowedStance:
            held === undefined
              ? null
              : {
                  __typename: "BorrowedStance",
                  pDirected: held.pDirected,
                  pInterest: held.pInterest,
                  recordCount: held.recordCount ?? 1,
                  inert: held.pDirected === 0 || held.pInterest === 0,
                  severed: held.severed ?? false,
                },
        },
      },
    });
  });
}

/**
 * A guest's four borrowed-stance reads (`borrowedStance`), keyed as
 * `stanceHandlers` is. A target with nothing seeded answers null: the
 * borrowed view holds none, the hollow face.
 */
export function borrowedStanceHandlers(seeded: Record<string, SeededBorrowed> = {}): RequestHandler[] {
  return [
    borrowedRoot("PostBorrowedStance", "post", "Post", seeded),
    borrowedRoot("CommentBorrowedStance", "comment", "Comment", seeded),
    borrowedRoot("ProfileBorrowedStance", "user", "User", seeded),
    borrowedRoot("HashtagBorrowedStance", "hashtag", "Hashtag", seeded, "name"),
  ];
}
