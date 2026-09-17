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

   THE LAST SECTION IS THE HONEST FRAME, not a disclaimer bolted on. A page that
   describes unbuilt parts in the present tense without saying so is a page that
   lies by tense; one sentence at the end costs nothing and makes every sentence
   above it true.

   IT IS A TASK PAGE, so it wears the back arrow and no bottom bar — the entry
   flow's own grammar (readme §13), and the reason the join door can open it
   without the door losing its place. The header pins: a reader scrolling a
   reference page must never lose the way back (readme §13, browse collapses,
   task pins).

   DRAWN WHOLE, like `Settings`: the board exports a tall `FRAME` because what
   this round records is the page's CONTENT and an argument cut off at 844px is
   an argument nobody can review.

   NO "?" ON IT, and no second door out. This IS the explanation, so a help dot
   here would open the page the reader is standing on. */

export const FRAME = { width: 390, height: 1736 };

function Section({ title, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-title-small)",
          lineHeight: "var(--text-title-small--line-height)",
          fontWeight: "var(--text-title-small--font-weight)",
          letterSpacing: "var(--text-title-small--letter-spacing)",
        }}
      >
        {title}
      </h2>
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
    </section>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader title="About CoGra" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "16px 24px 32px" }}>
        <Section title="What this is">
          {[
            "CoGra is a place to read and write in public, where what reaches you is decided by the people and the things you have pointed at — never by a system guessing what will keep you here.",
          ]}
        </Section>

        <Section title="Your feed is your own steps">
          {[
            "Posts arrive along the connections you made, one step at a time. Nothing is put in front of you because it performs well, and there is no feed you did not shape.",
            "You can change what a feed shows whenever you like, and you can open any post's score to see exactly which steps carried it to you.",
          ]}
        </Section>

        <Section title="Everything here is public">
          {[
            "Posts, comments, opinions, tags, citations — and chats, once they arrive. Anything written on CoGra can be read, quoted and cited by anyone.",
            "There is no private side to this. If something is not meant to be read by strangers, it is not meant for here.",
          ]}
        </Section>

        <Section title="An opinion says two things">
          {[
            "Every opinion you give carries two: how far you are for or against the thing, and how much of it you want reaching you. The pad is where you place both at once.",
            "The face beside an opinion is a short reading of that pair, not a separate rating. You can turn the exact numbers on in settings.",
          ]}
        </Section>

        <Section title="Nothing is lost">
          {[
            "Posts and comments are built in layers, and a layer is never taken away. An edit adds to the record instead of replacing it, so what you are reading carries its own history.",
            "When something does have to go — the law, or the author's own choice — the words are removed and a mark stays where they were. Nothing disappears quietly.",
          ]}
        </Section>

        <Section title="Money follows the reach you made">
          {[
            "Reading and writing here can earn, and what you earn is yours.",
            "Advertising is pull, not push: a campaign offers to pay for reach, and where that money lands is decided the same way a feed is — by the graph, not by the bid. Nobody buys their way into what you see.",
            "Every figure opens onto what produced it, down to the record that paid it.",
          ]}
        </Section>

        <Section title="Getting in, and being let in">
          {[
            "CoGra is invite-only. Somebody already here vouches for you, and until they have, you are an applicant: you can read everything, and you cannot post, comment, vouch or give an opinion yet.",
            "That is not a waiting period for its own sake. The first link to you is a real one, given by a person who stands behind it — which is the thing that keeps this place small enough to be honest.",
          ]}
        </Section>

        <Section title="Your key is yours">
          {[
            "Everything you publish is signed by a key that lives on your device and nowhere else. We cannot sign for you, and we cannot recover it for you — your recovery code is the only way back.",
          ]}
        </Section>

        <Section title="This page grows">
          {[
            "CoGra is being built, and this page describes the product rather than the build. Some of what is written here is already in your hands; some of it is on its way.",
          ]}
        </Section>
      </div>
    </>
  );
}
