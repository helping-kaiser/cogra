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

   WHAT IS DRAWN UP THERE IS A CUTOUT, NOT A CLUSTER, and it took three canvas
   passes to find the shape. Each fault jakob named has its own fix, and two of
   them are failure modes this drawing must never return to:

   - CLOSED OFF is fixed by the LOOSE EDGES ("it looks closed off... it should
     give the feel of strechting endlessly wide out (maybe have some loose
     edges fading out"). Eleven of them leave the wired dots and run outward —
     left, right, off the top, down past the lower corners — on a stroke that
     fades to nothing. Four end in a dot faint enough to read as far away;
     seven end in nothing at all, which is the honest drawing of an edge whose
     other end is off this card. A graph whose every edge lands inside the
     frame is a graph with a boundary, and this one has none.
   - MUSHROOM is fixed by the GATE. Only two edges rise to @mira: three
     converging on one face drew a flare, and a flare under a spread of dots
     is a stem holding up a cap.
   - A PLANE is fixed by DEPTH (jakob's third pass: "make it span more
     height.. it is not a shroom anymore but like a plane rather than a
     graph.. maybe a bit more of a tree shape with some interconnections
     looks more convincing"). A wide shallow band has one dimension to read
     and so reads as a surface seen edge-on. The dots now CLIMB — 226px of
     span against 270 of width — in loose tiers that branch: two above her,
     four above those, four above those, two more at the top where it thins
     out. The composition moved DOWN the card to buy that room, his own
     suggestion, and the stage grew with it.
   - A STRICT TREE would have been the next wrong answer, so the tiers are
     CROSS-LINKED: siblings joined to each other, a mid dot reaching across
     into its neighbour's branch, an upper one tying back down the other
     side. Branching is what gives the drawing depth; the cross-links are
     what keep it a graph. Six of the sixteen wired edges exist only to close
     a loop no tree would have.
   - A NICER SHAPE is fixed by the IRREGULARITY. Positions are hand-placed and
     deliberately uneven — no two gaps equal, no tier level, no symmetry to
     find — because an even scatter reads as a pattern and a pattern reads as
     decoration. The mesh is dense in the middle and leaves the top dots on a
     thread each, the way a real neighbourhood is thick in places and thin in
     others.

   THE FADE IS A GRADIENT, NOT AN OPACITY (and it is token-themed). Each loose
   edge carries its own `linearGradient` in user space, running from the dot it
   leaves to the point it dies at, with `--border-field` at full strength and
   the same token at zero — so the edge fades along its own direction and does
   the right thing in both themes, which a flat 30%-opacity line does not.

   MIRA IS JOINED ON, NOT HOLDING IT UP. Two edges, rising nearly parallel to
   the two dots above her; everything beyond those two is hers only THROUGH the
   mesh, which is the gate's own meaning — one link in, and the network carries
   on past it without her.

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

const STAGE = { width: 342, height: 470 };

/* The graph above @mira: twelve wired members climbing the stage in loose
   tiers. Positions are hand-placed rather than generated — no tier level, no
   two gaps equal, no symmetry to find — because a layout algorithm at this
   size draws either a lattice or a tangle, and an even scatter reads as
   decoration. `l` is the pair she reaches, `m` the branching, `u` the spread,
   `t` the two that thin out at the top. */
const MEMBERS = [
  { id: "l1", x: 132, y: 246 },
  { id: "l2", x: 206, y: 232 },
  { id: "m1", x: 72, y: 186 },
  { id: "m2", x: 152, y: 168 },
  { id: "m3", x: 234, y: 176 },
  { id: "m4", x: 296, y: 146 },
  { id: "u1", x: 36, y: 108 },
  { id: "u2", x: 112, y: 76 },
  { id: "u3", x: 192, y: 98 },
  { id: "u4", x: 258, y: 58 },
  { id: "t1", x: 148, y: 20 },
  { id: "t2", x: 306, y: 30 },
];
const AT = Object.fromEntries(MEMBERS.map((member) => [member.id, member]));
/* Ten edges branch upward and six cross between branches — and the six are the
   point. Branching alone draws a tree, and a tree is not a graph; the
   cross-links (marked) close loops no tree would have, which is what makes
   the climb read as a network seen in depth rather than as a diagram of
   descent. */
const MESH = [
  ["l1", "l2"], // cross — the two she reaches know each other
  ["l1", "m1"],
  ["l1", "m2"],
  ["l2", "m3"],
  ["l2", "m4"],
  ["m1", "u1"],
  ["m1", "u2"],
  ["m2", "u2"],
  ["m2", "u3"],
  ["m2", "m3"], // cross — between the two mid branches
  ["m3", "u3"], // cross — two branches share a dot above them
  ["m3", "u4"],
  ["m4", "u4"], // cross — likewise on the right
  ["u2", "t1"],
  ["u3", "t1"], // cross — the top dot is reached from both sides
  ["u4", "t2"],
];
/* The edges that leave: where each one starts, where it dies, and whether
   anything is still visible when it gets there. They go off every side at
   different heights — four left, three over the top, three right, one down
   past a lower corner — because a graph that only frayed sideways was the
   flat band this pass replaced. */
const LOOSE = [
  { from: "u1", to: [-28, 78], far: true },
  { from: "u1", to: [-20, 160] },
  { from: "m1", to: [-24, 234] },
  { from: "l1", to: [40, 298] },
  { from: "t1", to: [126, -36], far: true },
  { from: "u2", to: [84, -28] },
  { from: "u4", to: [280, -34] },
  { from: "t2", to: [350, -14], far: true },
  { from: "m4", to: [372, 108], far: true },
  { from: "m4", to: [364, 186] },
  { from: "l2", to: [304, 274] },
];
/* The TWO edges that make her the gate, and two is the number for a reason:
   three converging on one face drew a flare, and a flare under a spread of
   dots is exactly the mushroom stem this round was told to get rid of. Two
   rise almost parallel, so she reads as joined ON to the graph rather than
   holding it up — and everything past `l1` and `l2` is hers only through the
   mesh, which is the gate's own meaning. Drawn from her centre, her face
   painting over their lower ends. */
const GATE = ["l1", "l2"];
const MIRA_AT = { x: 171, y: 324 };

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
          <path d="M 171 360 L 171 398" stroke="var(--border-field)" strokeWidth="2" strokeDasharray="4 5" fill="none" />
          <polygon points="165,398 177,398 171,406" fill="var(--border-field)" />
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
        <IntroCaption x={252} y={316}>@mira</IntroCaption>

        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 143,
            top: 406,
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
            top: 422,
            width: 24,
            height: 24,
            borderRadius: "var(--radius-full)",
            background: "var(--primary)",
          }}
        />
        <IntroCaption x={252} y={426}>you</IntroCaption>
      </IntroStage>
    </IntroFrame>
  );
}
