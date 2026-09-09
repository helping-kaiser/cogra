import React from "react";
import { Button } from "../core/Button.jsx";
import { TextField } from "./TextField.jsx";

/* A recovery code shown for keeping, and the gate in front of dismissing it. The
   code is displayed exactly once and never persisted, so "I've written it down" is
   EARNED rather than clicked: the reader types the code back, or pastes the one
   they copied.

   Monospace is design.md §3's one exception to Figtree — read character by
   character, where 0/O and l/1 have to separate and a mistyped code is
   unrecoverable. Wider tracking is the same legibility device, not styling.
   `body-large` carries it, not design.md's `title-large`: a real code is 26
   Crockford characters in 5-5-5-5-6 groups, which cannot hold one line at
   22px inside a card at mobile width — and the one-line grouping is the
   point. The size gives way, the tracking stays (§11, Small fixes).

   It draws NO BOX of its own — it belongs inside a Card, and a bordered box on a
   filled card is a second surface saying the same thing twice.

   THE MISMATCH IS A DIVERGED PREFIX, and the two halves of it are owned apart:
   the surface words the line through `error`, the master decides the moment it
   appears. That moment is the first character the typed text no longer shares
   with the code — read the way `matches` reads, whitespace stripped and folded
   to upper case. An empty field says nothing and a correct partial says
   nothing, because a partial is still on its way to being right; a wrong paste
   or a mistyped character says so at once, because a prefix that has diverged
   can never become the code. The recovery gate is where the readme's
   on-submit timing gives way (§13, the input-error round): the confirm button
   never enables on a diverged prefix, so a signal held until submit is a signal
   that never comes. `error` reaches TextField's own M3 error state through the
   confirm field the master owns; `defaultTypedBack` seeds that field, which is
   how a board draws the diverged state at rest. */

export function RecoveryCode({ code, explainer, onConfirmed, error, defaultTypedBack = "" }) {
  const [typedBack, setTypedBack] = React.useState(defaultTypedBack);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const read = (text) => text.replace(/\s+/g, "").toUpperCase();
  const typed = read(typedBack);
  const target = read(code);
  const matches = typed === target;
  const diverged = typed.length > 0 && !target.startsWith(typed);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <>
      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-large)",
          lineHeight: "var(--text-body-large--line-height)",
          letterSpacing: "0.05em",
        }}
      >
        {code}
      </p>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", color: "var(--text-secondary)" }}>{explainer}</p>
      <Button variant="text" size="sm" selfStart onClick={onCopy}>
        Copy
      </Button>
      {copyFailed && (
        <p role="status" style={{ margin: 0, fontSize: "var(--text-body-medium)" }}>
          This browser would not let the page copy. Select the code and copy it yourself.
        </p>
      )}
      <TextField label="Type or paste the code to confirm" mono value={typedBack} onChange={setTypedBack} error={diverged ? error : undefined} />
      <Button size="sm" selfStart disabled={!matches} onClick={onConfirmed}>
        I&apos;ve written it down
      </Button>
    </>
  );
}
