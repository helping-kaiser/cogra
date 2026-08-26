// The client-side mirror of the server's canonicalization
// (hashtag.md §1; crates/common/src/hashtag.rs `canonicalize`): strip one
// leading `#`, lowercase (pure-ASCII names — the only ones the atom
// admits — lowercase identically on both sides), then require the L1 identifier atom —
// ASCII `[A-Za-z0-9._-]`, 1..=128 bytes. Whitespace is NOT trimmed and
// non-ASCII is refused, never encoded (D3, rulings 2026-08-26).
//
// This is a PREVIEW, not a validator: the server's field-level
// `userErrors` on `["tags", i, "name"]` are the authoritative refusal.
// The composer uses this only to show what a name will become, to gate
// the Add action on an obviously-illegal draft, and to say WHY while the
// name is still being typed (F1) — nothing here deduplicates or
// otherwise second-guesses the server (rulings: "don't build
// client-side validation beyond the mirror").

const TAG_ATOM = /^[A-Za-z0-9._-]{1,128}$/;
const TAG_CHARSET = /^[A-Za-z0-9._-]*$/;
/** The atom's length bound, in bytes — ASCII-only, so also in characters. */
export const TAG_NAME_MAX = 128;

export type TagPreview = {
  /** The name as it would land after the server's own canonicalization. */
  readonly canonical: string;
  /** Whether `canonical` satisfies the L1 atom charset and length bound. */
  readonly valid: boolean;
  /** Why an invalid draft is invalid, in the reader's words; null when valid. */
  readonly reason: string | null;
};

/**
 * The reason a draft cannot be added, most specific first: whitespace is
 * the charset failure people actually make, so it gets its own line
 * rather than the generic charset one.
 */
function reasonFor(canonical: string): string | null {
  if (canonical === "") return "Type a topic name.";
  if (/\s/.test(canonical)) return "Spaces aren't allowed in a topic name.";
  if (!TAG_CHARSET.test(canonical)) return "Only ASCII letters, digits, and . _ - are allowed.";
  if (canonical.length > TAG_NAME_MAX) return `Too long — at most ${TAG_NAME_MAX} characters.`;
  return null;
}

export function previewTagName(raw: string): TagPreview {
  const stripped = raw.startsWith("#") ? raw.slice(1) : raw;
  const canonical = stripped.toLowerCase();
  const reason = reasonFor(canonical);
  // The atom stays the authority on validity; `reason` only explains it.
  return { canonical, valid: TAG_ATOM.test(canonical), reason };
}

/** D18: the creation-batch cap, mirrored client-side (server is authoritative). */
export const TAG_BATCH_CAP = 10;
