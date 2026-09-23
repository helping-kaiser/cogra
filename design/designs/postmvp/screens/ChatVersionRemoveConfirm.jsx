/* REMOVING ONE OF A CHAT'S VERSIONS — the think-twice dialog behind
   `Remove this version` on the chat's edit history (round B2 of the chats
   work, the governance round; jakob 2026-09-23: a chat's versions are
   removable by decision).

   `VersionRemoveConfirm`'S DIALOG, THE NOUNS SWAPPED (copy-voice: "the nouns
   swap per kind, nothing else moves"). The same surface, the same emphasis —
   `Keep it` filled, `Remove version` the quiet text button — the same question
   for a title, and the post's three facts in the chat's words: the version's
   name, picture and words leave every reader's view and a mark stays; the
   other versions keep standing; and if this is the current one the chat shows
   it removed — the head never falls through (erasure.md §1). No error colour:
   removing a picture nobody wanted public is what the member means to do.

   ONE PARAGRAPH MORE, AND IT IS THE CHAT'S. A chat has no author (chats.md §8),
   so no single hand removes one of its versions: the removal is the chat's
   decision, `decision:redact_version` (> 50% of the cast, a 20% quorum). The
   second paragraph says so in the thread's words, both outcomes at once —
   the role sheet's line, said for a removal:
   · INSTANT where the reader's say clears the gate. Here it does: the reader
     is Coast walkers' admin, 5 of the chat's 12 by role, past the 2.4 the
     quorum asks — so after the seal the version tombstones in place
     (`ChatHistoryRemoved`).
   · A PENDING CARD where it does not — `{name} wants to remove the version of
     10 September` in the thread and under `Open decisions`.

   `Remove version` OPENS THE REMOVAL'S SEAL, not the removal itself: the act
   is three records like every proposal — the removal, its link to the version,
   and the reader's own opinion for it, `3 things, signed together` —
   `ChatEditSeal`'s anatomy with the nouns swapped, NOT DRAWN AGAIN (the lane's
   call, flagged, as for the role sheet). The dialog asks whether; the seal
   says what is signed.

   A DOC TENSION, FLAGGED: chats.md §8 speaks of redacting "a superseded
   version's payload", while the details round's ruling puts `Remove this
   version` on every version, the current one included — and so does this
   dialog's last sentence of the first paragraph. The board follows the ruling;
   the doc wants the same words or the ruling wants narrowing.

   THE SURFACE BENEATH IS THE CHAT'S EDIT HISTORY, whole and inert. */
export const FRAME = { width: 390, height: 904 };

export function Screen() {
  return (
    <>
      <ChatHistoryBody />
      <DialogSurface ariaLabel="Remove this version?">
        <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
          Remove this version?
        </h2>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          Its name, picture and words leave every reader's view, and a mark stays in their place. The other versions keep standing. If this is the current version, the chat shows it as removed — an earlier version never takes its place.
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          The chat decides this together. If your say is enough, it's removed at once; if not, it waits in the chat until enough members agree.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Remove version</Button>
          <Button>Keep it</Button>
        </div>
      </DialogSurface>
    </>
  );
}
