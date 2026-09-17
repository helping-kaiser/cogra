/* INTRO 3 OF 5 — EVERYTHING HERE IS PUBLIC (jakob's ruling, the batch-rulings
   round; backlog item 74). His sketch: "chat between two others and some comment
   pointing at the lovely message in the chat".

   IT IS DRAWN TIMELESS (jakob's ruling, verbatim: "nah timeless.. chats come
   soon and thats the first thing where users would not expect publicness").
   No soon-hint, no dated wording — the card exists precisely BECAUSE a chat is
   the last place a reader expects to be readable, so the drawing states the
   rule rather than a roadmap.

   THE CHAT IS BETWEEN TWO OTHERS, never the reader. A reader shown their own
   chat being quoted learns a threat; a reader shown someone else's learns the
   rule, which is the thing this card is for. The comment beneath points at one
   message and cites it — the ordinary public act, done to a chat.

   THE CHAT IS AN ILLUSTRATION, THE COMMENT IS A LIKENESS. Chats are not built,
   so the bubbles are drawn with whatever reads as a chat (the intro block's
   ruling); the comment beneath carries `CommentCard`'s own anatomy — face,
   handle, age, the quoted line above the words — at the system's fills and
   corners. */

const STAGE = { width: 342, height: 372 };

const BUBBLE = {
  position: "absolute",
  boxSizing: "border-box",
  padding: "8px 12px",
  fontSize: "var(--text-body-small)",
  lineHeight: "var(--text-body-small--line-height)",
  letterSpacing: "var(--text-body-small--letter-spacing)",
};

export function Screen() {
  return (
    <IntroFrame
      step={3}
      headline="Everything here is public"
      lines={["Posts, comments, opinions — and chats. Anything written on CoGra can be read, and cited, by anyone."]}
    >
      <IntroStage {...STAGE}>
        {/* The chat, as a chat: a panel of bubbles between two people the
            reader is not. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 342,
            height: 224,
            boxSizing: "border-box",
            borderRadius: "var(--radius-large)",
            background: "var(--surface-container)",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <MonogramAvatar name="Ada Okonkwo" src="comment-camera.jpg" />
            <MonogramAvatar name="Tobias Lindqvist" />
            <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}>
              @ada and @tobias
            </span>
          </div>
        </div>
        <div style={{ ...BUBBLE, left: 12, top: 48, width: 214, borderRadius: "16px 16px 16px 4px", background: "var(--surface-container-highest)" }}>
          Crust held all the way past the slipway today.
        </div>
        <div style={{ ...BUBBLE, left: 140, top: 108, width: 190, textAlign: "right", borderRadius: "16px 16px 4px 16px", background: "var(--surface-container-high)" }}>
          Then it is walkable at six.
        </div>
        <div
          style={{
            ...BUBBLE,
            left: 12,
            top: 160,
            width: 230,
            borderRadius: "16px 16px 16px 4px",
            background: "var(--surface-loud)",
            color: "var(--on-surface-loud)",
          }}
        >
          The gulls left the tideline to us for once.
        </div>

        {/* The comment points back up at the message it cites. */}
        <IntroLines {...STAGE}>
          <path d="M 200 268 C 200 240, 248 236, 248 216" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="243,216 253,216 248,206" fill="var(--border-field)" />
        </IntroLines>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 270,
            width: 342,
            boxSizing: "border-box",
            borderRadius: "var(--radius-medium)",
            background: "var(--surface-card)",
            border: "1px solid var(--border-hairline)",
            padding: "10px var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <MonogramAvatar name="Sol Ferreira" />
            <span style={{ flex: 1, fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)" }}>
              @sol
            </span>
            <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>2h</span>
          </div>
          <div
            style={{
              margin: "8px 0 0",
              paddingLeft: "var(--space-3)",
              borderLeft: "2px solid var(--border-field)",
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              color: "var(--text-secondary)",
            }}
          >
            The gulls left the tideline to us for once.
          </div>
          <div style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Best line anyone has written about the flats.
          </div>
        </div>
      </IntroStage>
    </IntroFrame>
  );
}
