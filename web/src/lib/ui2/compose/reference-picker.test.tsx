// The citation picker's behaviour, compiled line by line from its sidecar
// (design/designs/canonical/behavior/ReferencePicker.md), driven through a
// host that holds the composer's references.

import { act, fireEvent, screen } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { newReferenceDraft, type ReferenceDraft } from "@/lib/references/draft";
import { PICK_ADDED, PICK_REMOVED } from "@/lib/topics/picker";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { kindsReading, pickerRowOf, ReferencePicker } from "./reference-picker";
import type { PickerOrigin } from "./picker-rows";

const moderated = (value: string | null) => ({ __typename: "ModeratedText", value });

const SAL = {
  __typename: "ReferenceCandidate",
  targetId: "u-sal",
  target: { __typename: "User", id: "u-sal", handle: "saltorres", displayName: moderated("Sal Torres") },
};
const SALT_MAPS = {
  __typename: "ReferenceCandidate",
  targetId: "p-salt",
  target: {
    __typename: "Post",
    id: "p-salt",
    title: moderated("Salt maps of the coast road"),
    content: moderated(null),
    author: { __typename: "User", handle: "sol" },
    createdAt: "2026-10-25T10:00:00Z",
    attachmentsStatus: "NORMAL",
    attachments: [],
  },
};

function candidates(...served: readonly unknown[]) {
  return gqlLink.query("ReferenceCandidates", () =>
    HttpResponse.json({ data: { referenceCandidates: served } }),
  );
}

const server = startMswServer(candidates());

function Host({
  initial = [],
  onDone = () => {},
  origin,
  spy,
}: {
  initial?: readonly ReferenceDraft[];
  onDone?: () => void;
  origin?: PickerOrigin;
  spy?: (references: readonly ReferenceDraft[]) => void;
}) {
  const [references, setReferences] = useState<readonly ReferenceDraft[]>(initial);
  return (
    <ReferencePicker
      references={references}
      onReferences={(next) => {
        spy?.(next);
        setReferences(next);
      }}
      onDone={onDone}
      origin={origin}
      debounceMs={0}
    />
  );
}

const field = () => screen.getByRole("searchbox", { name: "Cite something" });
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const status = () => screen.getByTestId(byNode("referencePicker.announcement"));
const results = () =>
  screen
    .queryAllByTestId(byNode("referencePicker.result"))
    .map((row) => row.getAttribute("data-testid-key"));
const staged = () => screen.queryAllByTestId(byNode("referencePicker.staged.reference"));

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const salMention = () =>
  newReferenceDraft("u-sal", { kind: "User", label: "@saltorres", href: "/u/saltorres", handle: "saltorres", displayName: "Sal Torres" });

describe("ReferencePicker", () => {
  it("stages a tapped result, moves it into the staged section, and stays open", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host spy={spy} onDone={onDone} />);
    type("salt");
    await settle();
    expect(results()).toEqual(["u-sal", "p-salt"]);

    fireEvent.click(screen.getByTestId(byNode("referencePicker.result", "p-salt")));
    expect(spy).toHaveBeenLastCalledWith([expect.objectContaining({ targetId: "p-salt", relevance: 0.1, support: 0.1 })]);
    expect(results()).toEqual(["u-sal"]);
    expect(staged()).toHaveLength(1);
    expect(staged()[0]).toHaveTextContent("Salt maps of the coast road");
    expect(status()).toHaveTextContent(PICK_ADDED);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("stands a staged reference only in the staged section above the results", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    renderWithProviders(<Host initial={[salMention()]} />);
    type("salt");
    await settle();
    expect(results()).toEqual(["p-salt"]);
    expect(staged()).toHaveLength(1);
    expect(staged()[0]).toHaveTextContent("Sal Torres");
  });

  it("unstages a staged row on its ×, announces it, and stays open", async () => {
    server.use(candidates(SAL));
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[salMention()]} spy={spy} onDone={onDone} />);
    type("salt");
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Remove Sal Torres" }));
    expect(spy).toHaveBeenLastCalledWith([]);
    expect(staged()).toHaveLength(0);
    expect(results()).toEqual(["u-sal"]);
    expect(status()).toHaveTextContent(PICK_REMOVED);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("closes on Done without unstaging anything", () => {
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[salMention()]} spy={spy} onDone={onDone} />);
    fireEvent.click(screen.getByTestId(byNode("referencePicker.done")));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("closes on the header back without unstaging anything", () => {
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[salMention()]} spy={spy} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to the post" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("names the arrow for the composer it returns to", () => {
    renderWithProviders(<Host origin="comment" />);
    expect(screen.getByRole("button", { name: "Back to the comment" })).toBeInTheDocument();
  });

  it("focuses the search field when it opens", () => {
    renderWithProviders(<Host />);
    expect(field()).toHaveFocus();
  });

  it("names its one ? Citing", () => {
    renderWithProviders(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Citing" }));
    expect(screen.getByTestId("reference-picker-help")).toHaveAttribute("open");
  });

  it("draws a person over their handle and a post over its author and age", () => {
    const person = pickerRowOf(salMention().target);
    expect(person).toEqual({ kind: "person", name: "Sal Torres", sub: "@saltorres" });
    const post = pickerRowOf({
      kind: "Post",
      label: "@sol: Salt maps of the coast road",
      href: "/posts/p",
      name: "Salt maps of the coast road",
      author: "sol",
      createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      cover: "https://media/p.webp",
    });
    expect(post).toEqual({
      kind: "post",
      name: "Salt maps of the coast road",
      sub: "@sol · 3d",
      src: "https://media/p.webp",
    });
  });
});

describe("ReferencePicker — the filter", () => {
  it("reads Everything at the default, and names what it is for", () => {
    renderWithProviders(<Host />);
    expect(screen.getByRole("button", { name: "Everything, what the search shows" })).toHaveTextContent(
      "Everything",
    );
  });

  it("narrows the results only when Done commits the staged kinds", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    renderWithProviders(<Host />);
    type("salt");
    await settle();
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterTrigger")));
    fireEvent.click(screen.getByTestId("reference-picker-filter-profiles"));
    // Staged, not applied: the results do not move under the sheet.
    expect(results()).toEqual(["u-sal", "p-salt"]);
    fireEvent.click(screen.getByTestId("reference-picker-filter-done"));
    expect(results()).toEqual(["u-sal"]);
    expect(screen.getByTestId(byNode("referencePicker.filterTrigger"))).toHaveTextContent("Profiles");
  });

  it("drops the staged kinds when the sheet is dismissed", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    renderWithProviders(<Host />);
    type("salt");
    await settle();
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterTrigger")));
    fireEvent.click(screen.getByTestId("reference-picker-filter-posts"));
    const sheet = screen.getByTestId(byNode("referencePicker.filterSheet")) as HTMLDialogElement;
    // Escape and system Back reach a modal dialog as a close request.
    act(() => sheet.close());
    expect(results()).toEqual(["u-sal", "p-salt"]);
    expect(screen.getByTestId(byNode("referencePicker.filterTrigger"))).toHaveTextContent("Everything");
  });

  it("reads the kinds the way the search filter's head does", () => {
    expect(kindsReading([])).toBe("Everything");
    expect(kindsReading(["posts"])).toBe("Posts");
    expect(kindsReading(["posts", "comments"])).toBe("2 kinds");
    expect(kindsReading(["posts", "comments", "profiles"])).toBe("All kinds");
  });
});
