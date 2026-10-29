// The edit family's batch (EditCompose.md, EditActs.md, EditComposeUnchanged.md):
// the acts every kind stages, each row counted in the records it signs, and
// the footer's one sentence over the same number.

import { describe, expect, it } from "vitest";

import { newReferenceDraft, type ReferenceDraft } from "@/lib/references/draft";
import { newTagDraft, type TagDraft } from "@/lib/topics/draft";
import {
  actsFooterLine,
  actsSheetTitle,
  editActCount,
  editActRows,
  undoReferenceWithdrawal,
  undoTagWithdrawal,
  withdrawnReferences,
  withdrawnTags,
  type EditBatchInput,
} from "./edit-batch";

function citation(id: string, label: string, withdrawalCost = 1): ReferenceDraft {
  return {
    ...newReferenceDraft(id, { kind: "Post", label, href: `/posts/${id}` }),
    withdrawalCost,
  };
}

const standing: readonly TagDraft[] = [newTagDraft("fieldnotes"), newTagDraft("coastroad")];
const cited: readonly ReferenceDraft[] = [citation("r1", "Tide tables — @juno", 2)];

function batch(overrides: Partial<EditBatchInput> = {}): EditBatchInput {
  return {
    recordStaged: false,
    recordName: "Salt maps",
    loadedTags: standing,
    tags: standing,
    loadedReferences: cited,
    references: cited,
    ...overrides,
  };
}

describe("the edit batch", () => {
  it("an_untouched_edit_holds_no_act", () => {
    const rows = editActRows(batch());
    expect(rows).toEqual([]);
    expect(editActCount(rows)).toBe(0);
    expect(actsFooterLine(0)).toBe("Nothing to sign yet");
  });

  it("counts the board's five: the edit, a tag added, a tag withdrawn, a citation withdrawn at two", () => {
    const rows = editActRows(
      batch({
        recordStaged: true,
        tags: [newTagDraft("fieldnotes"), newTagDraft("saltmaps")],
        references: [],
      }),
    );
    expect(rows.map((row) => [row.label, row.value, row.count])).toEqual([
      ["Edit", "Salt maps", 1],
      ["Tags added", "#saltmaps", 1],
      ["Tags withdrawn", "#coastroad", 1],
      ["Citations withdrawn", "Tide tables — @juno", 2],
    ]);
    expect(editActCount(rows)).toBe(5);
    expect(actsFooterLine(5)).toBe("You're signing 5 things");
    expect(actsSheetTitle(5)).toBe("5 things, signed together");
  });

  it("names a re-tuned standing tag and citation as revised", () => {
    const rows = editActRows(
      batch({
        tags: [{ ...newTagDraft("fieldnotes"), relevance: 0.5 }, newTagDraft("coastroad")],
        references: [{ ...cited[0]!, relevance: 0.6 }],
      }),
    );
    expect(rows.map((row) => row.label)).toEqual(["Tags revised", "Citations revised"]);
    expect(editActCount(rows)).toBe(2);
  });

  it("speaks one thing in the singular", () => {
    expect(actsFooterLine(1)).toBe("You're signing 1 thing");
    expect(actsSheetTitle(1)).toBe("1 thing, signed");
  });

  it("a_pick_taken_back_in_the_same_edit_unstages_and_never_withdraws", () => {
    const picked = [...standing, newTagDraft("saltmaps")];
    expect(editActCount(editActRows(batch({ tags: picked })))).toBe(1);
    const dropped = picked.filter((tag) => tag.name !== "saltmaps");
    expect(editActRows(batch({ tags: dropped }))).toEqual([]);
    expect(withdrawnTags(standing, dropped)).toEqual([]);
  });

  it("undo_on_a_withdrawn_line_returns_the_item_as_it_stood_and_unstages", () => {
    const tuned = { ...newTagDraft("coastroad"), relevance: -0.4 };
    const loaded = [newTagDraft("fieldnotes"), tuned];
    const after = [newTagDraft("fieldnotes")];
    expect(withdrawnTags(loaded, after).map((tag) => tag.name)).toEqual(["coastroad"]);
    const restored = undoTagWithdrawal(loaded, after, "coastroad");
    expect(restored).toContainEqual(tuned);
    expect(editActRows(batch({ loadedTags: loaded, tags: restored }))).toEqual([]);

    expect(withdrawnReferences(cited, [])).toEqual(cited);
    const back = undoReferenceWithdrawal(cited, [], "r1");
    expect(back).toEqual(cited);
    expect(editActRows(batch({ references: back }))).toEqual([]);
  });

  // EditActs.jsx (round 24): a video edit's new face is no row — it rides the
  // Edit record, so a batch holding one reads the Edit row alone.
  it("a new face rides the Edit row and is no row of its own", () => {
    const rows = editActRows(batch({ recordStaged: true }));
    expect(rows.map((row) => [row.label, row.count])).toEqual([["Edit", 1]]);
    expect(rows.some((row) => row.label === "Cover changed")).toBe(false);
  });
});
