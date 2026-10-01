/* ACTING WITH THE KEY ELSEWHERE (legacy conversion, lane C) — the pattern
   board for what happens when a signature is asked for and the key that would
   give it is not on this device. Drawn on the stance pad, because the pad is
   the smallest, most casual signature the system has: if the answer holds here
   it holds everywhere.

   THE PAD OPENS ANYWAY, and the pick is still made. What is missing is the last
   step, so the notice takes the place `Set` would have stood in — the reader is
   never stopped before doing the thinking, only before the part that needs a
   key.

   THE NOTICE IS `ComposeKeyAbsent`'s, which is `WalletKeyAbsent`'s: a
   `tertiary-container` panel, the "?" in `HelpDot`'s `inverse` — the ring the
   panel's own `currentColor` draws — and the restore button in `Button`'s
   `inverse`, the filled button that takes the panel's pair turned over.

   THE FEED BENEATH IS `KeyElsewhere`'s, the same shell with the same task card:
   this is that screen, one tap in. Its post carries no opinion, because the
   pad above it says in so many words that there is none yet.

   THE SHELL IS DRAWN HERE, around the real `StancePad`, and the reason is the
   thing the board exists to say. `StanceControl`'s open state always ends in
   Cancel and Set; Set is the only thing on the pad that signs, and a board about
   a signature that cannot be given must not draw it. No prop takes that row
   away, and adding one would be deciding what the pad looks like when signing is
   impossible. So the notice stands where the landing line and the actions
   would.

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
     holding it; a new pick kept on the same post replaces it.
   - Several can wait at once, one per post. When the key is restored they
     sign together, in one batch the reader reviews first — never silently
     (jakob, 2026-09-30). `Restore the key` opens `KeptPicksReview`, one row
     per kept pick, each with a × that drops it at once; `Sign them` leads to
     the standard seal (`KeptPicksSeal`), which signs the batch all or
     nothing. A review left unsigned keeps them, and the settings page's Key
     backup group carries `3 kept picks waiting` to reopen it.
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
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard
          title="Your key isn't on this browser"
          body="Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending."
        >
          <div style={{ display: "flex" }}>
            <Button size="sm">Restore the key</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash over the shell; the parked pad above it stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 80,
          transform: "translateX(-50%)",
          width: 272,
          maxHeight: 684,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflow: "hidden",
          borderRadius: "var(--radius-extra-large)",
          background: "var(--surface-dialog)",
          color: "var(--on-surface)",
          padding: "var(--card-padding)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <QuietNote>
            <span aria-hidden="true">🤷</span> No opinion on this post yet.
          </QuietNote>
          {/* The pick's readout, above the field where a thumb cannot cover it. */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Your pick
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
              <span className="cg-exact" style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
            </span>
            <span style={SR_ONLY}>
              Nice, For or against +0.10, How much reaches you +0.10
            </span>
          </div>
        </div>

        <StancePad value={{ pDirected: 0.1, pInterest: 0.1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-medium)", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              Your key isn't on this browser
            </h2>
            <HelpDot ariaLabel="Your key" variant="inverse" />
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Signing needs your key, which isn't in this browser — the write waits as pending.
          </p>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Restore the key with your recovery code to finish.
          </p>
          <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
        </div>

        <Button variant="text" style={{ width: "100%" }}>Keep it pending, restore later</Button>
      </div>
    </>
  );
}
