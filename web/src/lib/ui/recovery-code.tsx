// A recovery code shown for transcription — the key ceremony and settings both
// display one, so it lives here rather than as a pasted class string (§6).
//
// Monospace is design.md §3's one exception to Figtree: this is read character
// by character, where `0/O` and `l/1` have to separate and a mistyped code is
// unrecoverable. `tracking-wider` is the same legibility device, not styling.
// title-large carries it — the largest role that still sits inside a card, so a
// code being copied by hand is the biggest thing on the surface.

export function RecoveryCode({ code, testId }: { code: string; testId: string }) {
  return (
    <p
      data-testid={testId}
      className="rounded-md border border-outline-variant p-4 text-center font-mono text-title-large tracking-wider"
    >
      {code}
    </p>
  );
}
