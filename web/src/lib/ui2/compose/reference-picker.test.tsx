// The citation picker's behaviour, compiled line by line from its sidecar
// (design/designs/canonical/behavior/ReferencePicker.md), driven through a
// host that holds the composer's references.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { newReferenceDraft, type ReferenceDraft } from "@/lib/references/draft";
import { PICK_ADDED, PICK_REMOVED } from "@/lib/topics/picker";
import { byNode } from "@/test/data-node";
import { settleFetches } from "@/test/fetch";
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

/** The wire kind each fixture's target is (`NodeKind`). */
const WIRE: Record<string, string> = { User: "USER", Post: "POST", Comment: "COMMENT" };

// Every lookup the handlers below have answered in this test.
let lookups = 0;
beforeEach(() => {
  lookups = 0;
});

/** The candidates served, narrowed the way the server narrows: by the asked `kinds`. */
function candidates(...served: readonly { target: { __typename: string } }[]) {
  return gqlLink.query("ReferenceCandidates", ({ variables }) => {
    lookups += 1;
    const kinds = (variables as { kinds?: string[] | null }).kinds ?? null;
    const answer = kinds === null ? served : served.filter((c) => kinds.includes(WIRE[c.target.__typename] ?? ""));
    return HttpResponse.json({ data: { referenceCandidates: answer } });
  });
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
// A result is keyed by its place (nodes.json `referencePicker.result`), so the
// rows are told apart by the name they read.
const resultRows = () => screen.queryAllByTestId(byNode("referencePicker.result"));
const NAMES: Record<string, string> = { "u-sal": "Sal Torres", "p-salt": "Salt maps of the coast road" };
const results = () =>
  resultRows().map((row) => {
    const name = row.querySelector('[data-testid="referencePicker.result.name"]')?.textContent;
    return Object.keys(NAMES).find((id) => NAMES[id] === name) ?? name;
  });
const result = (id: string) => resultRows()[results().indexOf(id)]!;
const staged = () => screen.queryAllByTestId(byNode("referencePicker.staged.stagedReference"));

// THE ANSWER IS AWAITED, NEVER SLEPT ON. A lookup is a real round trip (msw 3
// answers through undici's own send path, test/fetch.ts), so a fixed sleep
// before reading the results is a race the runner can lose. A test that
// expects something to APPEAR waits for it (Testing Library's async
// methods); one that expects something to stay ABSENT first waits for the
// lookup to be answered and delivered, so it reads the settled screen.
async function answered(count = 1) {
  await waitFor(() => expect(lookups).toBeGreaterThanOrEqual(count));
  await act(() => settleFetches());
}

const showing = (expected: readonly string[]) => waitFor(() => expect(results()).toEqual(expected));

const salMention = () =>
  newReferenceDraft("u-sal", { kind: "User", label: "@saltorres", href: "/u/saltorres", handle: "saltorres", displayName: "Sal Torres" });

describe("ReferencePicker", () => {
  it("stages a tapped result, moves it into the staged section, and stays open", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host spy={spy} onDone={onDone} />);
    type("salt");
    await showing(["u-sal", "p-salt"]);
    expect(resultRows().map((row) => row.getAttribute("data-testid-key"))).toEqual(["1", "2"]);

    fireEvent.click(result("p-salt"));
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
    await showing(["p-salt"]);
    expect(staged()).toHaveLength(1);
    expect(staged()[0]).toHaveTextContent("Sal Torres");
  });

  it("unstages a staged row on its ×, announces it, and stays open", async () => {
    server.use(candidates(SAL));
    const spy = vi.fn();
    const onDone = vi.fn();
    renderWithProviders(<Host initial={[salMention()]} spy={spy} onDone={onDone} />);
    type("salt");
    // The answer holds only the staged Sal, so nothing new appears to wait on.
    await answered();
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
    await showing(["u-sal", "p-salt"]);
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterTrigger")));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterSheet.kinds.profilesChip")));
    // Staged, not applied: the results do not move under the sheet.
    expect(results()).toEqual(["u-sal", "p-salt"]);
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterSheet.foot.done")));
    // The server narrows: the picker asks again with the committed kinds.
    await showing(["u-sal"]);
    expect(screen.getByTestId(byNode("referencePicker.filterTrigger"))).toHaveTextContent("Profiles");
  });

  it("narrows on the server: the committed kinds ride the lookup, nothing narrowed asks for every kind", async () => {
    const asked: unknown[] = [];
    server.use(
      gqlLink.query("ReferenceCandidates", ({ variables }) => {
        asked.push(variables);
        return HttpResponse.json({ data: { referenceCandidates: [] } });
      }),
    );
    renderWithProviders(<Host />);
    type("salt");
    await waitFor(() => expect(asked).toHaveLength(1));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterTrigger")));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterSheet.kinds.postsChip")));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterSheet.kinds.profilesChip")));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterSheet.foot.done")));
    await waitFor(() =>
      expect(asked).toEqual([
        { query: "salt", limit: 10 },
        { query: "salt", limit: 10, kinds: ["POST", "USER"] },
      ]),
    );
    // Delivered and settled, and still only the two: nothing else asked.
    await act(() => settleFetches());
    expect(asked).toHaveLength(2);
  });

  it("drops the staged kinds when the sheet is dismissed", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    renderWithProviders(<Host />);
    type("salt");
    await showing(["u-sal", "p-salt"]);
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterTrigger")));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.filterSheet.kinds.postsChip")));
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

describe("ReferencePicker — the state chip's cap and fault (rounds 24-25)", () => {
  const ten = Array.from({ length: 10 }, (_, i) =>
    newReferenceDraft(`u-held${i}`, { kind: "User", label: `@held${i}`, href: `/u/held${i}`, handle: `held${i}` }),
  );
  const failing = (onCall: () => void = () => {}) =>
    gqlLink.query("ReferenceCandidates", () => {
      onCall();
      return HttpResponse.error();
    });

  // :35 referencePicker.cap reads Up to 10 citations per post. above the results.
  it(":35 the cap's line stands above the results, per post", async () => {
    server.use(candidates(SAL));
    renderWithProviders(<Host initial={ten} />);
    type("salt");
    await showing(["u-sal"]);
    const cap = screen.getByTestId(byNode("referencePicker.cap"));
    expect(cap).toHaveTextContent("Up to 10 citations per post.");
    expect(cap.compareDocumentPosition(result("u-sal")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // :37 … per comment from a reply's composer or a comment's edit.
  it(":37 the cap's line says per comment from a reply", () => {
    renderWithProviders(<Host initial={ten} origin="comment" />);
    expect(screen.getByTestId(byNode("referencePicker.cap"))).toHaveTextContent("Up to 10 citations per comment.");
  });

  // :39 ALWAYS every referencePicker.result is dimmed and takes no tap GIVEN ten.
  it(":39 at the cap every result is dimmed and takes no tap", async () => {
    server.use(candidates(SAL, SALT_MAPS));
    const spy = vi.fn();
    renderWithProviders(<Host initial={ten} spy={spy} />);
    type("salt");
    await showing(["u-sal", "p-salt"]);
    for (const row of resultRows()) {
      expect(row).toBeDisabled();
      expect(row.parentElement).toHaveClass("opacity-[var(--state-disabled)]");
      fireEvent.click(row);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  // :41 WHEN tap the remove control of a staged row GIVEN ten -> unstaged AND
  // referencePicker.cap leaves AND the results take taps again.
  it(":41 a staged × at the cap un-stages, the cap leaves, and the results take taps again", async () => {
    server.use(candidates(SAL));
    renderWithProviders(<Host initial={ten} />);
    type("salt");
    await showing(["u-sal"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove @held0" }));
    expect(staged()).toHaveLength(9);
    expect(screen.queryByTestId(byNode("referencePicker.cap"))).not.toBeInTheDocument();
    expect(result("u-sal")).not.toBeDisabled();
    expect(result("u-sal").parentElement).not.toHaveClass("opacity-[var(--state-disabled)]");
    fireEvent.click(result("u-sal"));
    expect(staged()).toHaveLength(10);
  });

  // :43 WHEN the results' read gets no answer GIVEN no result has loaded ->
  // referencePicker.fault reads … over referencePicker.fault.retry, outlined,
  // where the results were AND the field keeps the query AND NEVER the line says try again.
  it(":43 a read with no answer says the noun line over an outlined Retry, the query kept", async () => {
    server.use(failing());
    renderWithProviders(<Host />);
    type("salt");
    const fault = await screen.findByTestId(byNode("referencePicker.fault"));
    expect(resultRows()).toHaveLength(0);
    expect(fault).toHaveTextContent("Can't reach the server — results can't load right now.");
    expect(fault.textContent).not.toMatch(/try again/i);
    expect(screen.getByTestId(byNode("referencePicker.fault.retry"))).toHaveTextContent("Retry");
    expect(screen.getByTestId(byNode("referencePicker.fault.retry"))).toHaveClass("border-outline");
    expect(field()).toHaveValue("salt");
  });

  // :45 WHEN tap referencePicker.fault.retry -> the results are read again for the query.
  it(":45 Retry reads the results again for the query in the field", async () => {
    let calls = 0;
    server.use(failing(() => (calls += 1)));
    renderWithProviders(<Host />);
    type("salt");
    await screen.findByTestId(byNode("referencePicker.fault"));
    expect(calls).toBe(1);
    server.use(candidates(SAL));
    fireEvent.click(screen.getByTestId(byNode("referencePicker.fault.retry")));
    await showing(["u-sal"]);
    expect(screen.queryByTestId(byNode("referencePicker.fault"))).not.toBeInTheDocument();
  });

  // :47 WHEN the query changes GIVEN referencePicker.fault stands -> the results read again.
  it(":47 a changed query reads again while the fault stands", async () => {
    let calls = 0;
    server.use(failing(() => (calls += 1)));
    renderWithProviders(<Host />);
    type("salt");
    await screen.findByTestId(byNode("referencePicker.fault"));
    server.use(candidates(SAL));
    type("salto");
    await showing(["u-sal"]);
    expect(calls).toBe(1);
    expect(screen.queryByTestId(byNode("referencePicker.fault"))).not.toBeInTheDocument();
  });

  // :49 ALWAYS no line stands where the results are GIVEN in flight or found nothing.
  it(":49 an empty answer and a read in flight say nothing", async () => {
    renderWithProviders(<Host />);
    type("salt");
    expect(screen.queryByTestId(byNode("referencePicker.fault"))).not.toBeInTheDocument();
    // The file's own empty handler answers; only once it is delivered does
    // the screen say what an empty answer says.
    await answered();
    expect(resultRows()).toHaveLength(0);
    expect(screen.queryByTestId(byNode("referencePicker.fault"))).not.toBeInTheDocument();
  });
});
