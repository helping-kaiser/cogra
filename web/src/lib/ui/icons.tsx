// The product's Material glyphs, ALL INLINED — no icon font, no external
// request (design.md §5). Path data is verbatim from Google's
// material-design-icons set (Apache-2.0), classic FILLED 24px variant, and is
// the same data `design/components/navigation/Icon.jsx` carries, glyph for
// glyph. Nothing here is redrawn or traced: a missing glyph gets exported from
// the official set, never invented.
//
// ONE EXCEPTION: `graph` exists only in the newer Material *Symbols* set, so it
// keeps that set's `0 -960 960 960` viewBox. Material ships no FILL-1 cut of
// it, so this is a DERIVED one — the same official path with the node counters
// closed, which turns the six hairline rings into solid dots and matches the
// weight of the filled set.
//
// `person` is the one glyph with two cuts, because the bar's selected slot
// takes the filled one. Otherwise one weight and one fill style throughout —
// mixing fills is the most common way an icon set starts to look accidental.
//
// AN ICON NEVER CARRIES MEANING ALONE: every icon-only control has a label.

const PATHS = {
  dynamic_feed: [
    "M8,8H6v7c0,1.1,0.9,2,2,2h9v-2H8V8z",
    "M20,3h-8c-1.1,0-2,0.9-2,2v6c0,1.1,0.9,2,2,2h8c1.1,0,2-0.9,2-2V5C22,3.9,21.1,3,20,3z M20,11h-8V7h8V11z",
    "M4,12H2v7c0,1.1,0.9,2,2,2h9v-2H4V12z",
  ],
  person: [
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  ],
  person_outline: [
    "M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  ],
  add: ["M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"],
  // Direction-sensitive: if RTL ever ships, mirror this one with a transform at
  // the call site — never add a second path.
  arrow_back: ["M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"],
  close: [
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  ],
  more_vert: [
    "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  ],
  // The comments affordance on a card. Filled, so it sits at the same weight as
  // the rest of the row.
  chat_bubble: ["M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"],
  // The chat that HOLDS messages, distinct from a comment on a post — the
  // affordance the band carries on every tab root.
  forum: [
    "M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z",
  ],
  // Handing a post to the OS share sheet.
  share: [
    "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z",
  ],
  // The transport pair. Where a clip is the thing the reader came for — the
  // detail view, the fullscreen viewer — it carries play/pause and a timeline.
  // A FEED CARD draws neither: presence on screen is the policy there.
  play_arrow: ["M8 5v14l11-7z"],
  pause: ["M6 19h4V5H6v14zm8-14v14h4V5h-4z"],
  // The transport's flanking skips. Material ships `replay_10`/`forward_10`
  // with the numerals as separate glyph paths; the plain double-triangles carry
  // the same meaning at this size without path data no one can check.
  fast_rewind: ["M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"],
  fast_forward: ["M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"],
  // `volume_up` means sound is ON — the glyph shows the CURRENT state, and the
  // accessible name says what the tap will do.
  volume_up: [
    "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
  ],
  volume_off: [
    "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z",
  ],
  // The Post Score's glyph. A branching graph: the score comes out of the
  // graph, and the branches hint at the paths folded up behind the number.
  graph: [
    "M480-80q-50 0-85-35t-35-85q0-5 .5-11t1.5-11l-83-47q-16 14-36 21.5t-43 7.5q-50 0-85-35t-35-85q0-50 35-85t85-35q24 0 45 9t38 25l119-60q-3-23 2.5-45t19.5-41l-34-52q-7 2-14.5 3t-15.5 1q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 20-6.5 38.5T456-688l35 52q8-2 15-3t15-1q17 0 32 4t29 12l66-54q-4-10-6-20.5t-2-21.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-17 0-32-4.5T699-617l-66 55q4 10 6 20.5t2 21.5q0 50-35 85t-85 35q-24 0-45.5-9T437-434l-118 59q2 9 1.5 18t-2.5 18l84 48q16-14 35.5-21.5T480-320q50 0 85 35t35 85q0 50-35 85t-85 35Z",
  ],
} as const;

/** Only `graph` departs from the classic 24×24 box. */
const VIEWBOX: Partial<Record<keyof typeof PATHS, string>> = {
  graph: "0 -960 960 960",
};

export type GlyphName = keyof typeof PATHS;
export type IconName = GlyphName | "mark";

// The mark, as a glyph. Geometry copied VERBATIM from the design system's
// `assets/cogra-mark.svg` — the source of truth — and never redrawn: the bowl
// circle, the descender path, and the pick. `pickColor` defaults to the loud
// surface, matching the standalone mark; pass "currentColor" for a monochrome
// cut.
function Mark({
  size,
  pickColor,
  className,
}: {
  size: number;
  pickColor: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
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

export function Icon({
  name,
  size = 24,
  className,
  pickColor = "var(--surface-loud)",
}: {
  name: IconName;
  size?: number;
  className?: string;
  /** The mark's pick only; ignored by every other glyph. */
  pickColor?: string;
}) {
  if (name === "mark") return <Mark size={size} pickColor={pickColor} className={className} />;
  return (
    <svg
      viewBox={VIEWBOX[name] ?? "0 0 24 24"}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className ? `flex-none ${className}` : "flex-none"}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
