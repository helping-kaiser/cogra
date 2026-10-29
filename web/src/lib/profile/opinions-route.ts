// WHERE THE OPINIONS PAGE LIVES (ProfileStances.md; graph.json `ProfileStances`).
// The figures row opens it under the profile it counts — `/profile/opinions`
// under the reader's own root, `/u/<handle>/opinions` under anyone's drill-in —
// and the direction it stands on rides the URL (`?tab=by`), so a way back to
// it (`Back to the opinions`) returns to the tab it was left on.
//
// THE PAGE AS AN ORIGIN. A row opens that person's profile with a `from` that
// names the page (`back-origin.ts`): `opinions` · `opinions.by` for the
// reader's own, `opinions:<handle>` · `opinions.by:<handle>` for anyone's. The
// grammar is closed and parsed here, so the profile's arrow and the shell's
// lit slot read the one table.

/** The page's two directions (`ProfileStances`: `On them` · `By them`). */
export type OpinionDirection = "on" | "by";

/** The direction a `tab` search parameter names; anything else is the page's first tab. */
export function directionOf(tab: string | null | undefined): OpinionDirection {
  return tab === "by" ? "by" : "on";
}

/**
 * The opinions page's address: under the reader's own root (`handle` null) or
 * under a person's drill-in, standing on `direction`, and carrying the
 * profile's own `from` so the page lights the root the profile did and its
 * arrow returns to the profile as it was opened.
 */
export function opinionsHref(
  handle: string | null,
  direction: OpinionDirection = "on",
  from: string | null = null,
): string {
  const path = handle === null ? "/profile/opinions" : `/u/${encodeURIComponent(handle)}/opinions`;
  const query = new URLSearchParams();
  if (direction === "by") query.set("tab", "by");
  if (from !== null && handle !== null) query.set("from", from);
  const search = query.toString();
  return search === "" ? path : `${path}?${search}`;
}

/** The `from` a row on the page carries to the profile it opens. */
export function opinionsOrigin(handle: string | null, direction: OpinionDirection): string {
  const page = direction === "by" ? "opinions.by" : "opinions";
  return handle === null ? page : `${page}:${handle}`;
}

const ORIGIN = /^opinions(\.by)?(?::(.+))?$/;

/** The page a `from` names, or null where it names none. */
export function parseOpinionsOrigin(
  from: string | null | undefined,
): { readonly handle: string | null; readonly direction: OpinionDirection } | null {
  if (from === null || from === undefined) return null;
  const match = ORIGIN.exec(from);
  if (match === null) return null;
  return { handle: match[2] ?? null, direction: match[1] === undefined ? "on" : "by" };
}
