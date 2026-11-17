// The client-side mirror of the server's canonicalization
// (hashtag.md §1; crates/common/src/hashtag.rs `canonicalize`): strip one
// leading `#`, lowercase (pure-ASCII names — the only ones the atom
// admits — lowercase identically on both sides), then require the L1 identifier atom —
// ASCII `[A-Za-z0-9._-]`, 1..=128 bytes. Whitespace is NOT trimmed and
// non-ASCII is refused, never encoded (D3, rulings 2026-08-26).
//
// This is a PREVIEW, not a validator: the server's field-level
// `userErrors` on `["tags", i, "name"]` are the authoritative refusal.
// The tag picker reads it to show what a name will become and to refuse an
// illegal one at the field (`readTagName`, which owns the words) — nothing
// here deduplicates or otherwise second-guesses the server (rulings: "don't
// build client-side validation beyond the mirror").

const TAG_ATOM = /^[A-Za-z0-9._-]{1,128}$/;
/** The atom's length bound, in bytes — ASCII-only, so also in characters. */
export const TAG_NAME_MAX = 128;

export type TagPreview = {
  /** The name as it would land after the server's own canonicalization. */
  readonly canonical: string;
  /** Whether `canonical` satisfies the L1 atom charset and length bound. */
  readonly valid: boolean;
};

export function previewTagName(raw: string): TagPreview {
  const stripped = raw.startsWith("#") ? raw.slice(1) : raw;
  const canonical = stripped.toLowerCase();
  return { canonical, valid: TAG_ATOM.test(canonical) };
}

/** D18: the creation-batch cap, mirrored client-side (server is authoritative). */
export const TAG_BATCH_CAP = 10;
