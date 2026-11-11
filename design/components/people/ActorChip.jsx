import React from "react";

/* The actor chip / row and its avatar (readme §7): the compact
   person-or-group reference every author attribution renders as, opening the
   actor's profile. A Collective looks like a person but reads as a shared
   identity.

   MEDIA AVATARS (backlog item 5). A photo, where the person has set one, in the
   same circle at the same two sizes. The monogram — the first grapheme of the
   display name, in `secondaryContainer` on `onSecondaryContainer` — is not a gap
   waiting for a photo: it is the DESIGNED fallback, and it is what a person
   without one keeps. A broken image falls back to it silently; a torn-photo glyph
   would tell the reader about a fetch they cannot do anything about.

   The avatar is decorative either way: the adjacent text names the actor, so the
   photo carries no alt text and never becomes the only way to tell two people
   apart.

   THE REDACTED ACTOR (`redacted`, the review-fix round; `erasure.md` §2–3).
   When an account is deleted the ACTOR STAYS — it is still the author of
   everything it signed, still carries the standing others vouched into it,
   still routes — and only the identity payloads go: display name, handle,
   avatar. So every place that draws an actor keeps drawing one; it draws it
   WITHOUT A NAME. That is what `redacted` is, and it is assigned here because
   the treatment has to follow the actor everywhere it appears — a chip on a
   post, a row in a list, the header of their own page — and a treatment spelled
   per surface is a treatment that drifts.

   THE DISC KEEPS ITS SPACE AND FILLS WITH NOTHING. A monogram is the first
   letter of a name and there is no name to take one from; inventing a glyph
   would be inventing imagery where there is no source (readme §4). So the disc
   is the reserved surface — the same one a redaction mark and an unloaded tile
   use — which says a space was kept rather than lost.

   THE KEPT SPACE WEARS A RING, ONE TREATMENT ON EVERY SURFACE (jakob
   2026-11-11: it "must work on all surfaces we have so we dont need different
   colors for different screens"). The reserved fill alone is the sheet's own
   tone (1.00:1 there) and at most 1.28:1 against any surface, so the disc
   keeps that fill and gains a 1px solid ring in `--border-field`, which
   clears 3:1 against every surface in both themes (readme §13, round 31).
   The ring is drawn inside the disc's box: a deleted account's disc measures
   what a live one does at every size. `NodeMark`'s removed tile takes the
   same ring (`REDACTED_RING`).

   THE NAME SLOT SPEAKS IN THE SYSTEM'S VOICE, NOT THE PERSON'S. `Deleted
   account` in `text-secondary`, because it is the product saying what happened
   and not somebody's chosen name; drawn at full strength it would read as an
   account actually called that. The handle goes altogether: it was redacted at
   execution and the stored form is a uniqueness device, so printing anything
   there would be inventing a handle the reader could try to reach. */

/* The kept space's ring, assigned once (above): every mark whose payload went
   wears it, inside its own box. */
export const REDACTED_RING = { border: "1px solid var(--border-field)", boxSizing: "border-box" };

/* The word in the name's place, assigned once. The moderation variant is
   proposed and unblessed (guidelines/copy-voice.md, awaiting blessing) — the
   two must stay distinguishable, because collapsing them lets a verdict hide
   behind a person's own decision (`erasure.md` §7, and `RedactedContent`'s two
   reasons). */
export const REDACTED_ACTOR_NAME = "Deleted account";

/* THE HIDE ROW NAMES ITS PERSON, AND A REDACTED ONE HAS NO NAME TO PUT THERE
   (jakob 2026-09-11). Every menu that offers hiding spells the handle —
   `Hide @ada`, the word a reader scans for — and on a deleted author's post,
   comment or profile there is no handle left to spell; the stored form is a
   uniqueness device, so printing anything there would invent a handle the
   reader could try to reach.

   THE ROW ITSELF STAYS. Hiding is a read-side comfort about an ACTOR, and the
   actor is still there, still signing, still ranking into the reader's feed —
   so the act is exactly as useful as it was and only its wording gives way:
   `Hide this account`, the system saying what the tap does when it cannot say
   whose.

   IT IS COMPOSED HERE, beside the name it stands in for, because every menu
   that carries the row builds its label from an actor and a fallback spelled
   per menu is a fallback that drifts — the same reason `redacted` itself is
   assigned on this master. Menus take their label from here; no board and no
   client writes the words twice. */
export const HIDE_ACTOR_LABEL = (handle, redacted = false) =>
  redacted || !handle ? "Hide this account" : `Hide ${handle}`;

/* THE LETTER'S ROLE FOLLOWS THE DISC'S SIZE, ONE RULE (round 35, jakob
   2026-11-11, T12; backlog 152). 24px takes label-small; 32px label-medium,
   the named `md` size's role, and a numeric 32 takes the same; 64px and every
   numeric size from 56px up headline-small; any other numeric size
   label-large. THE WEIGHT IS THE DISC'S OWN: every letter stands at 500
   whatever its role says, the large discs' headline-small included (jakob,
   round 32: "all fine"), so a monogram reads at one weight at every size. */
export function MonogramAvatar({ name, size = "sm", src, redacted = false, node }) {
  const [failed, setFailed] = React.useState(false);
  const initial = redacted ? null : (name ?? "").trim().charAt(0).toUpperCase() || "?";
  const role = typeof size === "number" ? (size >= 56 ? "headline-small" : size === 32 ? "label-medium" : "label-large") : null;
  const box =
    typeof size === "number"
      ? { height: `${size}px`, width: `${size}px`, fontSize: `var(--text-${role})`, lineHeight: `var(--text-${role}--line-height)`, letterSpacing: `var(--text-${role}--letter-spacing)`, fontWeight: `var(--text-${role}--font-weight)` }
      : size === "lg"
        ? { height: "64px", width: "64px", fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", letterSpacing: "var(--text-headline-small--letter-spacing)", fontWeight: "var(--text-headline-small--font-weight)" }
        : size === "md"
          ? { height: "32px", width: "32px", fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", letterSpacing: "var(--text-label-medium--letter-spacing)", fontWeight: "var(--text-label-medium--font-weight)" }
          : { height: "24px", width: "24px", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", fontWeight: "var(--text-label-small--font-weight)" };
  return (
    <span
      aria-hidden="true"
      style={{
        ...box,
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: "var(--radius-full)",
        background: redacted ? "var(--surface-container-high)" : "var(--secondary-container)",
        ...(redacted ? REDACTED_RING : null),
        color: "var(--on-secondary-container)",
        fontWeight: 500,
      }}
      data-node={node}
    >
      {src && !failed && !redacted ? (
        <img src={src} alt="" onError={() => setFailed(true)} style={{ height: "100%", width: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        initial
      )}
    </span>
  );
}

/* THE ROW NEVER WRAPS AND NEVER CROWDS (jakob's ruling, 2026-09-23). A name
   too long for the room ELLIPSIZES; the handle is the identity and stays
   whole until it alone cannot fit, and only then ellipsizes too. The chip
   yields (`minWidth: 0`) and whatever stands beside it — timestamp, ⋮ —
   keeps its full width and the row's gap as the hard floor. The two-stage
   yield is flexbox's own arithmetic: the name's `flexShrink: 999` absorbs
   the squeeze ahead of the handle's 1, so the handle gives way only after
   the name is spent. Every list row and card reads this one law from here —
   no board and no client re-decides it. */
export function ActorChip({ handle, displayName, href, onClick, avatarSrc, redacted = false, node }) {
  const name = redacted ? REDACTED_ACTOR_NAME : displayName && displayName.trim() ? displayName : handle;
  const clip = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
  return (
    <a
      href={href ?? `/u/${handle}`}
      onClick={onClick}
      className="cg-state cg-focus"
      style={{
        display: "inline-flex",
        minHeight: "24px",
        minWidth: 0,
        alignItems: "center",
        gap: "var(--space-2)",
        color: "var(--on-surface)",
        textDecoration: "none",
        borderRadius: "var(--radius-full)",
      }}
      data-node={node}
    >
      <MonogramAvatar name={name} src={avatarSrc} redacted={redacted} node={node && "avatar"} />
      {/* The name sets label-large whole (seam 245, ask 7): left to the page
          it took body-large's 24px leading and 0.5px tracking, where the
          role's are 20px and 0.1px. */}
      <span
        style={{
          ...clip,
          flexShrink: 999,
          fontSize: "var(--text-label-large)",
          lineHeight: "var(--text-label-large--line-height)",
          letterSpacing: "var(--text-label-large--letter-spacing)",
          fontWeight: "var(--text-label-large--font-weight)",
          color: redacted ? "var(--text-secondary)" : undefined,
        }}
        data-node={node && "name"}
      >
        {name}
      </span>
      {!redacted && <span style={{ ...clip, flexShrink: 1, fontSize: "var(--text-label-medium)", lineHeight: "var(--text-label-medium--line-height)", letterSpacing: "var(--text-label-medium--letter-spacing)", fontWeight: "var(--text-label-medium--font-weight)", color: "var(--text-secondary)" }} data-node={node && "handle"}>@{handle}</span>}
    </a>
  );
}

/* A NAME INSIDE A ONE-LINE PLACE (jakob 2026-11-11, round 40). A page title, a
   menu row, a row's title and its aside never wrap; where a handle stands in
   their words — `@ada commented on your post`, `Hide @ada`, `on @mira` — the
   HANDLE is what is cut with "…", and the words around it keep their room
   first: `@mmmmmmmm… commented on your post`. The chip's own arithmetic at line
   scale: the words are `flex: none`, the handle the one part that yields
   (`minWidth: 0` and the clip). Every one-line master clips its own line at
   the end ("…", the why-line's way — `Through @ada`) and passes its text
   through `nameInLine`: where the handle ENDS the line (`Hide @ada`, `on
   @mira`, a title that is only `@ada`) the end clip already cuts the handle
   and keeps the words, so the text returns untouched; only words AFTER the
   handle split the line, so a line that fits draws exactly what it drew. The
   first handle is the one that yields. */
const HANDLE_IN_LINE = /(?<![\w@])@[A-Za-z0-9_]+/;
const LINE_WORDS = { flex: "none", whiteSpace: "pre" };
export function nameInLine(text) {
  if (typeof text !== "string") return text;
  const found = HANDLE_IN_LINE.exec(text);
  if (!found) return text;
  const before = text.slice(0, found.index);
  const after = text.slice(found.index + found[0].length);
  if (!after.trim()) return text;
  return (
    <span style={{ display: "flex", minWidth: 0, whiteSpace: "nowrap" }} data-name-line="">
      {before && <span style={LINE_WORDS}>{before}</span>}
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{found[0]}</span>
      {after && <span style={LINE_WORDS}>{after}</span>}
    </span>
  );
}
