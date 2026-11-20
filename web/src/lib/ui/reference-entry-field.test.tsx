// The reference section (D15, D20). Named apart
// from the 2.3 tag-entry suite on purpose: the two sections are
// siblings, and a failure should say which one broke.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { newReferenceDraft, type ReferenceDraft } from "@/lib/references/draft";
import { ReferenceEntryField } from "./reference-entry-field";

function mention(id: string, handle: string): ReferenceDraft {
  return newReferenceDraft(id, {
    kind: "User",
    label: `@${handle}`,
    href: `/u/${handle}`,
  });
}

describe("ReferenceEntryField", () => {
  function renderSection(
    references: readonly ReferenceDraft[],
    onChange = vi.fn(),
    cap: number | null = 10,
    onOpenPicker = vi.fn(),
  ) {
    render(
      <ReferenceEntryField
        references={references}
        onChange={onChange}
        cap={cap}
        testIdPrefix="compose"
        onOpenPicker={onOpenPicker}
      />,
    );
    return onChange;
  }

  it("opens the host's picker from the add door, even at the batch cap", () => {
    const onOpenPicker = vi.fn();
    const full = Array.from({ length: 10 }, (_, i) => mention(`u-${i}`, `u${i}`));
    renderSection(full, vi.fn(), 10, onOpenPicker);
    const door = screen.getByTestId("compose-reference-add");
    expect(door).not.toBeDisabled();
    fireEvent.click(door);
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("compose-reference-cap")).not.toBeInTheDocument();
  });

  it("removes a drafted reference from its chip", () => {
    const onChange = renderSection([mention("u-ada", "ada"), mention("u-bob", "bob")]);
    fireEvent.click(screen.getByTestId("compose-reference-0-remove"));
    const [remaining] = onChange.mock.calls[0] as [readonly ReferenceDraft[]];
    expect(remaining.map((reference) => reference.targetId)).toEqual(["u-bob"]);
  });

  it("opens a chip's own sliders and reports the state on the label", () => {
    renderSection([mention("u-ada", "ada")]);
    const label = screen.getByTestId("compose-reference-0-select");
    expect(label).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(label);
    expect(label).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("compose-reference-0-relevance")).toBeInTheDocument();
    expect(screen.getByTestId("compose-reference-0-support")).toBeInTheDocument();
  });

  it("tunes one chip's parameters without touching the others", () => {
    const onChange = renderSection([mention("u-ada", "ada"), mention("u-bob", "bob")]);
    fireEvent.click(screen.getByTestId("compose-reference-1-select"));
    fireEvent.change(screen.getByTestId("compose-reference-1-support"), {
      target: { value: "-0.5" },
    });
    const [next] = onChange.mock.calls[0] as [readonly ReferenceDraft[]];
    expect(next[0].support).toBe(0.1);
    expect(next[1].support).toBe(-0.5);
  });

  it("routes a field-level refusal onto the offending chip", () => {
    render(
      <ReferenceEntryField
        references={[mention("u-ada", "ada"), mention("u-bob", "bob")]}
        onChange={vi.fn()}
        fieldErrors={{ 1: "That target can't be referenced." }}
        testIdPrefix="compose"
        onOpenPicker={vi.fn()}
      />,
    );
    expect(screen.getByTestId("compose-reference-error-1")).toHaveTextContent(
      "That target can't be referenced.",
    );
    expect(screen.queryByTestId("compose-reference-error-0")).not.toBeInTheDocument();
  });

  // THE COMPOSER'S HOST (ComposeDetails.md): a staged citation's pair is set
  // in `RefPair`, committed on Done and dropped on every other way out.
  describe("on the composer — the pair in its sheet", () => {
    function SheetHost({ initial }: { initial: readonly ReferenceDraft[] }) {
      const [references, setReferences] = useState(initial);
      return (
        <>
          <ReferenceEntryField
            references={references}
            onChange={setReferences}
            cap={10}
            testIdPrefix="compose"
            onOpenPicker={vi.fn()}
            pairs="sheet"
          />
          <output data-testid="state">
            {JSON.stringify(
              references.map(({ targetId, relevance, support }) => ({ targetId, relevance, support })),
            )}
          </output>
        </>
      );
    }
    const staged = () =>
      JSON.parse(screen.getByTestId("state").textContent ?? "[]") as {
        targetId: string;
        relevance: number;
        support: number;
      }[];
    const pairSheet = () => screen.getByTestId("compose-reference-pair") as HTMLDialogElement;

    it("opens the citation's pair in a sheet titled by it, and Done carries the pair", () => {
      render(<SheetHost initial={[mention("u-ada", "ada"), mention("u-bob", "bob")]} />);
      fireEvent.click(screen.getByTestId("compose-reference-1-select"));
      expect(pairSheet().open).toBe(true);
      expect(pairSheet()).toHaveAttribute("aria-label", "@bob");
      // No sliders stand under the chip — the pair is the sheet's.
      expect(screen.queryByTestId("compose-reference-1-relevance")).not.toBeInTheDocument();
      expect(screen.getByTestId("compose-reference-pair-exact")).toHaveTextContent("+0.10 / +0.10");

      fireEvent.click(screen.getByTestId("compose-reference-pair-exact-route"));
      fireEvent.change(screen.getByTestId("compose-reference-pair-tracks-interest"), {
        target: { value: "-0.5" },
      });
      // Nothing reaches the staged citation while the sheet is up.
      expect(staged()[1]!.support).toBe(0.1);
      fireEvent.click(screen.getByTestId("compose-reference-pair-done"));
      expect(staged()).toEqual([
        { targetId: "u-ada", relevance: 0.1, support: 0.1 },
        { targetId: "u-bob", relevance: 0.1, support: -0.5 },
      ]);
    });

    it("drops what the sheet staged on a scrim tap or a close request", () => {
      render(<SheetHost initial={[mention("u-ada", "ada")]} />);
      fireEvent.click(screen.getByTestId("compose-reference-0-select"));
      fireEvent.click(screen.getByTestId("compose-reference-pair-exact-route"));
      fireEvent.change(screen.getByTestId("compose-reference-pair-tracks-directed"), {
        target: { value: "0.9" },
      });
      fireEvent.click(pairSheet());
      expect(staged()[0]).toEqual({ targetId: "u-ada", relevance: 0.1, support: 0.1 });

      fireEvent.click(screen.getByTestId("compose-reference-0-select"));
      fireEvent.click(screen.getByTestId("compose-reference-pair-exact-route"));
      fireEvent.change(screen.getByTestId("compose-reference-pair-tracks-directed"), {
        target: { value: "0.9" },
      });
      act(() => pairSheet().close());
      expect(staged()[0]).toEqual({ targetId: "u-ada", relevance: 0.1, support: 0.1 });
    });

    it("takes a citation out on the spot from its ×, with no dialog", () => {
      render(<SheetHost initial={[mention("u-ada", "ada")]} />);
      fireEvent.click(screen.getByTestId("compose-reference-0-remove"));
      expect(staged()).toEqual([]);
      expect(screen.queryByTestId("compose-reference-pair")).not.toBeInTheDocument();
    });
  });
});
