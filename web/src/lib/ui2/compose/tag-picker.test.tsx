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
