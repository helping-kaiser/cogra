import React from "react";
import { WashCard } from "../wallet/WashCard.jsx";

/* THE COMING-SOON DOOR — what a slot or an icon opens while the surface behind
   it is drawn after V1.0 (readme §13, *The V1.0 scope cut*, jakob 2026-09-25).

   A DOOR BELONGS TO A SLOT, NEVER TO A LIST. A slot or icon whose absence would
   deform the shell keeps its place and opens this; a kind list or a row set
   follows the staging rule instead and shows only what is served. So this card
   is rare by construction — deliberate and few, never a placeholder sprinkled
   over the app.

   IT IS A DRAWN ANATOMY, NOT BARE WORDS (jakob 2026-09-25: "a card with the
   cogra wash or sth so it looks less like a broken page and more like an actual
   comming soon page"). A lone grey line where a surface should be reads as a
   build that failed to load; a card on the brand wash reads as a page that
   meant to say exactly this. So it is `WashCard` — `--surface-hero`, the wash
   that dresses a page's ONE moment, which is what the door is: the whole of
   what the page has to say. No new colour rides in with it.

   `ghost={false}`, because the oversized coin is money's identity and this door
   is not money's — the post-MVP history banner's reason (`HistoricNote`),
   applied here. One face for every door: the chats door and the wallet door
   wear the same card, so neither grows a mark of its own.

   HEADLINE, THEN ONE LINE. The construction is copy-voice's "coming-soon
   surfaces": the thing, an em dash, `coming soon` — and then one sentence of
   what will be there. The master spells the promise itself, so no door can
   phrase it differently: a product that says `coming soon` in one place and
   something else in another has two answers to one question. `Coming soon` is
   the whole of what is promised — no date, no release, no "next".

   NO ACTION, for `EmptyState`'s reason taken to its limit: nothing a reader can
   do fills a door that is not open yet. The shell around it — the header's
   arrow, the bottom bar — is the way on, and it is already on the screen.

   It serves every reader state with one face (§13): a door has nothing in it
   that depends on who is looking. */

export function ComingSoonCard({ thing, line }) {
  return (
    <WashCard ghost={false}>
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
          letterSpacing: "var(--text-headline-small--letter-spacing)",
        }}
      >
        {thing} — coming soon
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-body-medium)",
          lineHeight: "var(--text-body-medium--line-height)",
          letterSpacing: "var(--text-body-medium--letter-spacing)",
          fontWeight: "var(--text-body-medium--font-weight)",
        }}
      >
        {line}
      </p>
    </WashCard>
  );
}
