// WHAT THE REGISTRY SAYS ABOUT THE VERSION RUNNING HERE (release-registry
// packet §4.3). The list is this client's component, newest first in the
// registry's own order (`releasedAt`) — never a comparison of version
// strings, which the server and both clients would each read differently.
//
// Behind is the running version found below the head of the list: every
// release above it is newer. A running version the registry does not list —
// a dev build, or a release whose row is not written yet — is NOT behind
// and carries no `installed` (WhatsNew.md:17; design ruling 61): nothing
// false is claimed, and no card is invented for it.

/** One release, as the What's new cards and the announcer read it. */
export type Release = {
  readonly version: string;
  readonly notes: readonly string[];
  readonly patchNotesUrl: string;
  readonly releasedAt: string;
};

/** The word a release's dateline carries: what that version is to this device. */
export type DatelineWord = "installed" | "newest" | null;

export type VersionStatus = {
  /** Whether a release newer than the running one exists. */
  readonly behind: boolean;
  /** The newest release when behind — the one `Update now` names and the snackbar announces. */
  readonly newest: Release | null;
  /** Where the running version sits in the list; -1 when the registry does not list it. */
  readonly installedIndex: number;
};

export function versionStatus(releases: readonly Release[], running: string): VersionStatus {
  const installedIndex = running === "" ? -1 : releases.findIndex((r) => r.version === running);
  const behind = installedIndex > 0;
  return { behind, newest: behind ? releases[0] : null, installedIndex };
}

/**
 * The dateline word of the release at `index`: `installed` on the running
 * version, `newest` on the head of the list only when the running version is
 * behind it, and no word anywhere else — never `current`
 * (WhatsNewBehind.md:7, :13).
 */
export function datelineWord(status: VersionStatus, index: number): DatelineWord {
  if (index === status.installedIndex) return "installed";
  if (index === 0 && status.behind) return "newest";
  return null;
}

/** `dd.mm.yyyy` in the reader's own zone (copy-voice, the release dateline). */
export function releaseDate(releasedAt: string): string {
  const at = new Date(releasedAt);
  const dd = String(at.getDate()).padStart(2, "0");
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${at.getFullYear()}`;
}

/** `Version 0.1.2 · installed · 30.09.2026` — the drawn dateline, whole. */
export function datelineText(release: Release, word: DatelineWord): string {
  const said = word === null ? "" : ` · ${word}`;
  return `Version ${release.version}${said} · ${releaseDate(release.releasedAt)}`;
}

/** A registered node key from a version: `0.1.2` keys `0-1-2` (the `whatsNew` registration). */
export function releaseKey(version: string): string {
  return version.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
