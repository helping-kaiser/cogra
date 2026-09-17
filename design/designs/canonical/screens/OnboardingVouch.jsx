/* INTRO 5 OF 5 — SOMEONE BRINGS YOU IN (jakob's rulings, the batch-rulings
   round and his canvas pass; backlog item 74). His first sketch: "your new node
   (dot) with a friends node pointing at you (super cool would be if it was
   always the avatar of the person who actually invited you...)". His iteration,
   which this board draws: "you at the bottom as a dot, then mira above it
   pointing at you and she is the gate to all the other dots in the graph."

   IT READS BOTTOM-UP, AND THAT IS THE TEACHING. You are the lowest thing on the
   card with nothing below you; @mira is directly above, pointing down; the rest
   of the graph is above HER, reachable only through her. A left-to-right pair
   said "someone invited you" and stopped there. This says the second half —
   that the one link you have is also the whole of your reach for now — without
   a sentence having to carry it.

   THE INVITER'S FACE IS PERSONALIZED BY THE CLIENT — an implementation relay,
   not a drawn state. The board draws the canvas's own inviter, @mira, exactly
   as `Join` does, and the contract is: at run time this face is the ACTUAL
   link-issuer's avatar, falling back to the monogram `MonogramAvatar` already
   draws when there is no photo. One face changes; nothing else on the card
   moves with it.

   THE OTHER MEMBERS ARE BARE DOTS, deliberately. Faces up there would make the
   card about seven strangers; dots make it about the shape. They are wired to
   each other with solid edges and to @mira with solid edges, so she is visibly
   IN that graph while you are visibly not yet.

   YOUR EDGE IS DOTTED, HERS ARE SOLID (jakob ruled the dotted line over the
   other candidate, an arrow that stops short: "with dotted line"). Dotted reads
   not-yet-sealed and rhymes with the dashed ring already around your dot, where
   an arrow halting in empty space reads as a drawing mistake. The arrowhead
   still TOUCHES the ring, because the direction — somebody pointed at you
   first — is the thing this card exists to say, and a direction the reader has
   to infer is not taught.

   YOU ARE A DOT, AND THAT IS THE POINT. The reader has no avatar yet and no
   history behind them; drawing them as a face would promise a profile they have
   not made. The ring around the dot is the one thing said about it: this is new.

   `invited`, NOT `vouched` (jakob's canvas pass). The issuer invites; vouching
   is the separate act that follows, so a first screen using the ceremony's word
   for the link would teach the wrong order — the confusion item 92 was filed
   about, met on the very first screen instead.

   THE APPLICANT LINE IS THE CARD'S SECOND DUTY (jakob's draft, polished). The
   intro fires from applicant on, and an applicant who does not know that a
   human still has to let them in reads the empty days as a broken product. It
   sits as a `QuietNote` under the words rather than in them: it is a task, not
   a principle, and the four cards before it were principles.

   THE LAST BUTTON READS `Start reading` — sentence case, the reader's own next
   act, and never "Done" or "Finish", which name the tour instead of the
   product. */

const STAGE = { width: 342, height: 336 };

/* The graph above @mira: seven members and the edges between them. Positions
   are hand-placed rather than generated — a mesh that reads as a neighbourhood
   at a glance is a drawing decision, and a layout algorithm at this size draws
   either a circle or a tangle. */
const MEMBERS = [
  { id: "a", x: 58, y: 26 },
  { id: "b", x: 140, y: 10 },
  { id: "c", x: 232, y: 28 },
  { id: "d", x: 300, y: 72 },
  { id: "e", x: 104, y: 80 },
  { id: "f", x: 200, y: 86 },
  { id: "g", x: 30, y: 98 },
];
const AT = Object.fromEntries(MEMBERS.map((member) => [member.id, member]));
const MESH = [
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["a", "e"],
  ["e", "f"],
  ["b", "f"],
  ["f", "d"],
  ["e", "g"],
  ["a", "g"],
];
/* The three edges that make her the gate — drawn from her centre, her own face
   painting over their lower ends. */
const GATE = ["e", "f", "c"];
const MIRA_AT = { x: 171, y: 180 };

export function Screen() {
  return (
    <IntroFrame
      step={5}
      cta="Start reading"
      headline="Someone brings you in"
      lines={["You are here because @mira invited you. Her link is your first way in to everyone else, and theirs to you."]}
      note={
        <div style={{ paddingTop: 12 }}>
          <QuietNote>The friend who sent you this invite has to let you in. Ask them once you have verified your email.</QuietNote>
        </div>
      }
    >
      <IntroStage {...STAGE}>
        <IntroLines {...STAGE}>
          {MESH.map(([from, to]) => (
            <path
              key={`${from}${to}`}
              d={`M ${AT[from].x} ${AT[from].y} L ${AT[to].x} ${AT[to].y}`}
              stroke="var(--border-field)"
              strokeWidth="2"
              fill="none"
            />
          ))}
          {GATE.map((id) => (
            <path
              key={`gate-${id}`}
              d={`M ${MIRA_AT.x} ${MIRA_AT.y} L ${AT[id].x} ${AT[id].y}`}
              stroke="var(--border-field)"
              strokeWidth="2"
              fill="none"
            />
          ))}
          {/* Hers to you: the one edge that is not solid yet. */}
          <path d="M 171 216 L 171 264" stroke="var(--border-field)" strokeWidth="2" strokeDasharray="4 5" fill="none" />
          <polygon points="165,264 177,264 171,272" fill="var(--border-field)" />
        </IntroLines>

        {MEMBERS.map((member) => (
          <span
            key={member.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: member.x - 10,
              top: member.y - 10,
              width: 20,
              height: 20,
              borderRadius: "var(--radius-full)",
              background: "var(--secondary-container)",
            }}
          />
        ))}

        <IntroFace x={MIRA_AT.x} y={MIRA_AT.y} size={64} name="Mira Voss" src="inviter.jpg" />
        <IntroCaption x={252} y={172}>@mira</IntroCaption>

        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 143,
            top: 272,
            width: 56,
            height: 56,
            boxSizing: "border-box",
            borderRadius: "var(--radius-full)",
            border: "1px dashed var(--border-field)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 159,
            top: 288,
            width: 24,
            height: 24,
            borderRadius: "var(--radius-full)",
            background: "var(--primary)",
          }}
        />
        <IntroCaption x={252} y={292}>you</IntroCaption>
      </IntroStage>
    </IntroFrame>
  );
}
