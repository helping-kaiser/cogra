/* INVITES, EMPTY — and this is the state most readers will meet. A cohort of
   friends invites rarely, so the teaching surface is not the populated list:
   it is this one, and it is the only place in the product where the whole
   mechanic can be said in three lines to somebody who has never used it.

   WHAT THE LINES CARRY is the one thing no other social has. Everywhere else a
   share link is a share link; here it does two separable things, and a reader
   who conflates them will be surprised by the second. So they are said apart:
   the LINK makes an account possible, and the VOUCH — the reader's own signed
   opinion, given at approval — is what actually brings the person in. `Vouch`
   is the product's word and a reader's unfamiliar one, so it is explained
   where it stands, in half a sentence, rather than left to be guessed.

   `brings them in` IS THE PRODUCT'S OWN PHRASE, taken from `VouchBack`,
   `ApplicantWaiting` and `VouchedIn` rather than coined here. The rounder
   phrasings for what a new member joins are either banned vocabulary or a word
   `ProfileHeader` rules out; the boards already had the right words.

   THE EMPTY-STATE IDIOM, kept: a calm statement and the single action that
   fills it, outlined and left-aligned, never a scold and never a sell. */
export function Screen() {
  return (
    <>
      <PageHeader title="Invites" backHref="/profile" backLabel="Back to your profile" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 24px 32px" }}>
        <EmptyState
          title="No invites out yet. A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in."
          actionLabel="Create invite"
          onAction={() => {}}
        />
      </div>
    </>
  );
}
