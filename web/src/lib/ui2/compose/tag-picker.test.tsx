// The tag picker's behaviour, compiled line by line from its sidecars
// (design/designs/canonical/behavior/TagPicker.md, TagPickerTyping.md,
// TagPickerRefused.md). The picker is driven through a host that holds the
// composer's tags, so a stage made here is the composer's at once.

import { act, fireEvent, screen, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TagDraft } from "@/lib/topics/draft";
import {
  PICK_ADDED,
  PICK_REMOVED,
  TAG_NAME_CHARSET_REFUSAL,
  TAG_NAME_LENGTH_REFUSAL,
  TAG_NAME_RULE,
} from "@/lib/topics/picker";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { TagPicker } from "./tag-picker";
import type { PickerOrigin } from "./picker-rows";

/** The index answers the names in use that start with the typed one. */
function tagNames(...names: readonly string[]) {
  return gqlLink.query("TagNames", () =>
    HttpResponse.json({
      data: {
        search: {
          __typename: "SearchConnection",
          edges: names.map((name, i) => ({
            __typename: "SearchEdge",
            node: {
              __typename: "Hashtag",
              id: `h${i}`,
              name: { __typename: "ModeratedText", value: name },
            },
          })),
        },
      },
    }),
  );
}

// An index that knows no names is the default; a test that needs rows says so.
const server = startMswServer(tagNames());
const indexServes = (...names: readonly string[]) => server.use(tagNames(...names));

const draft = (name: string): TagDraft => ({ name, relevance: 0.1, confidence: 1 });

function Host({
  initial = [],
  onDone = () => {},
  origin,
  spy,
}: {
  initial?: readonly TagDraft[];
  onDone?: () => void;
  origin?: PickerOrigin;
  spy?: (tags: readonly TagDraft[]) => void;
}) {
  const [tags, setTags] = useState<readonly TagDraft[]>(initial);
  return (
    <TagPicker
      tags={tags}
      onTags={(next) => {
        spy?.(next);
        setTags(next);
      }}
      onDone={onDone}
      origin={origin}
      debounceMs={0}
    />
  );
}

const field = () => screen.getByRole("searchbox", { name: "Name a tag" });
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const status = () => screen.getByTestId(byNode("tagPicker.announcement"));
const stagedNames = () =>
  screen
    .queryAllByTestId(byNode("tagPicker.staged.tag"))
    .map((row) => row.getAttribute("data-testid-key"));
const rowNames = () =>
  screen.queryAllByTestId(byNode("tagPicker.tag")).map((row) => row.getAttribute("data-testid-key"));

/** Let the zero-wait index answer. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("TagPicker", () => {
  it("puts the canonicalized typed name first while it is a legal name", async () => {
    indexServes("saltmaps", "saltcrust");
    renderWithProviders(<Host />);
    type("#SaltMaps");
    await settle();
    // TagPickerTyping.md: the typed name canonicalized, with Signs as #name as
    // its second line; a name in use that IS the typed name stands as the
    // first row alone, never listed twice; the index's rows under it.
    expect(rowNames()).toEqual(["saltmaps", "saltcrust"]);
    const first = screen.getAllByTestId(byNode("tagPicker.tag"))[0]!;
    expect(within(first).getByText("Signs as #saltmaps")).toBeInTheDocument();
    // The mark node is the 32px tile itself, its ground and corner (TagPicker's `tag.mark`).
    expect(within(first).getByTestId(byNode("tagPicker.tag.mark", "saltmaps")).style.width).toBe("32px");
  });

  it("follows the name as it is typed", async () => {
    indexServes();
    renderWithProviders(<Host />);
    type("sa");
    await settle();
    expect(rowNames()).toEqual(["sa"]);
    type("salt");
    await settle();
    expect(rowNames()).toEqual(["salt"]);
  });

  it("stands the naming rule under the field while the name is legal", () => {
    renderWithProviders(<Host />);
    expect(screen.getByTestId(byNode("tagPicker.rule"))).toHaveTextContent(TAG_NAME_RULE);
    type("salt");
    expect(screen.getByTestId(byNode("tagPicker.rule"))).toHaveTextContent(TAG_NAME_RULE);
  });

  it("stands a staged tag only in the staged section above the list", async () => {
    indexServes("saltmarsh", "saltmaps");
    renderWithProviders(<Host initial={[draft("saltmarsh")]} />);
    type("salt");
    await settle();
    expect(stagedNames()).toEqual(["saltmarsh"]);
    expect(rowNames()).toEqual(["salt", "saltmaps"]);
  });

  it("stages the first row on the action key, announces it, and stays open", async () => {
    indexServes();
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host spy={spy} onDone={onDone} />);
    type("#Salt");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(spy).toHaveBeenLastCalledWith([draft("salt")]);
    expect(stagedNames()).toEqual(["salt"]);
    expect(rowNames()).toEqual([]);
    expect(status()).toHaveTextContent(PICK_ADDED);
    expect(onDone).not.toHaveBeenCalled();
    // The name stays in the field: the stage is seen right under it.
    expect(field()).toHaveValue("#Salt");
  });

  it("stages nothing on the action key while the name is refused", () => {
    const spy = vi.fn();
    renderWithProviders(<Host spy={spy} />);
    type("#salt maps");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(TAG_NAME_CHARSET_REFUSAL);
  });

  it("stages a tapped row, moves it into the staged section, and stays open", async () => {
    indexServes("saltmaps", "saltcrust");
    const spy = vi.fn();
    renderWithProviders(<Host spy={spy} />);
    type("salt");
    await settle();
    fireEvent.click(screen.getByTestId(byNode("tagPicker.tag", "saltcrust")));
    expect(spy).toHaveBeenLastCalledWith([draft("saltcrust")]);
    expect(stagedNames()).toEqual(["saltcrust"]);
    expect(rowNames()).toEqual(["salt", "saltmaps"]);
    expect(status()).toHaveTextContent(PICK_ADDED);
  });

  it("unstages a staged row on its ×, announces it, and stays open", async () => {
    indexServes("saltflats");
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[draft("saltflats")]} spy={spy} onDone={onDone} />);
    type("salt");
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Remove saltflats" }));
    expect(spy).toHaveBeenLastCalledWith([]);
    expect(stagedNames()).toEqual([]);
    // The row goes back to the list while the query still matches it.
    expect(rowNames()).toEqual(["salt", "saltflats"]);
    expect(status()).toHaveTextContent(PICK_REMOVED);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("closes on Done, keeping every staged tag and staging nothing typed", () => {
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[draft("salt")]} spy={spy} onDone={onDone} />);
    type("saltmaps");
    fireEvent.click(screen.getByTestId(byNode("tagPicker.done")));
    expect(onDone).toHaveBeenCalledTimes(1);
    // TagPickerTyping.md: NEVER the typed name is staged by leaving.
    expect(spy).not.toHaveBeenCalled();
  });

  it("closes on the header back, keeping every staged tag", () => {
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[draft("salt")]} spy={spy} onDone={onDone} />);
    type("#salt maps");
    fireEvent.click(screen.getByRole("button", { name: "Back to the post" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("names the arrow for the composer it returns to", () => {
    renderWithProviders(<Host origin="comment" />);
    expect(screen.getByRole("button", { name: "Back to the comment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to the post" })).toBeNull();
  });

  it("focuses the name field when it opens", () => {
    renderWithProviders(<Host />);
    expect(field()).toHaveFocus();
  });

  it("names its one ? Tagging, and opens that dialog", () => {
    renderWithProviders(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Tagging" }));
    expect(screen.getByTestId("tag-picker-help")).toHaveAttribute("open");
  });

  it("carries the footnote whatever is typed", () => {
    renderWithProviders(<Host />);
    expect(screen.getByTestId(byNode("tagPicker.footnote"))).toHaveTextContent(
      "Any name works, used or not — nobody owns a tag. It is yours the moment you sign.",
    );
    type("#salt maps");
    expect(screen.getByTestId(byNode("tagPicker.footnote"))).toBeInTheDocument();
  });
});

describe("TagPicker — a refused name", () => {
  it("wears the error ring and says why, in the rule line's place", () => {
    renderWithProviders(<Host />);
    type("#salt maps");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    const refusal = screen.getByRole("alert");
    expect(refusal).toHaveTextContent(TAG_NAME_CHARSET_REFUSAL);
    expect(field()).toHaveAttribute("aria-describedby", refusal.id);
    expect(screen.queryByTestId(byNode("tagPicker.rule"))).toBeNull();
  });

  it("refuses a name past 128 characters in its own words", () => {
    renderWithProviders(<Host />);
    type("a".repeat(129));
    expect(screen.getByRole("alert")).toHaveTextContent(TAG_NAME_LENGTH_REFUSAL);
  });

  it("stands no first row and an empty list without a message", () => {
    renderWithProviders(<Host />);
    type("#salt maps");
    expect(rowNames()).toEqual([]);
  });

  it("keeps the status message silent when the refusal appears", () => {
    renderWithProviders(<Host initial={[]} />);
    type("salt");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(status()).toHaveTextContent(PICK_ADDED);
    type("salt maps");
    expect(status()).toHaveTextContent("");
  });

  it("brings the first row and the rule back once the offending characters go", async () => {
    indexServes();
    renderWithProviders(<Host />);
    type("#salt maps");
    type("#saltmaps");
    await settle();
    expect(rowNames()).toEqual(["saltmaps"]);
    expect(screen.getByTestId(byNode("tagPicker.rule"))).toHaveTextContent(TAG_NAME_RULE);
    expect(field()).not.toHaveAttribute("aria-invalid");
  });

  it("closes on Done with every staged tag kept, and the refused name adds none", () => {
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[draft("salt")]} spy={spy} onDone={onDone} />);
    type("#salt maps");
    fireEvent.click(screen.getByTestId(byNode("tagPicker.done")));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("TagPicker — the state chip's cap and fault (rounds 24-25)", () => {
  const ten = Array.from({ length: 10 }, (_, i) => draft(`held${i}`));
  const failingIndex = (onCall: () => void = () => {}) =>
    gqlLink.query("TagNames", () => {
      onCall();
      return HttpResponse.error();
    });

  // :27 tagPicker.cap reads Up to 10 tags per post. above the list GIVEN the
  // composer holds ten tags and was opened from a post's composer.
  it(":27 the cap's line stands above the list, per post", async () => {
    indexServes("saltmaps");
    renderWithProviders(<Host initial={ten} />);
    type("salt");
    await settle();
    const cap = screen.getByTestId(byNode("tagPicker.cap"));
    expect(cap).toHaveTextContent("Up to 10 tags per post.");
    // Above the list: the line precedes the typed name's row.
    const firstRow = screen.getAllByTestId(byNode("tagPicker.tag"))[0]!;
    expect(cap.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // :29 … per comment. GIVEN … opened from a reply's composer or a comment's edit.
  it(":29 the cap's line says per comment from a reply", () => {
    renderWithProviders(<Host initial={ten} origin="comment" />);
    expect(screen.getByTestId(byNode("tagPicker.cap"))).toHaveTextContent("Up to 10 tags per comment.");
  });

  // :31 ALWAYS every row in the list, the typed name's included, is dimmed and
  // takes no tap GIVEN the composer holds ten tags.
  it(":31 at the cap every row, the typed name's included, is dimmed and takes no tap", async () => {
    indexServes("saltmaps");
    const spy = vi.fn();
    renderWithProviders(<Host initial={ten} spy={spy} />);
    type("salt");
    await settle();
    const rows = screen.getAllByTestId(byNode("tagPicker.tag"));
    expect(rows.map((row) => row.getAttribute("data-testid-key"))).toEqual(["salt", "saltmaps"]);
    for (const row of rows) {
      expect(row).toBeDisabled();
      expect(row.parentElement).toHaveClass("opacity-[var(--state-disabled)]");
      fireEvent.click(row);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  // :33 WHEN press the keyboard's action key GIVEN the composer holds ten tags -> NEVER a tag is staged.
  it(":33 the action key stages nothing at the cap", () => {
    const spy = vi.fn();
    renderWithProviders(<Host initial={ten} spy={spy} />);
    type("salt");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(spy).not.toHaveBeenCalled();
  });

  // :35 WHEN tap the remove control of a staged row GIVEN ten -> unstaged AND
  // the cap leaves AND the list takes taps again.
  it(":35 a staged × at the cap un-stages, the cap leaves, and the list takes taps again", async () => {
    renderWithProviders(<Host initial={ten} />);
    type("salt");
    await settle();
    fireEvent.click(within(screen.getAllByTestId(byNode("tagPicker.staged.tag"))[0]!).getByRole("button"));
    expect(stagedNames()).toHaveLength(9);
    expect(screen.queryByTestId(byNode("tagPicker.cap"))).not.toBeInTheDocument();
    const first = screen.getAllByTestId(byNode("tagPicker.tag"))[0]!;
    expect(first).not.toBeDisabled();
    expect(first.parentElement).not.toHaveClass("opacity-[var(--state-disabled)]");
    fireEvent.click(first);
    expect(stagedNames()).toContain("salt");
  });

  // :37 WHEN the candidates' read gets no answer -> the typed name's row still
  // stands first AND tagPicker.fault reads Can't reach the server — tags can't
  // load right now. over tagPicker.fault.retry, outlined, where the candidates
  // were AND NEVER the line says try again.
  it(":37 a read with no answer keeps the typed row and says the noun line over an outlined Retry", async () => {
    server.use(failingIndex());
    renderWithProviders(<Host />);
    type("salt");
    await settle();
    expect(rowNames()).toEqual(["salt"]);
    const fault = screen.getByTestId(byNode("tagPicker.fault"));
    expect(fault).toHaveTextContent("Can't reach the server — tags can't load right now.");
    expect(fault.textContent).not.toMatch(/try again/i);
    const retry = within(fault).getByTestId(byNode("tagPicker.fault.retry"));
    expect(retry).toHaveTextContent("Retry");
    expect(retry).toHaveClass("border-outline");
  });

  // :39 WHEN tap tagPicker.fault.retry -> the candidates are read again for the
  // typed name AND the typed name's row stays first.
  it(":39 Retry reads the candidates again for the typed name, the typed row first", async () => {
    let calls = 0;
    server.use(failingIndex(() => (calls += 1)));
    renderWithProviders(<Host />);
    type("salt");
    await settle();
    expect(calls).toBe(1);
    indexServes("saltmaps");
    fireEvent.click(screen.getByTestId(byNode("tagPicker.fault.retry")));
    await settle();
    expect(rowNames()).toEqual(["salt", "saltmaps"]);
    expect(screen.queryByTestId(byNode("tagPicker.fault"))).not.toBeInTheDocument();
  });

  // :41 ALWAYS no line stands where the candidates are GIVEN the read is in flight or found nothing.
  it(":41 an empty answer and a read in flight say nothing", async () => {
    indexServes();
    renderWithProviders(<Host />);
    type("salt");
    expect(screen.queryByTestId(byNode("tagPicker.fault"))).not.toBeInTheDocument();
    await settle();
    expect(rowNames()).toEqual(["salt"]);
    expect(screen.queryByTestId(byNode("tagPicker.fault"))).not.toBeInTheDocument();
    expect(screen.queryByTestId(byNode("tagPicker.cap"))).not.toBeInTheDocument();
  });
});
