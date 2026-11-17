/* The did-not-land notice (Q38) — a calm card in the member's shell.

   THE `reader` CHIP'S `applicant` (jakob 2026-11-13, N1): `Open the draft`'s only
   destination is the composer, an act, so an applicant meets it at the
   disabled opacity, still tappable, answering `You can post once you're in.`
   in the feed's snackbar (copy-voice, *The applicant lock, one rule*). */
export const PROPS = { reader: { editor: "enum", options: ["member", "applicant"], default: "member" } };
export const VALS = `lockOpacity: this.props.reader === "applicant" ? "var(--state-disabled)" : "1", lockedLine: this.props.reader === "applicant" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard title="Your post didn't land" body={'"Salt maps of the coast road" couldn\'t finish settling. Nothing was spent — your draft is saved.'}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text" size="sm">
              Dismiss
            </Button>
            <Button size="sm" style={{ opacity: "{{lockOpacity}}" }}>Open the draft</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <div style={{ display: "{{lockedLine}}" }}>
        <Snackbar message="You can post once you're in." />
      </div>
    </>
  );
}
