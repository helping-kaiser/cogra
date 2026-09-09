"use client";

// The share control of `design/components/content/ShareButton.jsx`: a glyph,
// no count, no state, no menu — the handoff itself.
//
// IT IS LAST IN THE ROW, and that is a rule rather than a layout: the row's
// order — stance, score, comment, share — is its order of importance and also
// its fold queue, so share is the first thing to move into the ⋮ on a phone
// too narrow to hold all of them.
//
// IT CARRIES NO NUMBER, because a share count would be a public tally of
// something the graph does not record.
//
// CAPABILITY IS CHECKED AFTER MOUNT, not during render: `navigator` is a client
// fact, and reading it while rendering would make the server's HTML disagree
// with the browser's first paint. Where neither door exists the control is
// absent rather than dead (see `share.ts`).

import { useSyncExternalStore } from "react";

import { Icon } from "./icons";
import { canShare, shareLink } from "./share";

// The documented way to read a browser fact the server cannot know: a store
// with a server snapshot, rather than an effect that sets state (React,
// "useSyncExternalStore — subscribing to a browser API"). What this browser can
// do never changes while the page is open, so there is nothing to subscribe to.
const NEVER_CHANGES = () => () => {};
const NOT_ON_THE_SERVER = () => false;

export function ShareButton({
  href,
  targetLabel = "this post",
  title,
  onCopied,
  testId,
}: {
  /** The post's own route; resolved against the current origin at the tap. */
  href: string;
  /** Completes the accessible name — `Share this post` (copy-voice.md). */
  targetLabel?: string;
  /** What the OS sheet titles the share, where there is an OS sheet. */
  title?: string;
  /** Says `Link copied`. Required: a copy nobody is told about is a silent act. */
  onCopied: () => void;
  testId?: string;
}) {
  const capable = useSyncExternalStore(NEVER_CHANGES, canShare, NOT_ON_THE_SERVER);
  if (!capable) return null;

  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={`Share ${targetLabel}`}
      onClick={() => {
        void shareLink(new URL(href, window.location.href).toString(), title).then((outcome) => {
          if (outcome === "copied") onCopied();
        });
      }}
      className="cg-state cg-focus cg-hit flex flex-none items-center rounded-full px-2 py-1.5 text-on-surface-variant"
    >
      <Icon name="share" size={18} />
    </button>
  );
}
