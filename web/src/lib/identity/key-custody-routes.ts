// The key ceremonies' two routes and where the refusal's back arrow goes from
// each (KeyCeremonyUnsupported.md:15-23, Restore.md:7-11). A plain module, not
// a client one: the server pages call `ceremonyBackHref` while they render, and
// a function exported from a "use client" module can only be passed to the
// client, never called on the server (Next.js, "use client" directive).

/** The two ceremony routes; every key-ceremony door opens one of them. */
export const KEY_CEREMONY_ROUTE = "/key";
export const RESTORE_ROUTE = "/restore";

/**
 * The settings key rows' door to the ceremony: the `from` tells the refusal
 * where its back arrow goes (KeyCeremonyUnsupported.md:19: "from a key row in
 * settings -> Settings opens").
 */
export const KEY_CEREMONY_FROM_SETTINGS = `${KEY_CEREMONY_ROUTE}?from=settings`;

/** The key's own screen — `YourKey`, `YourKeyGate` or `YourKeyAbsent` by custody. */
export const YOUR_KEY_ROUTE = "/settings/key";

/**
 * THE ONE "HAS A KEY" PREDICATE: the account has made its key once the
 * account names one (`actorPubkey`; null is the pre-attach window). Settings'
 * `Your key` row decides on it — the ceremony before, the key's own screen
 * after — and `/key` opened by a member who has one lands where that row
 * opens (jakob 2026-11-23, seam 405/411).
 */
export function keyMade(account: { readonly actorPubkey?: string | null }): boolean {
  return account.actorPubkey != null;
}

/**
 * The refusal's back arrow on the minting route: Settings when a settings row
 * opened it, else the reader's home — the applicant's feed, where the task
 * card and the key-elsewhere card both stand (KeyCeremonyUnsupported.md:15-17).
 */
export function ceremonyBackHref(from: string | null): string {
  return from === "settings" ? "/settings" : "/";
}

/**
 * The refusal's back arrow in the restore's place: the restore's own home
 * (Restore.md:9-11: a member's `KeyElsewhere`, an applicant's
 * `ApplicantKeyElsewhere`) — the feed at `/` in both cases.
 */
export const RESTORE_BACK_HREF = "/";
