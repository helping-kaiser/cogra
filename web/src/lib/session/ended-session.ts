// WHY THE SIGN-IN OPENED (SignInExpired.md): a session that ended while the
// reader was using the app — a call answered REFRESH_TOKEN_INVALID, so the
// refresher cleared the tokens — opens the sign-in with "You've been signed
// out." under the heading. A plain visit to the sign-in says nothing of the
// kind, so the sign-in needs to know which one it is.
//
// The invalidation marks this tab's `sessionStorage` and the sign-in takes
// the mark once: the sentence says why this screen opened, so it never
// stands on a later visit. Storage that throws — a private window, blocked
// site data — holds no mark, and the sign-in opens as SignIn.

const KEY = "cogra.sessionEnded";

/** Marks that this tab's session just ended without the reader asking. */
export function markSessionEnded(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // no mark; the sign-in opens plain
  }
}

/** Whether a session ended since the last look — the mark is dropped as it is read. */
export function takeSessionEnded(): boolean {
  try {
    const ended = window.sessionStorage.getItem(KEY) !== null;
    window.sessionStorage.removeItem(KEY);
    return ended;
  } catch {
    return false;
  }
}
