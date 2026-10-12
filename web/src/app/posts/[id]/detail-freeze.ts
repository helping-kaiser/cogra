// THE DETAIL HOLDS WHAT WAS OPENED (jakob 2026-10-09, seam 120; drawn
// 2026-10-12, PostDetail.md:5-15). The post a reader opened is the post they
// read: a fresh read that finds it changed never lands under them mid-sentence.
// It waits behind one line — `Edited since you opened it — tap for the newest
// version.` — and the reader's tap is what swaps it in.
//
// This is the whole of that rule, kept apart from the page so every way a read
// can land is one case of one function. The page owns the read; this owns what
// the read's answer does to what is on screen. It sits in the VIEW, not in the
// fetch policy (`fetchPostDetail` stays network-only): the read is always
// fresh, and holding it back is a reading decision, not a caching one.
//
// HOW AN ANSWER LANDS — the painted post P, a fresh answer F:
//
// - NOTHING IS PAINTED (a deep link, a cold start, a retry from the
//   nothing-loaded page): F paints. There is no opened version to hold.
// - THE READER ASKED (the pull-down): F lands. The pull is the reader asking
//   for the newest, which is exactly what the hold waits on
//   (PostDetail.md:5 "until the reader asks for the newest").
// - F SHOWS A REDACTION P DOES NOT: F lands at once, whatever else it changed
//   (PostDetail.md:15; seam 120.2 — "never erase silently" cuts both ways, and
//   a removed payload must not keep showing from a snapshot).
// - F IS ANOTHER VERSION — its `updatedAt` differs, or its tag set or citation
//   set does (PostDetail.md:7, :9; FC-G1(b), no taxonomy): P stays, F waits.
// - OTHERWISE F IS THE SAME VERSION and is taken silently: it IS what was
//   opened, read again, and what differs is the live count around it — the
//   thread's size, where the post stands on L1 — never the post itself.

/** A string-valued status, as every moderated field and attachment wears one. */
const REDACTED = "REDACTED";

/** What the rule reads of a post: the version stamp and the two claim sets. */
export type Versioned = {
  readonly updatedAt: unknown;
  readonly topics: readonly { readonly hashtag: { readonly id: string } }[];
  readonly references: readonly { readonly targetId: string }[];
};

/** What the page holds: the post on screen, and a newer one the line offers. */
export type Freeze<P> = {
  readonly post: P | null;
  readonly newer: P | null;
};

export type FreezeAction<P> =
  /** A read answered with the post. `asked`: the reader's own pull. */
  | { readonly kind: "read"; readonly fresh: P; readonly asked: boolean }
  /** The reader tapped the line. */
  | { readonly kind: "swap" };

/** How one answer lands — the case names the tests pin. */
export type Landing = "paint" | "asked" | "redaction" | "hold" | "same";

export function landingOf<P extends Versioned>(painted: P | null, fresh: P, asked: boolean): Landing {
  if (painted === null) return "paint";
  if (asked) return "asked";
  if (newlyRedacted(painted, fresh)) return "redaction";
  if (isNewerVersion(painted, fresh)) return "hold";
  return "same";
}

export function freezeReducer<P extends Versioned>(
  state: Freeze<P>,
  action: FreezeAction<P>,
): Freeze<P> {
  if (action.kind === "swap") {
    return state.newer === null ? state : { post: state.newer, newer: null };
  }
  const landing = landingOf(state.post, action.fresh, action.asked);
  // Only another version waits; every other landing IS the newest, so nothing
  // older is left to offer and the line goes.
  return landing === "hold"
    ? { post: state.post, newer: action.fresh }
    : { post: action.fresh, newer: null };
}

/**
 * Whether the fresh read is a version the painted one is not: a new edit
 * (`updatedAt`, the current version row's own stamp), or a changed tag set or
 * citation set. Tags and citations are acts of their own on L1 rather than
 * edits of the post, "but the inspection must say so" (jakob, FC-G1(b)) — so
 * they count the same way, by which claims stand, not by how they weigh.
 */
export function isNewerVersion(painted: Versioned, fresh: Versioned): boolean {
  return (
    painted.updatedAt !== fresh.updatedAt ||
    !sameSet(
      painted.topics.map((topic) => topic.hashtag.id),
      fresh.topics.map((topic) => topic.hashtag.id),
    ) ||
    !sameSet(
      painted.references.map((reference) => reference.targetId),
      fresh.references.map((reference) => reference.targetId),
    )
  );
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}

/**
 * Whether the fresh read shows a part of the post removed that the painted one
 * still shows — "the post or any of its parts" (PostDetail.md:15): a field, the
 * gallery, one of its attachments or covers, a tag's name. A redaction the
 * painted post already shows is not news: it is on screen, and the line can
 * still hold whatever else changed.
 *
 * THE THREAD IS NOT A PART OF THE POST. The detail read carries a page of
 * comments, but the thread is the comments sheet's own read and its own
 * redactions are the sheet's to show — so `comments` is never walked.
 */
export function newlyRedacted(painted: unknown, fresh: unknown): boolean {
  const shown = redactedParts(painted);
  for (const part of redactedParts(fresh)) if (!shown.has(part)) return true;
  return false;
}

function redactedParts(node: unknown, path = "", out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((item, at) => redactedParts(item, `${path}[${identity(item) ?? at}]`, out));
    return out;
  }
  if (node === null || typeof node !== "object") return out;
  for (const [key, value] of Object.entries(node)) {
    if (key === "comments") continue;
    // `status` on a field or an attachment; `attachmentsStatus`, the gallery's one state.
    if ((key === "status" || key === "attachmentsStatus") && value === REDACTED) {
      out.add(`${path}.${key}`);
    } else {
      redactedParts(value, `${path}.${key}`, out);
    }
  }
  return out;
}

/** A list entry's own identity, so a reordered list is not a changed one. */
function identity(item: unknown): string | null {
  if (item === null || typeof item !== "object") return null;
  const record = item as { id?: unknown; targetId?: unknown; hashtag?: { id?: unknown } | null };
  if (typeof record.id === "string") return record.id;
  if (typeof record.targetId === "string") return record.targetId;
  if (typeof record.hashtag?.id === "string") return record.hashtag.id;
  return null;
}
