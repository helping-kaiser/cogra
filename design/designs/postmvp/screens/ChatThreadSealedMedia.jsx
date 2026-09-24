/* ENCRYPTED PICTURES, KEYED AND NOT — the E2E media faces (round B3 of the
   chats work, the integration round; chats.md §7's encrypted-attachments
   clause).

   AN ENCRYPTED MESSAGE ENCRYPTS ITS ATTACHMENTS. The sender's device encrypts
   the picture's bytes under the chat's epoch key before upload, so carriage
   holds ciphertext only and the witness binds those bytes.

   THE KEYED FACE — Mira's picture of this morning, sent with the lock on. A
   member holding the epoch's key sees it exactly as a plaintext picture
   (`ChatThreadMedia`'s comment-scale inset), with the quiet lock by the time
   and nothing else to say so: the rule that the lock is on every encrypted
   message, readable or not.

   THE NO-KEY FACE — Kel's picture of 21 September, sealed under an epoch from
   before the reader joined: `NoKeyMedia`, the reserved tile a kept space
   wears, the lock on it and `An encrypted picture — you don't have the key to
   see it.` The tile claims no shape (the ratio rides the sealed payload) and
   has NO SECOND TAP — no viewer, and no `Show the encrypted text` twin: cipher
   text is at least characters, cipher pixels are nothing. A reader outside the
   chat meets every encrypted picture this way; a member meets it only across
   an epoch they were not in.

   THE IMPLEMENTATION CONSEQUENCE (the implementation session's flag, carried):
   CLIENT-SIDE PROCESSING IS THE ONLY QUALITY ENFORCEMENT FOR ENCRYPTED CHAT
   BLOBS. No server transcode, resize or thumbnail path exists for them — the
   server holds no key — so what the sender's device uploads is what every
   keyed member downloads, and the still a clip wears is extracted on the
   device before encryption or not at all (`NoKeyMedia`'s docblock). */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>21 September</DayDivider>
        <ChatBubble author={CHAT_KEL} when="18:55" sealed fill>
          <NoKeyMedia kind="picture" />
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="07:52" sealed media={{ src: "gallery-honey.jpg", ratio: "square", alt: "A pot of dark honey with a wooden dipper resting in it." }}>
          The heather honey is in — members get first pick before the stand.
        </ChatBubble>
        <ChatBubble own when="07:58">
          Put one aside for me.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}
