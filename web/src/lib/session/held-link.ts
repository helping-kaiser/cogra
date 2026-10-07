// THE LINK A SIGN-IN HOLDS (ChangeEmailLinkedSignedOut.md: "the sign-in screen
// opens holding the link", and once signed in "the link's side applies AND
// the change's signed-in landing follows").
//
// The token is a secret, so it never rides a second URL: the signed-out
// landing parks it in this tab's `sessionStorage` (gone when the tab closes)
// and the landing takes it back after the sign-in redirect. Storage that
// throws — a private window, blocked site data — holds nothing, and the
// reader opens the link again.

const KEY = "cogra.heldEmailChangeLink";

/** Parks a new-address link's token for the sign-in it is about to wait on. */
export function holdEmailChangeLink(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    // nothing held; the link opens again
  }
}

/** The parked token, if any — left in place until the landing answers it. */
export function heldEmailChangeLink(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Drops the parked token once its landing has answered. */
export function releaseEmailChangeLink(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to drop
  }
}

/** Where a fresh sign-in goes: back to a held link's landing, else home. */
export function afterSignIn(): string {
  return heldEmailChangeLink() === null ? "/" : "/email-change";
}
