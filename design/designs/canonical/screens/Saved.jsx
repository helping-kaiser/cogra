/* SAVED — everything you kept, in one list (readme §13, the private-viewer-
   state round; jakob's rulings 2026-09-11). Reached from your own profile's ⋮.

   ONE MIXED LIST, NEVER A TAB PER KIND (jakob). Posts, comments and people are
   all saveable, and a reader looking for the thing they kept on Tuesday is
   looking for a moment, not a category — three tabs would ask them to remember
   which kind of thing it was before they may search for it. The list is newest
   first, by when you saved it, which is the only order a reader can predict.

   THE DISC SAYS WHAT THE THING IS, and nothing else has to. `ContentRow`'s own
   precedence does the work: a person brings their picture, a post and a comment
   bring the glyph for their kind — the chronicle's vocabulary, one surface over.
   So the list needs no kind label, no filter and no section headings.

   THE TRAILING EDGE IS WHEN YOU SAVED IT, not when it was written. The list is
   a record of your own act, and a reader scanning it is retracing their own
   week.

   The chat message is the one saveable kind not drawn here: chats have no
   boards at all yet, so its row shape lands with the chat round and joins this
   same list rather than starting a second one.

   THE ROW CARRIES ITS OWN UNSAVE (jakob 2026-09-11). Sending a reader back to
   the thing's own ⋮ to undo what is in front of them is the long way round,
   and this is the one list where every row offers the same act. It is
   ICON-ONLY — the filled bookmark, `Unsave` in the accessibility tree, no word
   on screen (jakob: with the icon "we dont even need any word there") —
   because the same word repeated down a list is four copies of one sentence,
   and this glyph is one every reader already reads as "kept".

   IT TAKES THE CHEVRON'S SLOT, NEVER THE AGE'S. The age is when YOU saved the
   thing, which is this list's whole order and what a reader is retracing, so
   it keeps its place and the control stands outboard of it. The chevron was
   never drawn here — a row that opens says so by being a row — so the edge was
   already free. The glyph takes `text-secondary`, the colour every icon-only
   control in this system rests in: it is the row's control, not a badge saying
   the row is saved. Every row in this list is. */
const Unsave = () => (
  <button
    type="button"
    aria-label="Unsave"
    className="cg-state cg-focus cg-hit"
    style={{
      display: "grid",
      placeItems: "center",
      height: "40px",
      width: "40px",
      border: 0,
      background: "none",
      borderRadius: "var(--radius-full)",
      color: "var(--text-secondary)",
      cursor: "pointer",
      padding: 0,
    }}
  >
    <Icon name="bookmark" size={22} />
  </button>
);

export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="The long way home"
          titleAside="@ada"
          second="Took the coast road instead of the tunnel. Four hours longer, worth every minute."
          trailing="2d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="chat_bubble"
          title="The third headland light is real"
          titleAside="@tobias"
          second="on The long way home"
          trailing="3d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="Mira Voss"
          titleAside="@mira"
          second="Runs the stand by the sea wall — honey from the headland hives."
          trailing="5d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Sunday at the tide market"
          titleAside="@mira"
          second="Everything the flats give up in one morning."
          trailing="7d"
          action={<Unsave />}
          onOpen={() => {}}
        />
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
