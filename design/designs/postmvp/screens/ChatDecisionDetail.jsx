/* A DECISION, OPENED WHOLE — what a pending card's words and an `Open
   decisions` row's words open (round B2 of the chats work, the governance
   round's fix pass; jakob 2026-09-24).

   A VOTER SEES EVERYTHING BEFORE VOTING. The fixture is the reader's own
   change to Salt-crust rubbings — a new picture, a new name and a new
   description in ONE decision — because it is the case that proves the point:
   a card's sentence (`You want to change the chat's name, picture and
   description`) cannot carry a picture or a paragraph, and nobody should vote
   on words they have not read. One board holds all three parts — the lane's
   call, flagged; the page scrolls and the frame is drawn tall, as the details'
   is:

   · WHAT WOULD CHANGE, WHOLE. `If it passes` shows the proposed version as the
     chronicle shows a version (`ChatVersionCard`): the picture, the name, who
     can join and the words, every one of them in full. THE NEW PICTURE RIDES
     THE CARD AT 80px (jakob 2026-09-24: not inlined whole) — the lane's scale
     call, flagged: the details' identity disc, the largest the chat's picture
     is ever drawn and so the size it will really be seen at, one rung above
     the chronicle's 64px. The post chronicle's full-width picture was not the
     precedent to take: a chat's picture is a disc, never a body. TAPPING IT
     OPENS THE VIEWER — the product's second-tap grammar for media — which is
     canonical's fullscreen viewer: the graph lands the tap on the `canonical`
     terminal, as `ChatThreadMedia`'s media tap does, and it becomes an
     ordinary edge when the round migrates (readme §14: a tree's graph stops
     at the tree). `The chat now` shows
     the current version under it, the same card. Never a diff — the
     change-histories rule: a reader compares two whole versions; the product
     does not mark which change mattered. For a decision about a person (the
     kick) this part is the member's row and one sentence of what happens to
     them; for a version's removal, the version itself (stated, not drawn).

   · EVERY VOTE, WHO AND WHICH WAY. Votes are public records, read one by one
     (api-spec.md, `Proposal.ballots`: "public and auditable"), so the list is
     people — newest first, the date each voted, `Agreed` or `Disagreed` on the
     trailing edge — and a tap opens the person. Over it, the plain count both
     ways: `3 agreed · 1 disagreed · 2 haven't voted`. GEEK MODE adds the
     weighted arithmetic both ways (`ExactTail`): 3 for and 3 against by role,
     6 of 14 cast, and what settles it. That is the honest centre of this
     fixture — three people agree and one does not, yet it stands level,
     because Mira's disagreement weighs 3. The note under the list says the two
     facts a reader needs to read it right: every vote is public, and each
     person's newest vote is the one that counts.

   · THE READER'S OWN VOTE, AND HOW TO CHANGE IT. `You agreed when you proposed
     it, on 20 September.` Two acts: `Disagree instead` — a newer ballot, the
     other way (the tally reads each person's newest: governance.md §3,
     api-spec.md's `prepareBallot`) — and `Take back your vote`, the
     zero-direction ballot (governance.md §3: "zero = withdrawal"; §4:
     "Withdrawing = a new ballot with direction zero"). THE DRAWN BEHAVIOUR
     FOLLOWS GOVERNANCE.MD: api-spec.md's ballot input does not yet accept ZERO,
     and that gap is the implementation's to close — it is already on the
     ledger. Both acts open the vote's small seal (`ChatAgreeSheet`, the nouns
     swapped); neither signs on the tap. THE CHANGE ACT HAS TWO STATES: it
     names the other direction, so it reads `Disagree instead` over an
     agreement, as drawn, and `Agree instead` over a disagreement. A reader
     who has not voted meets `Disagree` and `Agree` here instead, the card's
     pair. THIS PAGE IS WHERE A VOTE IS REVISED: a card the reader has voted on
     shows only the readout (`You agreed`) and opens this page.

   THE STATUS LINE says who proposed it and when, and that it is open. A
   settled decision keeps this page — its votes stay public — with `passed on
   {date}` or `failed on {date}` in the status line and no acts (stated).

   Nothing here names a proposal, a ballot or a tally; the numbers of weight
   paint only in geek mode. */
export const FRAME = { width: 390, height: 960 };

export function Screen() {
  return (
    <>
      <PageHeader title="Decision" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 24px 4px" }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
            {CHANGE_LINE}
          </h1>
          <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
            Proposed by you on 20 September · open
          </span>
        </div>

        <SectionLabel>If it passes</SectionLabel>
        <div style={{ padding: "0 16px" }}>
          <ChatVersionCard {...SALT_PRINTS} pictureDoor />
        </div>
        <SectionLabel>The chat now</SectionLabel>
        <div style={{ padding: "0 16px" }}>
          <ChatVersionCard {...SALT_CRUST} />
        </div>

        <SectionLabel>Votes</SectionLabel>
        <p style={{ margin: 0, padding: "0 24px 4px", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          3 agreed · 1 disagreed · 2 haven't voted
          <ExactTail
            exact={` · by role 3 for, 3 against — 6 of 14 cast (${ROLE_WEIGHTS}); either side past half the cast settles it`}
            spoken={`By role — ${ROLE_WEIGHTS} — 3 for and 3 against, 6 of 14 cast; either side past half of the cast settles it`}
          />
        </p>
        <VoteRows votes={CHANGE_VOTES} />
        <div style={{ padding: "4px 24px 0" }}>
          <QuietNote>Every vote is a public record. Each person's newest vote is the one that counts.</QuietNote>
        </div>

        <SectionLabel>Your vote</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>You agreed when you proposed it, on 20 September.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" size="sm">
              Disagree instead
            </Button>
            <Button variant="text" size="sm">
              Take back your vote
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
