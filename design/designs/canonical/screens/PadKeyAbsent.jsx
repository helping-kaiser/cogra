/* ACTING WITH THE KEY ELSEWHERE (legacy conversion, lane C) — the pattern
   board for what happens when a signature is asked for and the key that would
   give it is not on this device. Drawn on the stance pad, because the pad is
   the smallest, most casual signature the system has: if the answer holds here
   it holds everywhere.

   THE PAD OPENS ANYWAY, and the pick is still made. What is missing is the last
   step, so the notice takes the place `Set` would have stood in — the reader is
   never stopped before doing the thinking, only before the part that needs a
   key.

   THE NOTICE IS `ComposeKeyAbsent`'s: `NoticePanel` at the `medium` corner, a
   `tertiary-container` panel, the "?" in `HelpDot`'s `inverse` — the ring the
   panel's own `currentColor` draws — and the restore button in `Button`'s
   `inverse`, the filled button that takes the panel's pair turned over.

   ITS "?" SAYS ONLY WHAT THE NOTICE DOES NOT (seam 245, ask 17; copy-voice,
   *The "?" dialogs*, `Your key`). The notice's two lines already say that
   signing needs the key and that the recovery code restores it, so the
   pad's `Your key` dialog keeps to the three things left: where the key
   lives — where it was made or last restored, never held by CoGra — why
   nothing signs without it, and what waits for the restore: a pick kept
   here, reviewed before it signs. The seal and the settings screens keep
   the dialog's shared text.

   THE FEED BENEATH IS `KeyElsewhere`'s, the same shell with the same task card:
   this is that screen, one tap in. Its post carries no opinion, because the
   pad above it says in so many words that there is none yet.

   THE PAD IS `StanceControl`'s OWN, in its `keyAbsent` state (round 56,
   jakob 2026-11-18: the shared pad's drawing), rendered as `PadStanding`
   renders it — `PostCard`'s open pad at inset 80 on the pick +0.10 / +0.10:
   the pad's "?", the standing line, the pick's readout and the field, as on
   every pad. Set is the only thing on the pad that signs, and a board about a
   signature that cannot be given must not draw it, so the state takes the
   commit row away with the landing line, `writeRule`'s grammar, and the
   notice stands where they would.

   REGISTERED under the `feed` prefix, named as `PadStanding` names the same
   pad over the same feed: the band, its `filterTrigger`, the task card
   `keyCard` and its `restore` as `KeyElsewhere` names them, the bottom bar,
   and the post `card` keyed by its id, its open pad
   `card.actionRow.stance.pad.*` — `StanceControl`'s anatomy, the notice's
   two buttons `restore` and `keepPending`. The wash stays unnamed.

   ONLY THE TEXT BUTTON KEEPS (the key-loss round). `StanceControl`'s rule
   holds here unchanged: a press outside, or the system's Back, stages
   nothing — the pick is dropped, as a Cancel would drop it. Keeping the pick
   is a choice the reader makes by its own words, `Keep it pending, restore
   later`, and never the side effect of leaving.

   A KEPT PICK'S LIFE, IN ONE PLACE (the key-loss round; E12's ruling):
   - It lives on this device only, and survives a restart. Nothing is staged
     server-side and nothing is signed.
   - The post's anchor wears it (`PadPending`): the kept pick's face, and
     `Waiting for your key` under it. Tapping the face opens this pad again,
     holding it; a new pick kept on the same post replaces it. Once the key
     is back and the review waits unsigned, the line reads `Waiting for your
     review` and the tap opens `KeptPicksReview` instead.
   - Several can wait at once, one per post. When the key is restored they
     sign together, in one batch the reader reviews first — never silently
     (jakob, 2026-09-30). `Restore the key` opens `KeptPicksReview`, one row
     per kept pick, each with a × that drops it at once; `Sign them` leads to
     the standard seal (`KeptPicksSeal`), which signs the batch all or
     nothing. A review left unsigned keeps them, and the settings page's Key
     backup group carries `4 kept picks waiting` to reopen it — only while
     the key is here; if it goes again, the waiting-for-key state owns the
     surface. A kept vouch-back or approval never joins the batch: each
     surfaces as its own card, ceremony kept — the vouch-back on the feed,
     the approval on Invites.
   - A remembered sign-out keeps them, as it keeps everything on the device.
     A sign-out that forgets the account clears them with the draft — and
     where it would also take an unbacked key, `SignOutConfirm` names all
     three and keeps them sealed unless the reader erases them.
   - A session invalidated from elsewhere — `Sign out everywhere else` on
     another device, a password changed or reset there, a reused token
     caught — never destroys
     them, even on an account set to forget this device: they stay on it,
     sealed and unusable until this device signs in again, online, with the
     account's current credentials (jakob, confirmed by the implementation
     side's security check). An invalidation ends the session; it is not a
     remote wipe. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <TaskCard
          tone="notice"
          title="Your key isn't on this browser"
          body="Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending."
          node="keyCard"
        >
          <div style={{ display: "flex" }}>
            <Button variant="inverse" size="sm" node="restore">Restore the key</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} stanceOpen stancePadInset={80} stanceDefaultPick={{ pDirected: 0.1, pInterest: 0.1 }} stanceSigning="keyAbsent" node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      {/* The wash over the shell; the parked pad above it stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
