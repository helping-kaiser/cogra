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
   `tertiary-container` panel, the "?" ring drawn in the panel's own
   `currentColor` (the master spends `--primary` on the glyph, a second colour
   family inside a tonal block), and the restore button in `Button`'s `inverse`
   — the filled button that takes the panel's pair turned over.

   THE FEED BENEATH IS `KeyElsewhere`'s, the same shell with the same task card:
   this is that screen, one tap in. Its post carries no standing, because the
   pad above it says in so many words that there is none yet. */
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
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-wash, rgba(0, 0, 0, 0.5))" }} />

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
            <span aria-hidden="true">🤷</span> No stance on this post yet.
          </QuietNote>
          {/* The pick's readout, above the field where a thumb cannot cover it. */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span aria-hidden="true" style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Your pick
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: "var(--text-title-large)", lineHeight: 1.2 }}>🙂</span>
              <span style={{ fontSize: "var(--text-body-small)", whiteSpace: "nowrap" }}>+0.10 / +0.10</span>
            </span>
            <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
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
            <button
              type="button"
              aria-label="Your key"
              className="cg-focus"
              style={{ display: "grid", placeItems: "center", height: "var(--touch-target-min)", width: "var(--touch-target-min)", border: 0, background: "none", borderRadius: "var(--radius-full)", cursor: "pointer", flex: "none", color: "inherit" }}
            >
              <span
                aria-hidden="true"
                style={{ display: "grid", placeItems: "center", height: 32, width: 32, borderRadius: "var(--radius-full)", border: "1px solid currentColor", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}
              >
                ?
              </span>
            </button>
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
