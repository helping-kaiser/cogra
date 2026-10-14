// One edit, one batch — the EditCompose family's shared law
// (design/designs/canonical/behavior/EditComposeUnchanged.md;
// design/readme.md:5564-5578).
//
// THE GUARD IS THE ACTS BATCH, NEVER A BYTE COMPARISON. An edit signs when its
// batch holds an act, and the edit record is one of those acts the moment the
// author first changes a field the record carries — typed into the title, the
// description or the words, moved a picture, flipped the mark. It STAYS staged
// after that, even if the field is typed back to what it was: comparing bytes
// would refuse the author who typed a word and took it back, accept the one
// whose only change is whitespace no record carries, and have to be re-derived
// per platform from the fields rather than read off the acts. The protocol
// accepts a priced no-op edit (crates/api/tests/content_path.rs
// `an_unchanged_post_edit_is_accepted_and_priced`), so signing one is lawful.
//
// Tags and citations are their OWN acts beside the record (D14): each is read
// off what the content arrived with against what the edit now holds, so a pick
// taken back off unstages itself rather than staging a second, cancelling one.
// A citation's withdrawal counts its real counter-records
// (`ReferenceClaim.withdrawalCost`), never one per gesture.

import {
  referenceChanges,
  type ReferenceChange,
  type ReferenceDraft,
} from "@/lib/references/draft";
import { tagChanges, type TagChange, type TagDraft } from "@/lib/topics/draft";

/** The kinds an edit stages, in the order the acts card lists them (copy-voice "The edit's acts"). */
export type EditActKind =
  | "edit"
  | "tagsAdded"
  | "tagsWithdrawn"
  | "tagsRevised"
  | "citationsAdded"
  | "citationsRevised"
  | "citationsWithdrawn"
  | "coverChanged";

/** One row of the acts card: a kind, what it names, and the records it signs. */
export type EditActRow = {
  readonly kind: EditActKind;
  readonly label: string;
  readonly value: string;
  readonly count: number;
  /** The singular noun the count is heard as — the row's, never its label's. */
  readonly noun: string;
};

const LABELS: Readonly<Record<EditActKind, string>> = {
  edit: "Edit",
  tagsAdded: "Tags added",
  tagsWithdrawn: "Tags withdrawn",
  tagsRevised: "Tags revised",
  citationsAdded: "Citations added",
  citationsRevised: "Citations revised",
  citationsWithdrawn: "Citations withdrawn",
  coverChanged: "Cover changed",
};

const ORDER: readonly EditActKind[] = [
  "edit",
  "tagsAdded",
  "tagsWithdrawn",
  "tagsRevised",
  "citationsAdded",
  "citationsRevised",
  "citationsWithdrawn",
  "coverChanged",
];

export type EditBatchInput = {
  /** Whether the edit record is staged — sticky once a field it carries moved. */
  readonly recordStaged: boolean;
  /** What the record names on its row: the post's title, or its words. */
  readonly recordName: string;
  readonly loadedTags: readonly TagDraft[];
  readonly tags: readonly TagDraft[];
  readonly loadedReferences: readonly ReferenceDraft[];
  readonly references: readonly ReferenceDraft[];
  /** A clip's new face — the video edit's own kind. */
  readonly coverChanged?: boolean;
};

function hashtag(name: string): string {
  return name.startsWith("#") ? name : `#${name}`;
}

/** The acts the batch holds, one row per kind present, in the card's order. */
export function editActRows(input: EditBatchInput): readonly EditActRow[] {
  const loadedTagNames = new Set(input.loadedTags.map((tag) => tag.name));
  const loadedRefIds = new Set(input.loadedReferences.map((ref) => ref.targetId));
  const rows = new Map<EditActKind, { names: string[]; count: number; noun: string }>();
  const add = (kind: EditActKind, name: string, count: number, noun: string) => {
    const row = rows.get(kind) ?? { names: [], count: 0, noun };
    row.names.push(name);
    row.count += count;
    rows.set(kind, row);
  };

  if (input.recordStaged) add("edit", input.recordName, 1, "edit");
  for (const change of tagChanges(input.loadedTags, input.tags)) {
    if (change.kind === "untag") add("tagsWithdrawn", hashtag(change.tag.name), 1, "tag");
    else if (loadedTagNames.has(change.tag.name)) add("tagsRevised", hashtag(change.tag.name), 1, "tag");
    else add("tagsAdded", hashtag(change.tag.name), 1, "tag");
  }
  for (const change of referenceChanges(input.loadedReferences, input.references)) {
    const name = change.reference.target.label;
    if (change.kind === "withdraw") {
      add("citationsWithdrawn", name, change.reference.withdrawalCost, "thing");
    } else if (loadedRefIds.has(change.reference.targetId)) {
      add("citationsRevised", name, 1, "citation");
    } else {
      add("citationsAdded", name, 1, "citation");
    }
  }
  if (input.coverChanged === true) add("coverChanged", "The clip's cover", 1, "cover");

  return ORDER.flatMap((kind) => {
    const row = rows.get(kind);
    return row === undefined
      ? []
      : [{ kind, label: LABELS[kind], value: row.names.join(", "), count: row.count, noun: row.noun }];
  });
}

/** What one signature commits, in records — the footer's and the sheet's one number. */
export function editActCount(rows: readonly EditActRow[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

/**
 * The foot's sentence (`ActsFooter.jsx`): `Nothing to sign yet` at zero — and
 * then the line is no control — `You're signing 1 thing`, `You're signing N
 * things`.
 */
export function actsFooterLine(count: number): string {
  if (count === 0) return "Nothing to sign yet";
  return count === 1 ? "You're signing 1 thing" : `You're signing ${count} things`;
}

/** The acts sheet's title (copy-voice "What one signature commits"). */
export function actsSheetTitle(count: number): string {
  return count === 1 ? "1 thing, signed" : `${count} things, signed together`;
}

/** The tags the edit withdrew — each a `Withdrawn:` line with its `Undo`. */
export function withdrawnTags(
  loaded: readonly TagDraft[],
  tags: readonly TagDraft[],
): readonly TagDraft[] {
  const kept = new Set(tags.map((tag) => tag.name));
  return loaded.filter((tag) => !kept.has(tag.name));
}

/** The citations the edit withdrew — each a `Withdrawn:` line with its `Undo`. */
export function withdrawnReferences(
  loaded: readonly ReferenceDraft[],
  references: readonly ReferenceDraft[],
): readonly ReferenceDraft[] {
  const kept = new Set(references.map((reference) => reference.targetId));
  return loaded.filter((reference) => !kept.has(reference.targetId));
}

/**
 * Undo on a `Withdrawn:` line: the item returns AS IT STOOD — the loaded
 * claim, its own parameters — so the withdrawal unstages and nothing new is
 * staged in its place.
 */
export function undoTagWithdrawal(
  loaded: readonly TagDraft[],
  tags: readonly TagDraft[],
  name: string,
): readonly TagDraft[] {
  const original = loaded.find((tag) => tag.name === name);
  if (original === undefined || tags.some((tag) => tag.name === name)) return tags;
  return [...tags, original];
}

export function undoReferenceWithdrawal(
  loaded: readonly ReferenceDraft[],
  references: readonly ReferenceDraft[],
  targetId: string,
): readonly ReferenceDraft[] {
  const original = loaded.find((reference) => reference.targetId === targetId);
  if (original === undefined || references.some((reference) => reference.targetId === targetId)) {
    return references;
  }
  return [...references, original];
}

/** The staged tag and citation changes, for the prepare loop. */
export function stagedChanges(input: EditBatchInput): {
  readonly tags: readonly TagChange[];
  readonly references: readonly ReferenceChange[];
} {
  return {
    tags: tagChanges(input.loadedTags, input.tags),
    references: referenceChanges(input.loadedReferences, input.references),
  };
}
