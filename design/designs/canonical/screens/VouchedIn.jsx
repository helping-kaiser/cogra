/* VOUCHED IN — the ceremonial ending of becoming part of the network
   (backlog item 58, jakob 2026-09-11: "some indicator that you are now part of
   the network… you becoming part of the sky or sth", an animation welcome).

   WHAT THIS MOMENT ACTUALLY IS, in the product's own terms. The reader was
   vouched in, landed, and has just Set their first opinion — on @mira, the
   person who vouched for them. A feed is ranked from the viewer's OWN outgoing
   opinions, so until this signature they had none and were browsing from
   @mira's borrowed view (readme §13, the borrowed vantage). The signature is
   the moment the borrowed view ends and their own begins. That — not a
   milestone badge — is what the screen celebrates, and it is why the subline
   can be entirely concrete while the headline carries the metaphor.

   THE SKY IS NOT NEW MATERIAL. `SkyField` already draws it on the Explore hero
   ("Your sky — every account a star, sized by your own paths to it", item 16):
   weighted discs for accounts, hairlines between them, token colours only,
   distance carried by size and colour rather than by a night-black ground. This
   board is that same vocabulary at full bleed, with two additions the moment
   owes — the reader's own point, and the one edge they just made. Nothing here
   is hand-drawn where the system already owns the drawing.

   WHAT THE PICTURE SAYS, element by element:
     · the faint `outline` points are accounts far from you — the network you
       have joined but do not know yet;
     · the `secondaryContainer` and `primaryContainer` points are nearer ones,
       the same distance-by-colour reading the Explore hero already teaches;
     · the hairlines between them were there before you arrived — the network
       does not assemble itself for you, and the motion spec below is careful
       never to imply it does;
     · @mira carries her actual face, the only identified point, because the
       act being celebrated is reciprocation to a PERSON, not an abstraction;
     · YOU are the `primary` disc with a halo. The halo is a vantage mark, not a
       rank: in the Sky, size means "your own paths to it", and you have no path
       to yourself, so your point is marked as the place the view is taken from
       rather than drawn as the biggest star;
     · YOUR EDGE is the one stroke in `primary`, and it leaves your point for
       hers. Only viewer-rooted forward paths shape a feed, so the edge is drawn
       outward from you — the ranking law, made visible.

   NO BACK, NO BOTTOM BAR. The opinion is signed and on the record; the screen
   it came from no longer exists, so a back arrow would be a lie. A bottom bar
   would make a ceremony into a tab. One way out, forward.

   ── THE MOTION ──────────────────────────────────────────────────────────────
   THIS IS A DECLARED DEVIATION, not an oversight. readme §4 Motion says
   "nothing inside an arriving screen animates — no list entrance, no stagger"
   and "motion clarifies where something came from; it never performs". This
   board is the one place in the product that asks for an exception, and it is
   recorded as an exception for jakob to accept or reject rather than taken
   quietly. Two things keep it inside the system's spirit: every duration and
   easing below is an EXISTING token (no new motion value is introduced, and the
   phase offsets are sums of those same durations), and the motion is still
   deictic — it shows where your point came from and which way your edge runs.

   The sky ARRIVES ALREADY DRAWN. The other accounts and the hairlines between
   them are present in the first frame; nothing builds, blooms or assembles.
   What animates is only what is new: you, your halo, your edge, and the words.

     t=0      the screen arrives on the standard forward transition
              (`--duration-nav-forward` 300ms, in from `--nav-travel`,
              `--ease-emphasized-decelerate`) — the existing shell behaviour,
              unchanged.
     t=300    YOUR POINT SETTLES. The `primary` disc fades from 0 and rises 24px
              into place. `--duration-long-2` (500ms),
              `--ease-emphasized-decelerate`. Opacity and translateY only: no
              scale, no bounce, no spring (readme §4 forbids all three).
     t=600    THE HALO OPENS. The hairline ring expands from the disc's own
              radius to twice it and stays. `--duration-medium-2` (300ms),
              `--ease-standard-decelerate`. One move that settles — never a
              pulse or a ripple, which would perform.
     t=900    YOUR EDGE DRAWS, from your point outward to @mira's, stopping at
              her rim. `stroke-dasharray`/`stroke-dashoffset` over
              `--duration-long-2` (500ms), `--ease-standard`.
     t=1100   THE WORDS ARRIVE, headline, subline and button together as one
              block — an 8px rise with a fade, which is `cg-dialog-in`'s own
              entrance reused rather than a new one. `--duration-medium-4`
              (400ms), `--ease-standard-decelerate`. Together, never staggered.

   Offsets are sums of the durations above (300 · 300+300 · 600+300 · 600+500),
   so the sequence carries no bespoke number. It ends at 1500ms.

   INTERRUPTIBLE. A tap anywhere completes every phase immediately and leaves
   the resting state; the reader is never held for a second and a half. The
   button becomes live the moment the words land, whether they landed by
   animating or by being skipped.

   REDUCED MOTION: THE RESTING STATE IS THE END STATE — which is exactly what
   this board draws. Under `prefers-reduced-motion: reduce` the five phases
   collapse to 0ms (the duration tokens already do this on their own) and the
   screen arrives whole: edge drawn, halo at full radius, words in place. A
   reader who asked for stillness gets the ceremony's content and none of its
   choreography, and nothing is withheld from them. */

/* The ceremony's sky. `SkyField`'s vocabulary — token colours only, weighted
   discs, hairline edges — at full bleed, with the reader's own point and the
   edge they just signed. Kept local to this board rather than added to
   `_shared.jsx`: one board uses it, and `SkyField` remains the shared tease. */
const SKY_W = 390;
const SKY_H = 470;
/* @mira's point, and yours. The avatar disc is laid over the SVG at these same
   coordinates, so the field and the face stay in one register. */
const MIRA_AT = { x: 240, y: 250, r: 16 };
const YOU_AT = { x: 195, y: 400, r: 8 };

function CeremonySky() {
  return (
    <div style={{ position: "relative", width: SKY_W, height: SKY_H, flex: "none", margin: "0 auto" }}>
      <Raw
        style={{ display: "block", lineHeight: 0 }}
        html={`<svg viewBox="0 0 ${SKY_W} ${SKY_H}" width="${SKY_W}" height="${SKY_H}" aria-hidden="true" style="display:block">
          <g stroke="var(--border-hairline)" stroke-width="1" fill="none">
            <line x1="52" y1="120" x2="110" y2="68"/>
            <line x1="110" y1="68" x2="206" y2="128"/>
            <line x1="206" y1="128" x2="300" y2="120"/>
            <line x1="300" y1="120" x2="348" y2="196"/>
            <line x1="150" y1="186" x2="206" y2="128"/>
            <line x1="84" y1="250" x2="150" y2="186"/>
            <line x1="330" y1="300" x2="348" y2="196"/>
            <line x1="150" y1="186" x2="176" y2="288"/>
            <line x1="120" y1="330" x2="84" y2="250"/>
            <line x1="206" y1="128" x2="235.4" y2="233.6"/>
            <line x1="254.9" y1="258.3" x2="330" y2="300"/>
            <line x1="225.4" y1="258.7" x2="176" y2="288"/>
          </g>
          <circle cx="110" cy="68" r="3" fill="var(--outline)"/>
          <circle cx="262" cy="60" r="3" fill="var(--outline)"/>
          <circle cx="52" cy="120" r="4" fill="var(--outline)"/>
          <circle cx="300" cy="120" r="7" fill="var(--secondary-container)"/>
          <circle cx="206" cy="128" r="5" fill="var(--primary-container)"/>
          <circle cx="150" cy="186" r="6" fill="var(--secondary-container)"/>
          <circle cx="62" cy="190" r="3" fill="var(--outline)"/>
          <circle cx="348" cy="196" r="4" fill="var(--outline)"/>
          <circle cx="84" cy="250" r="5" fill="var(--outline)"/>
          <circle cx="176" cy="288" r="3" fill="var(--outline)"/>
          <circle cx="330" cy="300" r="5" fill="var(--primary-container)"/>
          <circle cx="120" cy="330" r="4" fill="var(--outline)"/>
          <circle cx="38" cy="340" r="3" fill="var(--outline)"/>
          <circle cx="286" cy="372" r="3" fill="var(--outline)"/>

          <line x1="197.9" y1="390.4" x2="234.8" y2="267.2" stroke="var(--primary)" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="${YOU_AT.x}" cy="${YOU_AT.y}" r="${YOU_AT.r * 2}" fill="none" stroke="color-mix(in srgb, var(--primary) 40%, transparent)" stroke-width="1"/>
          <circle cx="${YOU_AT.x}" cy="${YOU_AT.y}" r="${YOU_AT.r}" fill="var(--primary)"/>
        </svg>`}
      />
      <div style={{ position: "absolute", left: MIRA_AT.x - MIRA_AT.r, top: MIRA_AT.y - MIRA_AT.r }}>
        <MonogramAvatar name="Mira Voss" src="inviter.jpg" size={MIRA_AT.r * 2} />
      </div>
    </div>
  );
}

export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <CeremonySky />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px 32px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
            textAlign: "center",
          }}
        >
          You're part of the sky now.
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            maxWidth: 300,
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          Your opinion on @mira is signed, and the way is open both ways. The feed you see from here is your own.
        </p>
        <div style={{ marginTop: 32 }}>
          <Button>Go to your feed</Button>
        </div>
      </div>
    </div>
  );
}
