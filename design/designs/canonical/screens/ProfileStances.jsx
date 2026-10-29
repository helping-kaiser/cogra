/* The opinions page (profile round, item 23 — jakob: "kinda similar to the way
   insta handles their followers/following page"). Opened from any profile's
   figures row: two text tabs, both directions SEPARATED — never one merged
   list — and each row is a person with the public stance the row is about,
   its face and pair drawn plainly (every stance is a public record). Tapping
   the person opens their profile. A read drill-in: back arrow, bar rides.

   THE TAB ROW IS `TabBar` WITH WORDS. Two directions is a choice made in
   words, not glyphs — and a cell whose own words are its name takes no
   aria-label, which the master derives from the tab rather than a prop.

   FACES FOLLOW THE VALUE (jakob 2026-10-21, seam 242). Kel's opinion is
   `+0.00 / +0.35` — interested, no side taken — so the row wears 🤔, the
   one-zero face, and never a table face; it stands where its for-or-against
   value puts it, at nothing, between the ones held for and against.

   THREE PAGES, ONE BOARD (round 26, seam 250). The `whose` chip draws
   another's page (@ada's), the reader's own (@sol's) and a deleted account's;
   `tab` the direction; `list` the rows or the empty line.
   · THE OWN PAGE SPEAKS IN THE SECOND PERSON, as the own figures do
     (`Opinions on you` · `Opinions by you`): its tabs read `On you` and
     `By you`. The reader is no row on their own page.
   · A DELETED ACCOUNT'S PAGE IS TITLED `Opinions`: the handle is dropped,
     never replaced, as everywhere on the deleted account (`ProfileDeleted`);
     its tabs keep `On them` and `By them`.
   · THE EMPTY LINE IS THE FIGURE'S OWN NOUN AT ZERO, in the empty sheet's
     calm register: another's `On them` keeps the sheet's blessed `No opinions
     yet — yours would be the first.` (the reader's would be); `No opinions
     by @ada yet.`, `No opinions on you yet.`, `No opinions by you yet.`, `No
     opinions on this account yet.` (others still can). A deleted account will
     give none again, so its `By them` says so in the past: `This account gave
     no opinions.`

   REGISTERED AS `profileStances` (the web's minted ids): `header`, `tabRow`
   (its `onTab` and `byTab`, one copy per `tab` value), `list` and in it a
   `row` per person, keyed by the handle of the person it names — the path
   follows the drawing, as `notifications.list.notification` does — and
   `empty` in the list's place.

   A DELETED ACCOUNT'S ROW (round 27, seam 252) stands in the list as any
   other, where its value puts it — `StanceRow`'s `redacted`: the reserved
   disc, `Deleted account`, no handle line, the opinion read as any row's,
   the row a door to the deleted account's page. It has no handle to key by,
   so it is its own node, `redactedRow`, keyed by the actor's id, the
   lowercase UUID the wire carries — `row`'s rule names the handle, and a
   registered rule is never reworded (`redactedAccount`, ruling 56(c)). The
   page
   browses — the header and the tabs collapse with the scroll (readme §4,
   *Browse collapses, task pins*). */
export const NODE = "profileStances";
export const PROPS = {
  whose: { editor: "enum", options: ["other", "own", "deleted"], default: "other" },
  tab: { editor: "enum", options: ["on", "by"], default: "on" },
  list: { editor: "enum", options: ["rows", "empty"], default: "rows" },
};
export const VALS = `title: this.props.whose === "own" ? "@sol · Opinions" : this.props.whose === "deleted" ? "Opinions" : "@ada · Opinions", backLabel: this.props.whose === "own" ? "Back to your profile" : "Back to the profile", onWord: this.props.whose === "own" ? "On you" : "On them", byWord: this.props.whose === "own" ? "By you" : "By them", onShown: this.props.tab === "on" ? "block" : "none", byShown: this.props.tab === "by" ? "block" : "none", rowsShown: this.props.list === "rows" ? "flex" : "none", emptyShown: this.props.list === "empty" ? "block" : "none", solRow: this.props.whose === "own" ? "none" : "contents", emptyLine: this.props.whose === "own" ? (this.props.tab === "on" ? "No opinions on you yet." : "No opinions by you yet.") : this.props.whose === "deleted" ? (this.props.tab === "on" ? "No opinions on this account yet." : "This account gave no opinions.") : (this.props.tab === "on" ? "No opinions yet — yours would be the first." : "No opinions by @ada yet.")`;

const DIRECTIONS = [
  { id: "on", label: "{{onWord}}" },
  { id: "by", label: "{{byWord}}" },
];

export function Screen() {
  return (
    <>
      <PageHeader title="{{title}}" backHref="#" backLabel="{{backLabel}}" node="header" />
      <div style={{ display: "{{onShown}}" }} data-node-chip="tab" data-node-key="on">
        <TabBar ariaLabel="Which direction" value="on" tabs={DIRECTIONS} node="tabRow" />
      </div>
      <div style={{ display: "{{byShown}}" }} data-node-chip="tab" data-node-key="by">
        <TabBar ariaLabel="Which direction" value="by" tabs={DIRECTIONS} node="tabRow" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "{{rowsShown}}", flexDirection: "column", paddingTop: 4 }} data-node="list">
        <StanceRow name="Tobias Lindqvist" handle="tobias" pDirected={0.7} pInterest={0.4} node="row" nodeKey="tobias" />
        <div style={{ display: "{{solRow}}" }}>
          <StanceRow name="Sol Ferreira" handle="sol" pDirected={0.6} pInterest={0.3} node="row" nodeKey="sol" />
        </div>
        <StanceRow name="Mira Voss" handle="mira" src="inviter.jpg" pDirected={0.4} pInterest={0.5} node="row" nodeKey="mira" />
        <StanceRow redacted pDirected={0.2} pInterest={0.2} node="redactedRow" nodeKey="9d3f6a1b-4c2e-4b8a-a7d5-2e6f1c0b3a98" />
        <StanceRow name="Kel Moreau" handle="kel" pDirected={0} pInterest={0.35} node="row" nodeKey="kel" />
        <StanceRow name="Juno Baptiste" handle="juno" pDirected={-0.2} pInterest={0.1} node="row" nodeKey="juno" />
      </div>
      <div style={{ flex: 1, display: "{{emptyShown}}", padding: "8px 24px" }}>
        <EmptyState title="{{emptyLine}}" node="empty" />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
