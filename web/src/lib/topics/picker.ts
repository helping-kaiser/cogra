// What the tag picker reads a typed name as (TagPicker, TagPickerTyping,
// TagPickerRefused; copy-voice *Tagging*).
//
// THE FIRST ROW IS THE TYPED NAME, CANONICALIZED — one leading `#` stripped,
// lowercased (hashtag.md §1) — whenever it is a legal name, and the field's
// action key stages it. A name outside the L1 identifier atom names no Type,
// so it is REFUSED at the field and no first row stands. An empty field is
// neither: the rule line stands under it and nothing is offered yet.
//
// This mirrors the server's canonicalization (`previewTagName`); the server's
// field refusal on `["tags", i, "name"]` stays the authority.

import { previewTagName, TAG_NAME_MAX } from "./normalize";

/** The naming rule, stated under the field at rest (TagPicker.jsx). */
export const TAG_NAME_RULE = "Letters, digits, dot, dash and underscore. Capitals become lowercase.";

/** The refusal for a character no name may carry (TagPickerRefused.md). */
export const TAG_NAME_CHARSET_REFUSAL = "A tag name is letters, digits, dot, dash and underscore.";

/** The refusal for a name past the atom's length (TagPickerRefused.md). */
export const TAG_NAME_LENGTH_REFUSAL = `A tag name is at most ${TAG_NAME_MAX} characters.`;

/** The footnote under the list, every state (TagPicker.jsx). */
export const TAG_PICKER_FOOTNOTE =
  "Any name works, used or not — nobody owns a tag. It is yours the moment you sign.";

export type TagNameReading =
  | { readonly kind: "empty" }
  | { readonly kind: "legal"; readonly canonical: string }
  | { readonly kind: "refused"; readonly refusal: string };

/** The typed name, as the picker draws it. */
export function readTagName(raw: string): TagNameReading {
  if (raw === "" || raw === "#") return { kind: "empty" };
  const preview = previewTagName(raw);
  if (preview.valid) return { kind: "legal", canonical: preview.canonical };
  // The charset refusal leads: a space is the refusal a reader reaches by
  // habit (TagPickerRefused.jsx), and it holds whatever the length.
  if (!/^[A-Za-z0-9._-]*$/.test(preview.canonical)) {
    return { kind: "refused", refusal: TAG_NAME_CHARSET_REFUSAL };
  }
  return { kind: "refused", refusal: TAG_NAME_LENGTH_REFUSAL };
}

/**
 * The line a server refusal of a staged tag's NAME reads as: the picker's own
 * refusal for that name (jakob 2026-11-13: the picker's two lines are the law,
 * and the server's text never reaches a reader). A name the client reads as
 * legal cannot be refused by a server that canonicalizes the same way; should
 * the two ever drift, the charset line — the atom's rule — stands.
 */
export function tagNameRefusal(name: string): string {
  const reading = readTagName(name);
  return reading.kind === "refused" ? reading.refusal : TAG_NAME_CHARSET_REFUSAL;
}

/** Whether a refusal names a tag's name — `["name"]` on a single Tag act, `["tags", i, "name"]` in a batch. */
export function refusesTagName(error: { readonly code: string; readonly field: readonly string[] | null }): boolean {
  return error.code === "BAD_INPUT" && error.field !== null && error.field[error.field.length - 1] === "name";
}

/** The first row's second line — the record the tap will sign (TagPickerTyping.md). */
export function signsAs(canonical: string): string {
  return `Signs as #${canonical}`;
}

/** The pickers' spoken moves (`PickAnnouncement`; TagPicker.jsx, ReferencePicker.jsx). */
export const PICK_ADDED = "Added — in the staged list.";
export const PICK_REMOVED = "Removed from the staged list.";
