/* ABOUT COGRA — the static page behind the join door's "?" and Settings' About
   group (jakob's rulings, the batch-rulings round; backlog item 74).

   IT GETS ALL OF IT (jakob, verbatim: "Yes about gets all.. will definetly grow
   with time but does not need to hold back on things just because they are not
   implemented yet"). The intro's five cards are the short teaching a reader
   meets once; this is the long one they can come back to, and it carries the
   differences the cards leave out — the money, the applicant's own position,
   the key. Chats are named here although chats are not built, because the rule
   about them is true now and a reader deciding whether to write something
   needs it now.

   THE LAST TOPIC IS THE HONEST FRAME, not a disclaimer bolted on. A page that
   describes unbuilt parts in the present tense without saying so is a page that
   lies by tense; one sentence at the end costs nothing and makes every sentence
   above it true.

   IT IS A TASK PAGE, so it wears the back arrow and no bottom bar — the entry
   flow's own grammar (readme §13), and the reason the join door can open it
   without the door losing its place. The header pins: a reader scrolling a
   reference page must never lose the way back (readme §13, browse collapses,
   task pins).

   IT IS A FAQ, NOT AN ESSAY (jakob's canvas pass: "id suggest we make it into
   a FAQ looking thing were you expand the topic that interests you instead of
   one flowing section (it will get toooo long for comsumption)"). Nine topics
   as rows; the reader opens the one they came with. This page gains a section
   every time CoGra gains something worth explaining — that is what "About gets
   all" costs — and a page that grows by scrolling is read less the more it
   says, while a page that grows by rows is read the same.

   EACH TOPIC ANSWERS ON ITS OWN. Opening one does not close another: a reader
   comparing two answers should not have to choose between them, and the
   convention a reader arrives with is independent toggles. (DERIVED, not
   ruled — jakob confirms it on canvas.)

   DRAWN WITH THE FIRST TOPIC OPEN, the rest closed. Nine closed rows would
   show the anatomy and none of the words; nine open ones would be the flowing
   page this iteration just left behind. One open row draws both states at
   once, which is what a state board is for.

   THE ROW IS MINTED HERE, NOT IN `components/`. The tree carries
   `aria-expanded` on three controls — a help dot, a filter pill, a post's
   overflow — and not one of them is a full-width disclosure row, so there was
   nothing to reuse. It stays local because a master is a shape reused across
   PRODUCTS and this one is used on a single board; the day a second surface
   wants it, it is promoted then. The chevron is Material's `expand_more` from
   the `Icon` master, rotated when open — no glyph was drawn and none was
   missing.

   IT IS AN ORDINARY PHONE BOARD AGAIN, and that is the fold's whole result.
   The flowing page exported a tall `FRAME` because an argument cut off at
   844px is an argument nobody can review; folded, the nine titles and one
   open answer come to 625px, so the page fits the screen it is read on and
   the board draws that screen. `Settings` keeps its tall frame because its
   content genuinely exceeds a phone; this one no longer does.

   NO "?" ON IT, and no second door out. This IS the explanation, so a help dot
   here would open the page the reader is standing on. */

/* One topic: the row that names it, and the words behind the row. The WHOLE
   row is the control, title and chevron together — a chevron-sized target on a
   page of nine rows is nine chances to miss. */
function Topic({ title, open = false, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <h2 style={{ margin: 0 }}>
        <button
          type="button"
          aria-expanded={open ? "true" : "false"}
          className="cg-state cg-focus"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            width: "100%",
            minHeight: 48,
            padding: "var(--space-2) 0",
            border: 0,
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            color: "var(--on-surface)",
            fontSize: "var(--text-title-small)",
            lineHeight: "var(--text-title-small--line-height)",
            fontWeight: "var(--text-title-small--font-weight)",
            letterSpacing: "var(--text-title-small--letter-spacing)",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          <span
            aria-hidden="true"
            style={{
              flex: "none",
              display: "inline-flex",
              color: "var(--text-secondary)",
              transform: open ? "rotate(180deg)" : undefined,
            }}
          >
            <Icon name="expand_more" size={20} />
          </span>
        </button>
      </h2>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 0 var(--space-4)" }}>
          {children.map((line) => (
            <p
              key={line}
              style={{
                margin: 0,
                fontSize: "var(--text-body-medium)",
                lineHeight: "var(--text-body-medium--line-height)",
                letterSpacing: "var(--text-body-medium--letter-spacing)",
                color: "var(--text-secondary)",
              }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
      <div aria-hidden="true" style={{ height: 1, background: "var(--border-hairline)" }} />
    </section>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader title="About CoGra" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px" }}>
        <Topic title="What this is" open>
          {[
            "CoGra is a place to read and write in public, where what reaches you is decided by the people and the things you have pointed at — never by a system guessing what will keep you here.",
          ]}
        </Topic>

        <Topic title="Your feed is your own steps">
          {[
            "Posts arrive along the connections you made, one step at a time. Nothing is put in front of you because it performs well, and there is no feed you did not shape.",
            "You can change what a feed shows whenever you like, and you can open any post's score to see exactly which steps carried it to you.",
          ]}
        </Topic>

        <Topic title="Everything here is public">
          {[
            "Posts, comments, opinions, tags, citations — and chats, once they arrive. Anything written on CoGra can be read, quoted and cited by anyone.",
            "There is no private side to this. If something is not meant to be read by strangers, it is not meant for here.",
          ]}
        </Topic>

        <Topic title="An opinion says two things">
          {[
            "Every opinion you give carries two: how far you are for or against the thing, and how much of it you want reaching you. The pad is where you place both at once.",
            "The face beside an opinion is a short reading of that pair, not a separate rating. You can turn the exact numbers on in settings.",
          ]}
        </Topic>

        <Topic title="Nothing is lost">
          {[
            "Posts and comments are built in layers, and a layer is never taken away. An edit adds to the record instead of replacing it, so what you are reading carries its own history.",
            "When something does have to go — the law, or the author's own choice — the words are removed and a mark stays where they were. Nothing disappears quietly.",
          ]}
        </Topic>

        <Topic title="Money follows the reach you made">
          {[
            "Reading and writing here can earn, and what you earn is yours.",
            "Advertising is pull, not push: a campaign offers to pay for reach, and where that money lands is decided the same way a feed is — by the graph, not by the bid. Nobody buys their way into what you see.",
            "Every figure opens onto what produced it, down to the record that paid it.",
          ]}
        </Topic>

        <Topic title="Getting in, and being let in">
          {[
            "CoGra is invite-only. Somebody already here vouches for you, and until they have, you are an applicant: you can read everything, and you cannot post, comment, vouch or give an opinion yet.",
            "That is not a waiting period for its own sake. The first link to you is a real one, given by a person who stands behind it — which is the thing that keeps this place small enough to be honest.",
          ]}
        </Topic>

        <Topic title="Your key is yours">
          {[
            "Everything you publish is signed by a key that lives on your device and nowhere else. We cannot sign for you, and we cannot recover it for you — your recovery code is the only way back.",
          ]}
        </Topic>

        <Topic title="This page grows">
          {[
            "CoGra is being built, and this page describes the product rather than the build. Some of what is written here is already in your hands; some of it is on its way.",
          ]}
        </Topic>
      </div>
    </>
  );
}
