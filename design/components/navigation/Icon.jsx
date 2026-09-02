import React from "react";

/* The product's Material glyphs, ALL INLINED — no icon font, no external request,
   which is what the product itself does (`web/src/lib/ui/icons.tsx` inlines path
   data; Android draws from `material-icons-extended`).

   Path data is verbatim from Google's material-design-icons set (Apache-2.0),
   classic FILLED 24px variant — the same set and variant the product cites — and
   every glyph here also exists as a file in `assets/icons/`. Nothing is redrawn or
   traced: if a glyph is missing, it gets exported, not invented.

   ONE EXCEPTION: `graph_3` exists only in the newer Material *Symbols* set, so it
   keeps that set's `0 -960 960 960` viewBox. Material ships no FILL-1 cut of it,
   so this is a DERIVED one — the same official path with the node counters closed,
   which turns the six hairline rings into solid dots and matches the weight of the
   filled set. Derived, not redrawn: the geometry is Google's, only the counters
   are gone. It now sits in a row with other glyphs without reading lighter.

   `person` is the one glyph with two cuts, because the bar's selected slot takes
   the filled one. Otherwise: one weight, one fill style throughout — mixing fills
   is the most common way an icon set starts to look accidental.

   An icon never carries meaning alone: every icon-only control has a label. */

const PATHS = {
  dynamic_feed: [
    "M8,8H6v7c0,1.1,0.9,2,2,2h9v-2H8V8z",
    "M20,3h-8c-1.1,0-2,0.9-2,2v6c0,1.1,0.9,2,2,2h8c1.1,0,2-0.9,2-2V5C22,3.9,21.1,3,20,3z M20,11h-8V7h8V11z",
    "M4,12H2v7c0,1.1,0.9,2,2,2h9v-2H4V12z",
  ],
  person: ["M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"],
  person_outline: [
    "M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  ],
  add: ["M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"],
  search: [
    "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  ],
  wallet: [
    "M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
  ],
  settings: [
    "M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z",
  ],
  visibility: [
    "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  ],
  visibility_off: [
    "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
  ],
  /* Direction-sensitive: Android wraps it AutoMirrored for RTL. If RTL ever ships,
     mirror this one with a transform at the call site — do not add a second path. */
  arrow_back: ["M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"],
  more_vert: [
    "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  ],
  /* The comments affordance on a card. Filled, so it sits at the same weight as
     the rest of the row. */
  chat_bubble: ["M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"],
  /* The checkbox's mark, and only that: never a selection indicator on a chip
     (a check reflows every label in the row) and never decoration. */
  check: ["M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"],
  /* The one control a video wears. `volume_up` means sound is ON — the glyph shows
     the CURRENT state, and the accessible name says what the tap will do. */
  volume_up: [
    "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
  ],
  volume_off: [
    "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z",
  ],
  /* THE NODE-TYPE GLYPHS (readme §13, 2026-08-28): a reference row leads with
     its node's kind. People wear their avatar and a media post its cover, so
     these cover the rest — proposal, item, campaign, offer, chat — one per
     kind, silhouettes deliberately distinct (an item is a box, an offer the
     price tag). A text post wears the letter T as a tile, not a glyph. */
  how_to_vote: [
    "M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.89 2 1.99 2H19c1.1 0 2-.89 2-2v-4l-3-3zm-1-5.05l-4.95 4.95-3.54-3.54 4.95-4.95L17 7.95zm-4.24-5.66L6.39 8.66c-.39.39-.39 1.02 0 1.41l4.95 4.95c.39.39 1.02.39 1.41 0l6.36-6.36c.39-.39.39-1.02 0-1.41L14.16 2.3c-.38-.4-1.01-.4-1.4-.01z",
  ],
  inventory_2: [
    "M20,2H4C3,2,2,2.9,2,4v3.01C2,7.73,2.43,8.35,3,8.7V20c0,1.1,1.1,2,2,2h14c0.9,0,2-0.9,2-2V8.7c0.57-0.35,1-0.97,1-1.69V4 C22,2.9,21,2,20,2z M15,14H9v-2h6V14z M20,7H4V4h16V7z",
  ],
  campaign: [
    "M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z",
  ],
  sell: [
    "M21.41,11.41l-8.83-8.83C12.21,2.21,11.7,2,11.17,2H4C2.9,2,2,2.9,2,4v7.17c0,0.53,0.21,1.04,0.59,1.41l8.83,8.83 c0.78,0.78,2.05,0.78,2.83,0l7.17-7.17C22.2,13.46,22.2,12.2,21.41,11.41z M6.5,8C5.67,8,5,7.33,5,6.5S5.67,5,6.5,5S8,5.67,8,6.5 S7.33,8,6.5,8z",
  ],
  forum: [
    "M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z",
  ],
  /* A chat MESSAGE, distinct from the chat that holds it (`forum`). */
  send: ["M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"],
  /* The compose media surfaces' glyphs (media slice, 2026-08-31). */
  close: ["M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"],
  /* Authoring-side only: a composer's video preview says it is a video and can
     be played. A READING surface never draws play/pause — presence on screen
     is the policy there (MediaAttachment). */
  play_arrow: ["M8 5v14l11-7z"],
  /* The avatar's change badge (profile round, 2026-09-01). The official cut
     draws its lens as a <circle>; PATHS holds paths only, so that circle is
     carried as an exact arc path — same geometry, nothing redrawn. */
  photo_camera: [
    "M12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 1 1 0-6.4z",
    "M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
  ],
  /* The chronicle's tab glyphs (profile round, 2026-09-01): `dynamic_feed` is
     already the posts idea, `chat_bubble` the comment's; `history` is the whole
     record — everything, newest first. */
  history: [
    "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
  ],
  drag_indicator: [
    "M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  ],
  lock: [
    "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  ],
  expand_more: ["M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"],
  /* The wallet's glyphs (item 12). `arrow_outward` is the direction badge —
     outgoing as drawn, incoming rotated 180° by the badge that wears it. */
  chevron_right: ["M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"],
  arrow_outward: ["M6 6v2h8.59L5 17.59 6.41 19 16 9.41V18h2V6z"],
  content_copy: [
    "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  ],
  /* The Post Score's glyph. A branching graph: the score comes out of the graph,
     and the branches hint at the paths folded up behind the number. Material
     Symbols only, and the FILL-1 cut is derived (see the top of this file) —
     hence the other viewBox. */
  graph: [
    "M480-80q-50 0-85-35t-35-85q0-5 .5-11t1.5-11l-83-47q-16 14-36 21.5t-43 7.5q-50 0-85-35t-35-85q0-50 35-85t85-35q24 0 45 9t38 25l119-60q-3-23 2.5-45t19.5-41l-34-52q-7 2-14.5 3t-15.5 1q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 20-6.5 38.5T456-688l35 52q8-2 15-3t15-1q17 0 32 4t29 12l66-54q-4-10-6-20.5t-2-21.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-17 0-32-4.5T699-617l-66 55q4 10 6 20.5t2 21.5q0 50-35 85t-85 35q-24 0-45.5-9T437-434l-118 59q2 9 1.5 18t-2.5 18l84 48q16-14 35.5-21.5T480-320q50 0 85 35t35 85q0 50-35 85t-85 35Z",
  ],
};

/* Only `graph` departs from the classic 24×24 box. */
const VIEWBOX = { graph: "0 -960 960 960" };

/* The mark, as a glyph. Geometry copied VERBATIM from assets/cogra-mark.svg — the
   source of truth — and never redrawn: the bowl circle, the descender path, and
   the pick. `pickColor` defaults to the loud surface, matching the standalone
   mark; pass "currentColor" for a monochrome cut. */
function Mark({ size, pickColor, style }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={style}>
      <circle cx="50" cy="38.35" r="22.52" fill="none" stroke="currentColor" strokeWidth="15.66" />
      <path
        d="M72.520 17.220 L72.520 62.560 C72.450 63.280 72.340 65.460 72.090 66.870 C71.830 68.290 71.480 69.710 70.980 71.050 C70.470 72.390 69.830 73.720 69.060 74.920 C68.280 76.130 67.360 77.280 66.330 78.270 C65.300 79.270 64.110 80.150 62.880 80.890 C61.660 81.620 60.310 82.210 58.950 82.690 C57.600 83.170 56.180 83.500 54.760 83.740 C53.340 83.980 51.890 84.080 50.450 84.140 C49.010 84.200 47.560 84.170 46.120 84.090 C44.680 84.020 42.520 83.760 41.810 83.690"
        fill="none"
        stroke="currentColor"
        strokeWidth="15.66"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="53.53" cy="34.82" r="8.52" fill={pickColor} />
    </svg>
  );
}

/* THE SEMANTIC GLYPH ATOMS (readme §13, Masters/variants/atoms). A MEANING is
   assigned its glyph exactly once, here — a surface never picks a glyph for a
   node kind on its own, it asks this map. Swap one assignment (a chat message
   moved from `forum` to `send`, 2026-08-28) and every screen that draws that
   meaning updates. Kinds whose mark is not a glyph (a person's avatar, a media
   post's cover, the text post's T tile, the topic's #) are `NodeMark`'s
   business, in `content/ReferenceRow.jsx`. */
export const NODE_GLYPHS = {
  comment: "chat_bubble",
  proposal: "how_to_vote",
  item: "inventory_2",
  campaign: "campaign",
  offer: "sell",
  chat: "forum",
  message: "send",
};

export function Icon({ name, size = 24, pickColor = "var(--surface-loud)", style }) {
  if (name === "mark") return <Mark size={size} pickColor={pickColor} style={style} />;
  const paths = PATHS[name];
  if (paths === undefined) return null;
  return (
    <svg
      viewBox={VIEWBOX[name] ?? "0 0 24 24"}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      style={{ flex: "none", ...style }}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
