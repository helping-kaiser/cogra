/* AN ACT SENT AND CLOSED ON: ITS WAIT AND ITS FAILURE WHERE IT LANDS (jakob
   2026-11-11: "b) sounds best please go for this option first" — Close on
   every signing surface, one drawn pattern for the wait and the failure).
   A reference plate, like `RowSigning`: wired nowhere, the shells' controls
   are `Feed`'s and `ReplySettled`'s.

   ONCE A COMMIT IS PRESSED THE ACT IS DONE, AND CLOSE ONLY LEAVES. The seal,
   the reply's seal and the edits read `Close` from the press; the surface
   goes and the act goes on. So the reader must still be told how it ends,
   and the one place that can say it is where the act lands — never the
   snackbar, which carries confirmations only.

   THE PATTERN, IN TWO PARTS, FROM WHAT THE TREE ALREADY DRAWS:
   · THE WAIT stands where the act will show, in the pending marker's quiet
     register (`RowSigning`'s `Signing…`, `PadFailed`'s `closed`). Signed
     acts wait for their signature, so nothing is drawn as landed before it
     is taken: a post or a reply that has no card yet is named by its own
     commit's in-flight label, `Signing and publishing…` or `Signing
     comment…`; an edit's card is already there, so its line is the row's
     bare `Signing…`. Taken, the line goes, the card stands wearing `Still
     settling`, and the snackbar confirms, as each seal's landing does.
   · THE FAILURE stands in the same place, in the failure voice, with `Retry`
     — `SigningPending`'s row line, which asks the same signing again. An
     edit's card is the referent, so it says the row's own `That didn't
     sign.`; a post or a reply never became a card, so its line names what
     did not sign, by the did-not-land notice's family words (`ComposeExpired`:
     `Your post didn't land`, `Your comment didn't land`).

   `act` picks the act and `moment` its two ends before the answer:
   · post — the feed's head, above the first card, where the post's settling
     card will stand. Its draft stays on the device until the signature is
     taken, so after a failure New post leads with the draft card, and
     Continue resumes it (`ComposeDraft`).
   · reply — the thread, on the parent it answers, in the slot `ReplySettled`
     draws the new card in; the branch opens as the landing opens it.
   · edit — the edited card itself, the reader's own post in the feed,
     unchanged until the edit is taken.

   A PROPOSAL (round 37): the failure of content that never became a card had
   no drawn precedent. `Your post didn't sign.` and `Your comment didn't
   sign.` are the two new strings, review-pending in copy-voice. */
export const FRAME = { width: 390, height: 844 };
export const PROPS = {
  act: { editor: "enum", options: ["post", "reply", "edit"], default: "post" },
  moment: { editor: "enum", options: ["signing", "failed"], default: "signing" },
};
export const VALS = `feedShown: this.props.act === "reply" ? "none" : "block", threadShown: this.props.act === "reply" ? "block" : "none", postSigningShown: this.props.act === "post" && this.props.moment === "signing" ? "block" : "none", postFailedShown: this.props.act === "post" && this.props.moment === "failed" ? "block" : "none", editShown: this.props.act === "edit" ? "block" : "none", editSigningShown: this.props.act === "edit" && this.props.moment === "signing" ? "block" : "none", editFailedShown: this.props.act === "edit" && this.props.moment === "failed" ? "block" : "none", replySigningShown: this.props.act === "reply" && this.props.moment === "signing" ? "block" : "none", replyFailedShown: this.props.act === "reply" && this.props.moment === "failed" ? "block" : "none"`;

/* The line stands at a card's inset, under the card it belongs to (or, for a
   post, where its card will stand), one line by the row rule. */
const LINE = { padding: "var(--space-2) var(--space-4) var(--space-3)" };

export function Screen() {
  return (
    <>
      <div style={{ display: "{{feedShown}}" }}>
        <CograBand trailing={<FeedFilter />} />
        <FeedList>
          <div style={{ display: "{{postSigningShown}}", ...LINE }}>
            <PendingMarker label="Signing and publishing…" />
          </div>
          <div style={{ display: "{{postFailedShown}}", ...LINE }}>
            <SigningPending row message="Your post didn't sign." onRetry={() => {}} />
          </div>
          <div style={{ display: "{{editShown}}" }}>
            <PostCard {...SOL_POST} menuItems={OWN_POST_MENU} />
            <div style={{ display: "{{editSigningShown}}", ...LINE }}>
              <PendingMarker label="Signing…" />
            </div>
            <div style={{ display: "{{editFailedShown}}", ...LINE }}>
              <SigningPending row onRetry={() => {}} />
            </div>
          </div>
          <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
          <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        </FeedList>
        <BottomNav active="feed" slots={ALL_SLOTS} inline />
      </div>
      <div style={{ display: "{{threadShown}}" }}>
        <div style={{ display: "{{replySigningShown}}" }}>
          <ThreadDetail />
          <CommentsThreadSheet afterClose="signing" scrolledBy={12} />
        </div>
        <div style={{ display: "{{replyFailedShown}}" }}>
          <ThreadDetail />
          <CommentsThreadSheet afterClose="failed" scrolledBy={12} />
        </div>
      </div>
    </>
  );
}
