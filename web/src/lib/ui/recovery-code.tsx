"use client";

// A recovery code shown for keeping, and the gate in front of dismissing
// it (auth.md "Key recovery"). The code is displayed exactly once and
// never persisted, so "I've written it down" is earned rather than
// clicked: the reader types the code back, or pastes the one they
// copied. Nothing checked that anything left the screen otherwise, and
// this browser wiped its seed at upload — a missed code here is an
// unrecoverable actor.
//
// Monospace is design.md §3's one exception to Figtree: this is read
// character by character, where `0/O` and `l/1` have to separate and a
// mistyped code is unrecoverable. `tracking-wider` is the same
// legibility device, not styling. title-large carries it — the largest
// role that still sits inside a card, so a code being copied by hand is
// the biggest thing on the surface.
//
// It draws no box of its own: it belongs inside a Card, and a bordered
// box on a filled card is a second surface saying the same thing twice.

// THE MISMATCH IS A DIVERGED PREFIX, not a submit-time verdict: it fires
// the moment the typed text no longer shares a prefix with the code,
// read the way `recoveryCodeTypedBack`'s full-match compare reads —
// under the recovery code's own normalization
// (`RecoveryCode.normalize`). An empty field says nothing and a correct
// partial says nothing, because both are still on their way to being
// right; a diverged prefix can never become the code, so it says so at
// once. The confirm button stays earned throughout: it enables only on
// an exact match, never on a diverged prefix that a submit could excuse.

import { useState } from "react";

import { RecoveryCode as RecoveryCodeCodec } from "@/lib/crypto/key-backup";
import { recoveryCodeTypedBack } from "@/lib/identity/recovery-code-confirmation";
import { Button } from "@/lib/ui/button";
import { TextField } from "@/lib/ui/text-field";

const MISMATCH = "That doesn't match the code above.";

export function RecoveryCode({
  code,
  explainer,
  testId,
  onConfirmed,
}: {
  code: string;
  explainer: string;
  testId: string;
  onConfirmed: () => void;
}) {
  const [typedBack, setTypedBack] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  const typed = RecoveryCodeCodec.normalize(typedBack);
  const target = RecoveryCodeCodec.normalize(code);
  const diverged = typed.length > 0 && !target.startsWith(typed);
  const matches = recoveryCodeTypedBack(code, typedBack);

  const onCopy = async () => {
    // writeText rejects on denied permission or a non-secure context —
    // silence would leave the Copy button looking dead, and the reader
    // still has to get the code off this screen somehow.
    try {
      await navigator.clipboard.writeText(code);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <>
      <p data-testid={testId} className="text-center font-mono text-title-large tracking-wider">
        {code}
      </p>
      <p className="text-body-medium text-on-surface-variant">{explainer}</p>
      <Button testId={`${testId}_copy`} variant="text" size="sm" selfStart onClick={onCopy}>
        Copy
      </Button>
      {copyFailed ? (
        <p data-testid={`${testId}_copy_failed`} role="status" className="text-body-medium">
          This browser would not let the page copy. Select the code and copy it yourself.
        </p>
      ) : null}
      <TextField
        label="Type or paste the code to confirm"
        value={typedBack}
        onChange={setTypedBack}
        testId={`${testId}_typed_back`}
        autoComplete="off"
        error={diverged ? MISMATCH : undefined}
        mono
      />
      <Button
        testId={`${testId}_saved`}
        size="sm"
        selfStart
        disabled={!matches}
        onClick={onConfirmed}
      >
        I&apos;ve written it down
      </Button>
    </>
  );
}
