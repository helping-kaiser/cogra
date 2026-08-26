import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TAG_NAME_MAX } from "@/lib/topics/normalize";
import type { TagDraft } from "@/lib/topics/draft";
import { TagEntryField } from "./tag-entry-field";

/** The field is controlled; the harness holds the state and shows it. */
function Harness({
  initial = [],
  cap,
  fieldErrors,
}: {
  initial?: readonly TagDraft[];
  cap?: number | null;
  fieldErrors?: Readonly<Record<number, string>>;
}) {
  const [tags, setTags] = useState<readonly TagDraft[]>(initial);
  return (
    <>
      <TagEntryField
        tags={tags}
        onChange={setTags}
        cap={cap}
        fieldErrors={fieldErrors}
        testIdPrefix="t"
      />
      <output data-testid="state">{JSON.stringify(tags)}</output>
    </>
  );
}

function staged(): readonly TagDraft[] {
  return JSON.parse(screen.getByTestId("state").textContent ?? "[]") as readonly TagDraft[];
}

function type(value: string) {
  fireEvent.change(screen.getByTestId("t-tag-input"), { target: { value } });
}

describe("TagEntryField — the input-time gate (F1)", () => {
  it("adds a canonicalized name on a legal draft", () => {
    render(<Harness />);
    type("#Rust");
    expect(screen.getByTestId("t-tag-add")).toBeEnabled();
    fireEvent.click(screen.getByTestId("t-tag-add"));
    expect(staged()).toEqual([{ name: "rust", relevance: 0.1, confidence: 1 }]);
    // The draft clears, so the next name starts fresh.
    expect(screen.getByTestId("t-tag-input")).toHaveValue("");
  });

  it("blocks a name with a space and says so", () => {
    render(<Harness />);
    type("bot defense");
    expect(screen.getByTestId("t-tag-add")).toBeDisabled();
    expect(screen.getByTestId("t-tag-preview")).toHaveTextContent(/space/i);
    expect(screen.getByTestId("t-tag-preview")).toHaveAttribute("role", "alert");
  });

  it("blocks a non-ASCII name and names the charset", () => {
    render(<Harness />);
    type("münchen");
    expect(screen.getByTestId("t-tag-add")).toBeDisabled();
    expect(screen.getByTestId("t-tag-preview")).toHaveTextContent(/ASCII/);
  });

  it("blocks an over-long name and names the bound", () => {
    render(<Harness />);
    type("a".repeat(TAG_NAME_MAX + 1));
    expect(screen.getByTestId("t-tag-add")).toBeDisabled();
    expect(screen.getByTestId("t-tag-preview")).toHaveTextContent(/too long/i);
  });

  it("refuses the Enter shortcut too, not just the button", () => {
    render(<Harness />);
    type("bot defense");
    fireEvent.keyDown(screen.getByTestId("t-tag-input"), { key: "Enter" });
    expect(staged()).toEqual([]);
  });

  it("previews the canonical form while the name is still legal", () => {
    render(<Harness />);
    type("#Rust");
    expect(screen.getByTestId("t-tag-preview")).toHaveTextContent("Will add as #rust");
    expect(screen.getByTestId("t-tag-preview")).not.toHaveAttribute("role", "alert");
  });

  it("caps the creation batch, and does not cap where there is no batch", () => {
    const { unmount } = render(<Harness cap={2} />);
    type("one");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    type("two");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    expect(screen.getByTestId("t-tag-cap")).toBeInTheDocument();
    type("three");
    expect(screen.getByTestId("t-tag-add")).toBeDisabled();
    unmount();

    render(<Harness cap={null} />);
    type("one");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    expect(screen.queryByTestId("t-tag-cap")).not.toBeInTheDocument();
    type("two");
    expect(screen.getByTestId("t-tag-add")).toBeEnabled();
  });

  it("renders a server field error on the offending chip (F2)", () => {
    render(
      <Harness
        initial={[
          { name: "rust", relevance: 0.1, confidence: 1 },
          { name: "a-b", relevance: 0.1, confidence: 1 },
        ]}
        fieldErrors={{ 1: "`a-b` is not a legal topic name" }}
      />,
    );
    expect(screen.getByTestId("t-tag-error-1")).toHaveTextContent(
      "`a-b` is not a legal topic name",
    );
    expect(screen.queryByTestId("t-tag-error-0")).not.toBeInTheDocument();
  });
});

describe("TagEntryField — the parameter sliders (F6)", () => {
  it("opens both sliders on the server's defaults, keyboard-reachable and labelled", () => {
    render(<Harness />);
    const relevance = screen.getByTestId("t-tag-new-relevance");
    const confidence = screen.getByTestId("t-tag-new-confidence");
    expect(relevance).toHaveAttribute("type", "range");
    expect(relevance).toHaveAttribute("min", "-1");
    expect(relevance).toHaveAttribute("max", "1");
    expect(relevance).toHaveValue("0.1");
    expect(confidence).toHaveAttribute("min", "0");
    expect(confidence).toHaveAttribute("max", "1");
    expect(confidence).toHaveValue("1");
    // The visible label is also the accessible name, value included.
    expect(screen.getByLabelText(/Relevance \+0\.10/)).toBe(relevance);
    expect(screen.getByLabelText(/Confidence 1\.00/)).toBe(confidence);
  });

  it("carries the slider values onto the tag it adds", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("t-tag-new-relevance"), { target: { value: "0.8" } });
    fireEvent.change(screen.getByTestId("t-tag-new-confidence"), { target: { value: "0.25" } });
    type("rust");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    expect(staged()).toEqual([{ name: "rust", relevance: 0.8, confidence: 0.25 }]);
  });

  it("resets to the defaults for the next tag", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("t-tag-new-relevance"), { target: { value: "-0.5" } });
    type("rust");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    type("wasm");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    expect(staged()).toEqual([
      { name: "rust", relevance: -0.5, confidence: 1 },
      { name: "wasm", relevance: 0.1, confidence: 1 },
    ]);
  });

  it("opens a chip's own sliders when the chip is tapped, and edits that tag", () => {
    render(<Harness />);
    type("rust");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    expect(screen.queryByTestId("t-tag-0-relevance")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("t-tag-0-select"));
    expect(screen.getByTestId("t-tag-0-select")).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByTestId("t-tag-0-relevance"), { target: { value: "-1" } });
    expect(staged()).toEqual([{ name: "rust", relevance: -1, confidence: 1 }]);

    // Tapping again closes it.
    fireEvent.click(screen.getByTestId("t-tag-0-select"));
    expect(screen.queryByTestId("t-tag-0-relevance")).not.toBeInTheDocument();
  });

  it("removes a chip", () => {
    render(<Harness />);
    type("rust");
    fireEvent.click(screen.getByTestId("t-tag-add"));
    fireEvent.click(screen.getByTestId("t-tag-0-remove"));
    expect(staged()).toEqual([]);
  });
});
