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

   THE BUBBLES READ LIKE A REAL CHAT, AND THE CHAT IS THE JOKE (jakob's second
   canvas pass: "lets find some meta jokes about meta and tiktok maybe?
   something funny"; the exchange below is his pick — "combo 1 it is"). Two
   friends notice the room they are standing in: one finds public chat weird,
   the other points out that Meta and TikTok read the "private" kind anyway,
   just quieter — and the quotable line invites the eavesdroppers to say hi.
   @sol's one-word comment IS an eavesdropper saying hi: the card's rule,
   demonstrated by the drawing instead of explained. Naming the two platforms
   is deliberate and jakob's own ask; the joke lands on their quietness, not
   on the reader. House capitalisation kept (confirmed): a real thumb's
   lowercase would be a second voice for fixture content.

   THE STAGE FLOWS; NOTHING IS PINNED. jakob's pass caught uneven gaps between
   hand-placed bubbles (the 2→3 gap ran half of 1→2), so the whole stage is
   now one flow column — panel, arrow spacer, comment — and the bubbles a flex
   column with one 12px gap: even spacing by construction, and a copy edit can
   never reopen the bug. The arrow's aim survives rewraps for the same reason
   (see the note at the spacer).

   THE CHAT IS AN ILLUSTRATION, THE COMMENT IS A LIKENESS. Chats are not built,
   so the bubbles are drawn with whatever reads as a chat (the intro block's
   ruling); the comment beneath carries `CommentCard`'s own anatomy — face,
   handle, age, the quoted line above the words — at the system's fills and
   corners. */

const STAGE = { width: 342, height: 396 };

const BUBBLE = {
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
            width: 342,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div style={{ ...BUBBLE, alignSelf: "flex-start", maxWidth: 226, borderRadius: "16px 16px 16px 4px", background: "var(--surface-container-highest)" }}>
              Feels weird chatting where anyone can read it.
            </div>
            <div style={{ ...BUBBLE, alignSelf: "flex-end", maxWidth: 236, textAlign: "right", borderRadius: "16px 16px 4px 16px", background: "var(--surface-container-high)" }}>
              Nobody here pretends my thumbs have privacy. Meta and TikTok just read quieter.
            </div>
            <div
              style={{
                ...BUBBLE,
                alignSelf: "flex-start",
                maxWidth: 250,
                borderRadius: "16px 16px 16px 4px",
                background: "var(--surface-loud)",
                color: "var(--on-surface-loud)",
              }}
            >
              At least our eavesdroppers can say hi.
            </div>
          </div>
        </div>

        {/* The comment points back up at the message it cites. The arrow lives
            in a fixed-height spacer BETWEEN the panel and the comment, so its
            aim survives any rewrap of the bubbles above: the quoted bubble is
            the panel's last child, so the spacer's top edge always sits 12px
            (the panel's own padding) under it. */}
        <svg aria-hidden="true" viewBox="0 0 342 46" width={342} height={46} style={{ display: "block" }}>
          <path d="M 200 46 C 200 30, 120 28, 120 12" stroke="var(--border-field)" strokeWidth="2" fill="none" />
          <polygon points="115,12 125,12 120,2" fill="var(--border-field)" />
        </svg>
        <div
          style={{
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
            At least our eavesdroppers can say hi.
          </div>
          <div style={{ margin: "8px 0 0", fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Hi.
          </div>
        </div>
      </IntroStage>
    </IntroFrame>
  );
}
