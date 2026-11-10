// WHERE THE JOIN FORM WAS REACHED FROM decides its back arrow (Join.md:13-15,
// JoinErrors.md): a link pasted at the invite door goes back to that door; a
// link held from the arrival goes back to the borrowed view it was opened
// from. The door says so on the URL it opens (`?from=door`), so a reload and
// a round trip through About keep it; any other way in is the arrival.

export type JoinOrigin = "door" | "arrival";

/** The origin a `from` search parameter names. */
export function joinOriginOf(from: string | null): JoinOrigin {
  return from === "door" ? "door" : "arrival";
}

/** The form's address for `id`, carrying the door when the door opened it. */
export function joinHref(id: string, origin: JoinOrigin): string {
  return origin === "door" ? `/join/${id}?from=door` : `/join/${id}`;
}

/** Where the form's back arrow leads: the invite door, or the borrowed view. */
export function joinBackHref(origin: JoinOrigin): string {
  return origin === "door" ? "/join" : "/feed";
}
