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
   apart. */

export function MonogramAvatar({ name, size = "sm", src }) {
  const [failed, setFailed] = React.useState(false);
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";
  const box =
    typeof size === "number"
      ? { height: `${size}px`, width: `${size}px`, fontSize: "var(--text-label-large)" }
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
        background: "var(--secondary-container)",
        color: "var(--on-secondary-container)",
        fontWeight: 500,
      }}
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} style={{ height: "100%", width: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        initial
      )}
    </span>
  );
}

export function ActorChip({ handle, displayName, href, onClick, avatarSrc }) {
  const name = displayName && displayName.trim() ? displayName : handle;
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
      <MonogramAvatar name={name} src={avatarSrc} />
      <span style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}>{name}</span>
      <span style={{ fontSize: "var(--text-label-medium)", color: "var(--text-secondary)" }}>@{handle}</span>
    </a>
  );
}
