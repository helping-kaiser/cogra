/* THE REPLY'S SEAL WITH THE KEY ELSEWHERE — the fallback (the reply pack,
   jakob 2026-09-30: "reply-scale seal fallback"; audit K6.3). The door
   (`ReplyKeyAbsent`) meets a reader whose key is elsewhere before they write;
   this is for the key that leaves while they are writing — a sign-out from
   another tab, a key the phone gave up. The words are already here, and a
   reply keeps no draft, so the seal says what is left: restore, or discard.

   IT IS `ReplySeal` WITH THE NOTICE WHERE THE FOOTER STOOD. Every row is
   unchanged — the read-back, the acts card, the stance, the license, the
   mark, the note — because everything the signature would commit is still
   read back; only the act that needs the key is replaced. `ReplySealBody` at
   `keyAbsent`, so the seal and its fallback cannot disagree about a row.

   THE NOTICE IS `KeyAbsentNotice`, the door's own, with the line this moment
   needs. TWO "?"s, BY THE STOPPER EXCEPTION (readme §13, *The failure fixes
   and the support stack*; jakob 2026-10-01): the missing key stops the one
   act the seal exists for, so the notice carries its own "?", naming the key,
   beside the header's, which explains signing — the shape `WriteRuleFailed`
   draws.

   `Discard the reply` IS THE OTHER WAY, and it asks first: a non-empty
   composer is asked through `DiscardConfirm`, from here as from the X.
   `ComposeKeyAbsent`'s "Keep the draft, restore later" has no place at reply
   scale — there is no draft to keep. `Restore the key` returns here, the
   reply intact.

   A PATTERN EXEMPLAR (readme §13, *Canvas pages and flows*): only the notice
   and the discard under it are this board's own; the header, the acts card
   and the rows are wired on `ReplySeal`. */
export function Screen() {
  return <ReplySealBody keyAbsent />;
}
