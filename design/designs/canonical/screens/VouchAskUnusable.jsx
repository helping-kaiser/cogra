/* A VOUCH, ASKED FOR — AND NO LONGER ANSWERABLE (the failure pack's
   `ASK_LINK_UNUSABLE`, copy-voice *Faults by code*; jakob 2026-10-01, backlog
   item 117; the audit's K3.8 names the board). Where an ask link lands a
   member when there is no one to answer: the id is unknown, the person who
   asked has already landed, or their application is already waiting on
   someone else (api-spec, `stageApplicant`).

   `JoinInvalid`'s CONSTRUCTION, at the ask's scale. The failure is said out
   loud in the heading and the paragraph, in the same shape as `This invite
   can't be used anymore`; the paragraph says what may have happened without
   claiming which, because the reader cannot tell and the answer does not
   change what they can do. Unlike `JoinInvalid` there is no field and no
   Continue: an ask link is not something the reader can replace with another
   one, so nothing is drawn that cannot be done.

   NO RETRY, NO PAD. An ask link never expires, so this is not a matter of
   time: asking again meets the same answer. The back arrow is the whole way
   out, `VouchAsk`'s own. It names nobody — a dead id may name no one, and an
   ask link carries a person, not a case file.

   THE WORDS ARE A DRAFT, flagged for blessing (copy-voice, *Faults by code*). */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          This ask can&apos;t be answered anymore
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          The person who asked may already be in, or someone else may already be answering them. Nothing here needs your
          signature.
        </p>
      </div>
    </>
  );
}
