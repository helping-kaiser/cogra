import React from "react";

/* The actor chip / row and its avatar (design.md §6): the compact
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

   THE NAME SLOT SPEAKS IN THE SYSTEM'S VOICE, NOT THE PERSON'S. `Deleted
   account` in `text-secondary`, because it is the product saying what happened
   and not somebody's chosen name; drawn at full strength it would read as an
   account actually called that. The handle goes altogether: it was redacted at
   execution and the stored form is a uniqueness device, so printing anything
   there would be inventing a handle the reader could try to reach. */

/* The word in the name's place, assigned once. The moderation variant is
   proposed and unblessed (guidelines/copy-voice.md, awaiting blessing) — the
   two must stay distinguishable, because collapsing them lets a verdict hide
   behind a person's own decision (`erasure.md` §7, and `RedactedContent`'s two
   reasons). */
export const REDACTED_ACTOR_NAME = "Deleted account";

export function MonogramAvatar({ name, size = "sm", src, redacted = false }) {
  const [failed, setFailed] = React.useState(false);
  const initial = redacted ? null : (name ?? "").trim().charAt(0).toUpperCase() || "?";
  const box =
    typeof size === "number"
      ? { height: `${size}px`, width: `${size}px`, fontSize: size >= 56 ? "var(--text-headline-small)" : "var(--text-label-large)" }
      : size === "lg"
        ? { height: "64px", width: "64px", fontSize: "var(--text-headline-small)" }
        : size === "md"
          ? { height: "32px", width: "32px", fontSize: "var(--text-label-medium)" }
          : { height: "24px", width: "24px", fontSize: "var(--text-label-small)" };
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
        color: "var(--on-secondary-container)",
        fontWeight: 500,
      }}
    >
      {src && !failed && !redacted ? (
        <img src={src} alt="" onError={() => setFailed(true)} style={{ height: "100%", width: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        initial
      )}
    </span>
  );
}

export function ActorChip({ handle, displayName, href, onClick, avatarSrc, redacted = false }) {
  const name = redacted ? REDACTED_ACTOR_NAME : displayName && displayName.trim() ? displayName : handle;
  return (
    <a
      href={href ?? `/u/${handle}`}
      onClick={onClick}
      className="cg-state cg-focus"
      style={{
        display: "inline-flex",
        minHeight: "24px",
        alignItems: "center",
        gap: "var(--space-2)",
        color: "var(--on-surface)",
        textDecoration: "none",
        borderRadius: "var(--radius-full)",
      }}
    >
      <MonogramAvatar name={name} src={avatarSrc} redacted={redacted} />
      <span
        style={{
          fontSize: "var(--text-label-large)",
          fontWeight: "var(--text-label-large--font-weight)",
          color: redacted ? "var(--text-secondary)" : undefined,
        }}
      >
        {name}
      </span>
      {!redacted && <span style={{ fontSize: "var(--text-label-medium)", color: "var(--text-secondary)" }}>@{handle}</span>}
    </a>
  );
}
