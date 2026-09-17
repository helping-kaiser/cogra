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

   WHAT IS DRAWN UP THERE IS A CUTOUT, NOT A CLUSTER (jakob's second canvas
   pass: "the graph above mira still doesnt look graphy.. it looks closed off
   and a bit like a mushroom it should give the feel of strechting endlessly
   wide out (maybe have some loose edges fading out and give it a nicer
   shape"). Three things do that work and each one answers a word of his:

   - CLOSED OFF is fixed by the LOOSE EDGES. Nine of them leave the wired dots
     and run outward — left, up, right, down past the corners — on a stroke
     that fades to nothing. Three end in a dot faint enough to read as far
     away; six end in nothing at all, which is the honest drawing of an edge
     whose other end is off this card. A graph whose every edge lands
     somewhere inside the frame is a graph with a boundary, and this one has
     none.
   - MUSHROOM is fixed by the SILHOUETTE and by the GATE. The dots sit in a
     shallow band — 342 wide against 60 tall — that TILTS, running lower on
     the left and higher on the right, because a level row of dots arcs into
     a cap the moment its ends drop and a tilted one cannot. And only two
     edges rise to @mira: three converging on one face drew a flare, and a
     flare under a band of dots is the stem the cap was sitting on. The loose
     edges leave along the band's own axis far more than they leave upward,
     which is what makes it read as weather blown across the top rather than
     as something growing out of her.
   - A NICER SHAPE is fixed by the IRREGULARITY. Positions are hand-placed and
     deliberately uneven — no two gaps equal, no symmetry to find — because
     an even scatter reads as a pattern and a pattern reads as decoration.
     The mesh closes a few triangles and leaves other dots on a single
     thread, the way a real neighbourhood is dense in places and thin in
     others.

   THE FADE IS A GRADIENT, NOT AN OPACITY (and it is token-themed). Each loose
   edge carries its own `linearGradient` in user space, running from the dot it
   leaves to the point it dies at, with `--border-field` at full strength and
   the same token at zero — so the edge fades along its own direction and does
   the right thing in both themes, which a flat 30%-opacity line does not.

   MIRA IS JOINED ON, NOT HOLDING IT UP. Two edges, rising nearly parallel to
   the two dots above her; everything to the right of them is hers only THROUGH
   the mesh, which is the gate's own meaning — one link in, and the network
   carries on past it without her.

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

/* The band above @mira: eight wired members across the stage's full width.
   Positions are hand-placed rather than generated — no two gaps equal, heights
   alternating instead of arching — because a layout algorithm at this size
   draws either a circle or a tangle, and an even scatter reads as decoration. */
const MEMBERS = [
  { id: "a", x: 32, y: 76 },
  { id: "b", x: 76, y: 40 },
  { id: "c", x: 120, y: 86 },
  { id: "d", x: 156, y: 46 },
  { id: "e", x: 198, y: 60 },
  { id: "f", x: 240, y: 26 },
  { id: "g", x: 280, y: 74 },
  { id: "h", x: 314, y: 34 },
];
const AT = Object.fromEntries(MEMBERS.map((member) => [member.id, member]));
/* Dense in places, thin in others — `b` and `g` hang on a single thread each
   while the middle closes triangles, which is how a neighbourhood actually
   looks and a lattice does not. */
const MESH = [
  ["a", "b"],
  ["a", "c"],
  ["b", "d"],
  ["c", "d"],
  ["c", "e"],
  ["d", "f"],
  ["e", "f"],
  ["e", "g"],
  ["f", "h"],
  ["g", "h"],
];
/* The edges that leave: where each one starts, where it dies, and whether
   anything is still visible when it gets there. They go outward along the
   band's axis far more than upward — that is what keeps the silhouette a band
   and not a cap. */
const LOOSE = [
  { from: "a", to: [-26, 54], far: true },
  { from: "a", to: [-18, 116] },
  { from: "b", to: [50, -22] },
  { from: "c", to: [56, 134] },
  { from: "d", to: [150, -30], far: true },
  { from: "f", to: [264, -34] },
  { from: "h", to: [372, 16], far: true },
  { from: "h", to: [366, 68] },
  { from: "g", to: [332, 128] },
];
/* The TWO edges that make her the gate, and two is the number for a reason:
   three converging on one face drew a flare, and a flare under a band of dots
   is exactly the mushroom stem this round was told to get rid of. Two rise
   almost parallel, so she reads as joined ON to the band rather than holding
   it up — and the whole right half is hers only through the mesh, which is
   the gate's own meaning. Drawn from her centre, her face painting over their
   lower ends. */
const GATE = ["c", "e"];
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
          <defs>
            {LOOSE.map((edge, index) => (
              <linearGradient
                key={`fade-${index}`}
                id={`vouch-fade-${index}`}
                gradientUnits="userSpaceOnUse"
                x1={AT[edge.from].x}
                y1={AT[edge.from].y}
                x2={edge.to[0]}
                y2={edge.to[1]}
              >
                <stop offset="0" style={{ stopColor: "var(--border-field)", stopOpacity: 1 }} />
                <stop offset="0.5" style={{ stopColor: "var(--border-field)", stopOpacity: 0.45 }} />
                <stop offset="1" style={{ stopColor: "var(--border-field)", stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          {/* The edges that leave, under everything else. */}
          {LOOSE.map((edge, index) => (
            <path
              key={`loose-${index}`}
              d={`M ${AT[edge.from].x} ${AT[edge.from].y} L ${edge.to[0]} ${edge.to[1]}`}
              stroke={`url(#vouch-fade-${index})`}
              strokeWidth="2"
              fill="none"
            />
          ))}
          {/* Three of them still have something at the far end, faint enough
              to read as distance rather than as a neighbour. */}
          {LOOSE.filter((edge) => edge.far).map((edge, index) => (
            <circle
              key={`fardot-${index}`}
              cx={edge.to[0]}
              cy={edge.to[1]}
              r="7"
              style={{ fill: "var(--secondary-container)", opacity: 0.4 }}
            />
          ))}
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
