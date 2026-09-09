// Handing a post to the platform, and what the web does where there is no
// platform sheet to hand it to.
//
// ONE ACTION, NEVER A MENU OF OURS (design/components/content/ShareButton.jsx,
// jakob 2026-09-03). The sheet belongs to the OS — a share menu drawn here
// would be a worse copy of it that also knows less.
//
// THE FALLBACK IS RULED, NOT INVENTED (design/readme.md §13, the audit answers
// of 2026-09-09): "Where `navigator.share` is absent the control copies the
// link, and a snackbar says Link copied. One action, never a menu of ours."
//
// PRESENCE IS THE SWITCH, not success. A reader who opens the OS sheet and
// dismisses it has answered; copying the link behind their back would be a
// second action they did not ask for. So an abort — or any refusal from the
// platform sheet — says nothing at all.
//
// Where neither door exists (a non-secure origin has neither `share` nor
// `clipboard`) the control does not render: a glyph that cannot act is a dead
// control, and the card would rather be short one affordance than lie.

/** The snackbar's line, verbatim from the ruling. */
export const LINK_COPIED = "Link copied";

export type ShareOutcome = "shared" | "copied" | "unavailable";

type ShareCapableNavigator = {
  share?: (data: { url: string; title?: string }) => Promise<void>;
  clipboard?: { writeText?: (text: string) => Promise<void> };
};

function capabilities(): ShareCapableNavigator | undefined {
  return typeof navigator === "undefined" ? undefined : (navigator as ShareCapableNavigator);
}

/** Whether either door exists in this browser. Client-only — see the note above. */
export function canShare(): boolean {
  const nav = capabilities();
  return typeof nav?.share === "function" || typeof nav?.clipboard?.writeText === "function";
}

/**
 * Hands `url` to the platform, or copies it.
 *
 * Returns what happened, so the caller can say `Link copied` on exactly the
 * branch that copied — the OS sheet speaks for itself.
 */
export async function shareLink(url: string, title?: string): Promise<ShareOutcome> {
  const nav = capabilities();
  if (typeof nav?.share === "function") {
    try {
      await nav.share(title === undefined ? { url } : { url, title });
    } catch {
      // Dismissed, or refused by the platform. The reader has answered.
    }
    return "shared";
  }
  const writeText = nav?.clipboard?.writeText;
  if (typeof writeText === "function") {
    try {
      await writeText.call(nav.clipboard, url);
      return "copied";
    } catch {
      return "unavailable";
    }
  }
  return "unavailable";
}
