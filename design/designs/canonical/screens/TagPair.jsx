/* THE TAG PAIR EDITOR (readme §13, the tag round; jakob's ruling 2026-09-09).
   What a staged tag chip opens in a composer — the sheet that closes item 18's
   owed compose-side pair setting for tags.

   IT IS TWO SLIDERS, NOT THE PAD (jakob's ruling, and the census agrees). A
   Tag's parameters are not a stance's: the census gives it relevance
   `r ∈ [-1, 1]` and confidence `c ∈ [0, 1]` (layer1-interface.md §9.5;
   hashtag.md §4 states the bound and api-spec.md's `TagInput` repeats it). The
   pad is one square over two signed axes — half of it would be unreachable
   here, and a control drawn with a dead half lies about its range. Two
   labelled tracks fit two differently-bounded axes exactly. It also reconciles
   the drawing with what already ships: slice 2.3 shipped tags with
   "relevance/confidence sliders" on both clients.

   THE DEFAULTS ARE THE CONTRACT'S, +0.1 AND 1. `TagInput` gives relevance the
   low-defaults value and confidence 1, and says why: "an author believes their
   own declaration, and confidence is not a stance whose headroom needs
   preserving." A stance starts gentle because it will be added to; a
   declaration about your own post does not need room to grow.

   THE POLES ARE NAMED IN THE READER'S WORDS. §3 keeps `p_d`, `p_i` and the
   repo's internal vocabulary off the screen, and the two axis labels are the
   only place this sheet could smuggle them in. What each track actually asks
   is api-spec.md's own gloss, said to a reader: how much the tag is what the
   post is about, and how sure the author is of saying so.

   IT IS TITLED BY THE TAG IT EDITS, for the settings sheets' reason — a sheet
   that covers the surface it came from has to say what it is — and the tag is
   what the reader tapped, so the two cannot drift.

   `Done` CLOSES IT. Nothing reacts behind this sheet to be watched: the chip
   it came from is under the sheet, not beside it, so the sheet commits rather
   than applying live — the settings sheets' rule, not the feed filter's.

   NOTHING IS SIGNED HERE. The pair rides the tag's own record and the tag
   rides the composer's batch, so this sheet stages and the seal signs. The
   sheet says so rather than leaving a reader to wonder what a slider just
   cost.

   THE SURFACE BENEATH IS DRAWN WHOLE (`EditComposeBody`), the overlay rule
   from 2026-09-08: a sheet covers the surface the reader came from, and that
   surface is the real one, not a shortened stand-in of it. */
export function Screen() {
  return (
    <>
      <EditComposeBody />

      <BottomSheet open ariaLabel="#saltmaps">
        <SheetTitle>#saltmaps</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px" }}>
          <StanceSlider
            label="How much it is about this"
            value={0.55}
            minLabel="Barely"
            maxLabel="Entirely"
            onChange={() => {}}
          />
          <StanceSlider
            label="How sure you are"
            value={1}
            min={0}
            minLabel="Guessing"
            maxLabel="Certain"
            onChange={() => {}}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Signed with the post, as its own action.
            </span>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
