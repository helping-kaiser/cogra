/* YOU CAN'T SIGN RIGHT NOW (the failure pack, jakob 2026-09-30) — the
   restoration surface for the write rule's refusal (`WRITE_RULE_FAILED`), and
   the V1.0 home of the pool-exhaustion fact. The seal's master for it, the way
   `ComposeKeyAbsent` is for the missing key: the post's seal draws it, and
   every other signing surface — the reply, the edits, the profile and
   picture seals — reaches this board.

   A NOTICE, NOT A FAULT. The contract calls the refusal a normal account
   state, never an auth fault, and the pre-check stages nothing and spends
   nothing. The missing key is exactly this shape of fact, so this is drawn
   the way `ComposeKeyAbsent` is: everything the signature would commit still
   read back, and the one act the surface cannot perform — here, the commit —
   replaced by `NoticePanel` in `tertiary-container`. Never `error`.

   THE FACT, PAYER-NEUTRAL. What the reader needs is why signing stopped and
   what was kept: each signing is paid for, there is only so much to go around
   at a time, nothing was signed or spent, and the draft is kept. The words
   name no payer, per the scope cut's rule — neither the member nor a pool —
   and they hold for a member past the per-member caps and for a pool that has
   run dry alike, the two ways V1.0 meets this refusal.

   THE WORDS ARE THE SOLVENCY READING (jakob 2026-10-01, backlog item 117).
   One code carries both of the rule's gates — solvency, and the stamp wall a
   member below it meets — and the drawn words fit only the first. Until the
   contract can tell the surface which gate refused (the design ⇄ impl seam),
   they stand as drawn for every refusal of this code.

   NO RETRY. Asking again at once meets the same answer, and a control that
   fails the same way twice is not a way out (`RefusedFile`'s rule). The way
   out is `ComposeKeyAbsent`'s, turned to this fact: keep the draft, sign
   later. The draft is offered back the next time they compose
   (`ComposeDraft`).

   TWO "?"s, BY THE STOPPER EXCEPTION (jakob 2026-10-01: "the '?' at the top
   right is the general one for the seal and not for this specific problem").
   The header's explains signing; the panel's, in `HelpDot`'s `inverse`,
   opens `Why signing waits` — in the words jakob blessed on 2026-10-01: a
   limit on how many signed actions go through in a short time, there to keep
   the network safe from flooding, reached for now; nothing signed or spent,
   the draft kept, and a try again in a little while. A notice that stops the
   one act its surface exists for may carry its own "?" (readme §13, the copy
   rule), so no later pass folds it into the header's.

   AT REPLY SCALE THE FACT AND THE WAY OUT SAY WHAT IS TRUE THERE (jakob
   2026-10-01: conditional). A reply keeps no draft and cannot wait as pending
   (readme §13, *The reply pack*), so `Keep the draft, sign later` would be
   false there. Reached from a reply's seal, the fact ends `your reply is
   still here`, the "?" says the same, and the way out reads `Not now` — the
   word the pad's and the reply door's notices already use — returning to the
   reply's seal with the words still in its composer. Both conditionals ride
   this board, the post's seal drawn, the reply's said. */
export function Screen() {
  return <ComposeSealBody state="writeRule" />;
}
