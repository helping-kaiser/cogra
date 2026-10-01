/* THE PAD, WHEN THE WRITE RULE SAYS NOT NOW (jakob 2026-10-01, closing the
   pad's vehicle backlog item 117 owed) — the pattern board for the write
   rule's refusal on every pad's Set, the way `PadFailed` is for a signing
   that did not go through and `PadKeyAbsent` for a missing key.

   A NOTICE, NOT A FAULT. The pre-check staged nothing and spent nothing, so
   nothing failed: the refusal takes `PadKeyAbsent`'s shape, not
   `PadFailed`'s. The pad stays open at the pick — the field and the standing
   line exactly where they were — and the notice stands where the landing line
   and the commit row would: `NoticePanel` in `tertiary-container`, never
   `error`, drawn by `StanceControl`'s own `signing="writeRule"` rather than
   by hand, so the pad above the notice is the real pad.

   THE WORDS ARE THE SEAL'S, AT THE PAD'S SCALE. `You can't sign right now`
   over the write rule's fact in the frame jakob blessed — each signing is
   paid for, and there's only so much to go around at a time — which serves
   the pool running dry and a per-member limit alike, and names no payer. The
   seal's "your draft is kept" drops: a pad has no draft.

   ITS OWN "?", BY THE STOPPER EXCEPTION (jakob 2026-10-01, ruled again in
   review: the pad's notice carries it). The pad's own "?" in the corner
   explains opinions; the panel's opens `Why signing waits`, the seal panel's
   dialog, because the stop is the same stop — the limit on signed actions in
   a short time, and that nothing was signed or spent. The dialog's draft
   clause drops here, as the fact's does: its second paragraph reads `Nothing
   was signed or spent. Try again in a little while.` (copy-voice, *The "?"
   dialogs*).

   `NOT NOW` IS THE WAY OUT, and the pick is not kept. `ReplyKeyAbsent`'s word
   for a notice's exit that keeps nothing. A pick kept for the key waits on
   the reader restoring it; nothing here waits on the reader, so a kept pick
   would only be a promise the pad cannot date. No Retry: asking again at
   once meets the same answer (`RefusedFile`'s rule). A press outside, or the
   system's Back, closes the pad as it always does.

   THE FIXTURE IS `PadStanding`'S — @ada, one standing edge at +1.00 / +1.00,
   the pick pulling back to −0.55 / −0.15 — so `PadStanding`, `PadFailed` and
   this board read as one pad in three moments. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard
          {...ADA_POST}
          bundle={mkBundle(1, 1)}
          stanceOpen
          stancePadInset={80}
          stanceDefaultPick={{ pDirected: -0.55, pInterest: -0.15 }}
          stanceSigning="writeRule"
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
