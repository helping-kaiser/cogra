// WHERE THE JOIN FORM WAS REACHED FROM decides its back arrow (Join.md:13-15,
// JoinErrors.md): a link pasted at the invite door goes back to that door; a
// link held from the arrival goes back to the borrowed view it was opened
// from. The door says so on the URL it opens (`?from=door`), so a reload and
// a round trip through About keep it; any other way in is the arrival.

import { extractInviteId } from "./invite-input";

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

/**
 * SignIn's address when it opens from the form standing over the signed-in
 * state (SignIn.md:7): it names the form's link, as About's does, so SignIn's
 * arrow brings that layer back (SignIn.md:9).
 */
export function signInOverJoinHref(id: string, origin: JoinOrigin): string {
  return `/login?from=join&invite=${id}${origin === "door" ? "&door=1" : ""}`;
}

/**
 * The join layer a sign-in's address names — the form's own address — or
 * null when the sign-in opened any other way. Only an id that reads as one is
 * used, so a crafted value never becomes a link target.
 */
export function joinLayerOf(params: { from: string | null; invite: string | null; door: string | null }): string | null {
  if (params.from !== "join") return null;
  const id = extractInviteId(params.invite ?? "");
  return id === null ? null : joinHref(id, params.door === "1" ? "door" : "arrival");
}
