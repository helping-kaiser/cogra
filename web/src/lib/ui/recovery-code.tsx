// A recovery code shown for transcription — the key ceremony and settings both
// display one, so it lives here rather than as a pasted class string (§6).
//
// Monospace is design.md §3's one exception to Figtree: this is read character
// by character, where `0/O` and `l/1` have to separate and a mistyped code is
// unrecoverable. `tracking-wider` is the same legibility device, not styling.
// title-large carries it — the largest role that still sits inside a card, so a
// code being copied by hand is the biggest thing on the surface.
//
// It draws no box of its own: it belongs inside a Card, and a bordered box on a
// filled card is a second surface saying the same thing twice.

export function RecoveryCode({ code, testId }: { code: string; testId: string }) {
  return (
    <p data-testid={testId} className="text-center font-mono text-title-large tracking-wider">
      {code}
    </p>
  );
}
