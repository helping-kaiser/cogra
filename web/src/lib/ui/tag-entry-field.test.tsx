import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TagDraft } from "@/lib/topics/draft";
import { TAG_NAME_CHARSET_REFUSAL } from "@/lib/topics/picker";
import { TagEntryField } from "./tag-entry-field";

/** The field is controlled; the harness holds the state and shows it. */
function Harness({
  initial = [],
  fieldErrors,
  onOpenPicker = () => {},
}: {
  initial?: readonly TagDraft[];
  fieldErrors?: Readonly<Record<number, string>>;
  onOpenPicker?: () => void;
}) {
  const [tags, setTags] = useState<readonly TagDraft[]>(initial);
  return (
    <>
      <TagEntryField
        tags={tags}
        onChange={setTags}
        fieldErrors={fieldErrors}
        onOpenPicker={onOpenPicker}
        testIdPrefix="t"
      />
      <output data-testid="state">{JSON.stringify(tags)}</output>
    </>
  );
}

function staged(): readonly TagDraft[] {
  return JSON.parse(screen.getByTestId("state").textContent ?? "[]") as readonly TagDraft[];
}

// jakob 2026-11-13 (seam 327): there is no inline typed tag entry. `+ Add a
// tag` opens the picker, the only place a tag name is typed; an empty name
// shows no line.
describe("TagEntryField — the picker is the only way in", () => {
  it("draws no typed entry: no field, no Add button, no preview, no sliders", () => {
    render(<Harness />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("t-tag-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("t-tag-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("t-tag-cap")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("shows no line at all while nothing is staged", () => {
    render(<Harness />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("t-tag-entry")).toHaveTextContent(/^Tags\+ Add a tag$/);
  });

  it("opens the picker from + Add a tag", () => {
    const onOpenPicker = vi.fn();
    render(<Harness onOpenPicker={onOpenPicker} />);
    const add = screen.getByTestId("t-tag-add");
    expect(add).toHaveTextContent("+ Add a tag");
    fireEvent.click(add);
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it("carries a staged act's refusal on the offending chip, in the words it was given", () => {
    render(
      <Harness
        initial={[
          { name: "rust", relevance: 0.1, confidence: 1 },
          { name: "a-b", relevance: 0.1, confidence: 1 },
        ]}
        fieldErrors={{ 1: TAG_NAME_CHARSET_REFUSAL }}
      />,
    );
    expect(screen.getByTestId("t-tag-error-1")).toHaveTextContent(TAG_NAME_CHARSET_REFUSAL);
    expect(screen.queryByTestId("t-tag-error-0")).not.toBeInTheDocument();
  });
});

// THE PAIR IN ITS SHEET (ComposeDetails.md, TagPadCompose.md, EditCompose.md,
// CommentEdit.md): a chip's pair is set in its sheet, and nothing the sheet
// stages reaches the chip but through Done.
describe("TagEntryField — the pair in its sheet", () => {
  const pairSheet = () => screen.getByTestId("t-tag-pair") as HTMLDialogElement;
  const setRelevance = (value: string) => {
    fireEvent.click(screen.getByTestId("t-tag-pair-exact-route"));
    fireEvent.change(screen.getByTestId("t-tag-pair-tracks-directed"), { target: { value } });
  };

  it("opens the tag's pair in a sheet titled by it — no sliders under the chip", () => {
    render(<Harness initial={[{ name: "rust", relevance: 0.1, confidence: 1 }]} />);
    fireEvent.click(screen.getByTestId("t-tag-0-select"));
    expect(pairSheet().open).toBe(true);
    expect(pairSheet()).toHaveAttribute("aria-label", "#rust");
    expect(screen.getByTestId("t-tag-0-select")).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByTestId("t-tag-0-params")).not.toBeInTheDocument();
    expect(screen.getByTestId("t-tag-pair-exact")).toHaveTextContent("+0.10 / 1.00");
  });

  it("carries the sheet's pair onto the chip on Done, and only then", () => {
    render(
      <Harness
        initial={[
          { name: "rust", relevance: 0.1, confidence: 1 },
          { name: "wasm", relevance: 0.1, confidence: 1 },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("t-tag-1-select"));
    setRelevance("0.6");
    expect(staged()[1]).toEqual({ name: "wasm", relevance: 0.1, confidence: 1 });
    fireEvent.click(screen.getByTestId("t-tag-pair-done"));
    expect(staged()).toEqual([
      { name: "rust", relevance: 0.1, confidence: 1 },
      { name: "wasm", relevance: 0.6, confidence: 1 },
    ]);
    // A movement after the chip was added is kept, and the sheet reopens on it.
    fireEvent.click(screen.getByTestId("t-tag-1-select"));
    expect(screen.getByTestId("t-tag-pair-exact")).toHaveTextContent("+0.60 / 1.00");
  });

  it("keeps the chip's pair on a scrim tap or a close request", () => {
    render(<Harness initial={[{ name: "rust", relevance: 0.1, confidence: 1 }]} />);
    fireEvent.click(screen.getByTestId("t-tag-0-select"));
    setRelevance("0.9");
    fireEvent.click(pairSheet());
    expect(staged()).toEqual([{ name: "rust", relevance: 0.1, confidence: 1 }]);

    fireEvent.click(screen.getByTestId("t-tag-0-select"));
    setRelevance("0.9");
    act(() => pairSheet().close());
    expect(staged()).toEqual([{ name: "rust", relevance: 0.1, confidence: 1 }]);
  });

  it("takes a tag out on the spot from its ×, with no dialog", () => {
    render(<Harness initial={[{ name: "rust", relevance: 0.1, confidence: 1 }]} />);
    fireEvent.click(screen.getByTestId("t-tag-0-remove"));
    expect(staged()).toEqual([]);
    expect(screen.queryByTestId("t-tag-pair")).not.toBeInTheDocument();
  });
});
