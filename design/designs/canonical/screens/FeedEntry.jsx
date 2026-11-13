/* WHY THIS REACHED YOU — level one of the Feed score's drill-down (backlog item
   13, ruled by jakob 2026-09-11). The score on a card or a detail surface opens
   it, and it answers the one question a ranked feed owes its reader: why is this
   post in MY feed, and not somebody else's.

   THE ANSWER IS THE PATHS, NOT A BREAKDOWN. `feed-ranking.md` §6.1: the score is
   the sum of up to `k` internally disjoint paths from the viewer's own outgoing
   opinions to the post, strongest first — so the honest first screen is that
   list, in that order, with each path stating what it adds. There is no chart
   here and there will not be one: a bar would turn a reader's own connections
   into a statistic about the post.

   EVERY PATH STANDS, A CONTINUOUS LIST (jakob 2026-11-12: "there is just
   this one list and nothing below it so it is fine if that list grows
   endless"). The page's purpose is the list, so it is never capped — the
   cap rule's own wording — and a client pages it in code as the reader keeps
   going. The drawn rows add up to the number the reader tapped: 6.80 + 4.20 +
   2.60 + 1.10 + 0.30 + 0.20 is 15.20.

   EVERY PATH STARTS WITH AN OPINION THE READER GAVE (§1, the inbound-inert
   rule): nothing anyone points at you moves anything toward you. That is the
   note under the cover, and it is the sentence the whole feature exists to make
   checkable.

   UNDER A BORROWED VIEW IT IS SAID IN THE THIRD PERSON (jakob 2026-10-12,
   SR-G3; the `view` chip's `borrowed`). A guest or an applicant reads a feed
   walked from someone else's opinions, so "an opinion you gave" would be false
   for them: the note names the account the view is borrowed from, in the
   band's own grammar (`Browsing from @mira's view`), and every path leads with
   that account's face.

   REGISTERED under the `feedEntry` prefix (round 7), the four levels' one
   prefix: the held thing is `origin`, the note `note`, `Strongest first`
   `pathsLabel`, and each path row `path` keyed by its place, strongest first.
   The `view` chip
   draws the path list once per value, so the two lists are one list in two
   states — each row keeping its own key (a chip copy of a keyed instance).

   A TINY SCORE'S TRACE (jakob 2026-11-12, the re-ask's twentieth; the
   `score` chip). The figures only change: `usual` the 15.20 the cast's
   paths add up to; `tiny` a score of +0.0031 — the card reading `0.01` —
   every figure under 0.005 in two significant digits, the weakest at the
   six-decimal edge (+0.000030, +0.000020); `tiny-negative` −0.00042, the
   weakest paths cut at six decimals (−0.000006, −0.000003, −0.000001). The drawn figures still
   add up to the flag. `ExplainableNumber` holds the rule. */
export const NODE = "feedEntry";
export const PROPS = {
  view: { editor: "enum", options: ["own", "borrowed"], default: "own" },
  score: { editor: "enum", options: ["usual", "tiny", "tiny-negative"], default: "usual" },
};
export const VALS = `traceNote: this.props.view === "borrowed" ? "Every path here starts with an opinion @mira gave." : "Every path here starts with an opinion you gave.", ownPaths: this.props.view === "borrowed" ? "none" : "contents", borrowedPaths: this.props.view === "borrowed" ? "contents" : "none", flagScore: this.props.score === "tiny" ? "+0.0031" : this.props.score === "tiny-negative" ? "−0.00042" : "+15.20", path1: this.props.score === "tiny" ? "+0.0018" : this.props.score === "tiny-negative" ? "−0.00031" : "+6.80", path2: this.props.score === "tiny" ? "+0.00079" : this.props.score === "tiny-negative" ? "−0.000080" : "+4.20", path3: this.props.score === "tiny" ? "+0.00034" : this.props.score === "tiny-negative" ? "−0.000020" : "+2.60", path4: this.props.score === "tiny" ? "+0.00012" : this.props.score === "tiny-negative" ? "−0.000006" : "+1.10", path5: this.props.score === "tiny" ? "+0.000030" : this.props.score === "tiny-negative" ? "−0.000003" : "+0.30", path6: this.props.score === "tiny" ? "+0.000020" : this.props.score === "tiny-negative" ? "−0.000001" : "+0.20"`;
export function Screen() {
  return (
    <>
      <PageHeader title="Why this reached you" backHref="#" backLabel="Back to feed" node="header" />
      <ScoreColumn>
        <ScoreOrigin score="{{flagScore}}" />
        <QuietNote node="note">{"{{traceNote}}"}</QuietNote>

        <SectionLabel node="pathsLabel">Strongest first</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "{{ownPaths}}" }} data-node-chip="view" data-node-key="own">
            {SCORE_PATHS.map((path, index) => (
              <PathRow
                key={path.through}
                people={path.people}
                through={path.through}
                value={`{{path${index + 1}}}`}
                onOpen={() => {}}
                node="path"
                nodeKey={String(index + 1)}
              />
            ))}
          </div>
          <div style={{ display: "{{borrowedPaths}}" }} data-node-chip="view" data-node-key="borrowed">
            {SCORE_PATHS_BORROWED.map((path, index) => (
              <PathRow
                key={path.through}
                people={path.people}
                through={path.through}
                value={`{{path${index + 1}}}`}
                onOpen={() => {}}
                node="path"
                nodeKey={String(index + 1)}
              />
            ))}
          </div>

        </div>
      </ScoreColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
