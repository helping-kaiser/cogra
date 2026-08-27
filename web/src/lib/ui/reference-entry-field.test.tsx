// The reference section and the finder it opens (D15, D20). Named apart
// from the 2.3 tag-entry suite on purpose: the two sections are
// siblings, and a failure should say which one broke.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { newReferenceDraft, type ReferenceDraft } from "@/lib/references/draft";
import { renderWithProviders } from "@/test/providers";
import { startMswServer } from "@/test/msw";
import { ReferenceEntryField } from "./reference-entry-field";

function userCandidate(id: string, handle: string) {
  return {
    __typename: "ReferenceCandidate",
    targetId: id,
    target: {
      __typename: "User",
      id,
      handle,
      displayName: { __typename: "ModeratedText", value: handle },
    },
  };
}

function candidatesRespond(candidates: unknown[]) {
  return graphql.query("ReferenceCandidates", () =>
    HttpResponse.json({ data: { referenceCandidates: candidates } }),
  );
}

function mention(id: string, handle: string): ReferenceDraft {
  return newReferenceDraft(id, {
    kind: "User",
    label: `@${handle}`,
    href: `/u/${handle}`,
  });
}

describe("ReferenceEntryField", () => {
  const server = startMswServer();

  function renderSection(
    references: readonly ReferenceDraft[],
    onChange = vi.fn(),
    cap: number | null = 10,
  ) {
    renderWithProviders(
      <ReferenceEntryField
        references={references}
        onChange={onChange}
        cap={cap}
        testIdPrefix="compose"
        finderDebounceMs={0}
      />,
    );
    return onChange;
  }

  it("opens the finder from the add action", () => {
    renderSection([]);
    expect(screen.queryByTestId("compose-finder")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    expect(screen.getByTestId("compose-finder")).toBeInTheDocument();
  });

  it("asks nothing while the query resolves nothing", async () => {
    let asked = 0;
    server.use(
      graphql.query("ReferenceCandidates", () => {
        asked += 1;
        return HttpResponse.json({ data: { referenceCandidates: [] } });
      }),
    );
    renderSection([]);
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    // An empty query shows the hint and never leaves the browser — what
    // populates the finder by default is jakob's pending design.
    expect(screen.getByTestId("compose-finder-hint")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("compose-finder-query"), {
      target: { value: "   " },
    });
    await waitFor(() => expect(screen.getByTestId("compose-finder-hint")).toBeInTheDocument());
    expect(asked).toBe(0);
  });

  it("asks nothing for a #-sigilled query — a topic is tagged, not referenced", async () => {
    let asked = 0;
    server.use(
      graphql.query("ReferenceCandidates", () => {
        asked += 1;
        return HttpResponse.json({ data: { referenceCandidates: [] } });
      }),
    );
    renderSection([]);
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    fireEvent.change(screen.getByTestId("compose-finder-query"), {
      target: { value: "#rust" },
    });
    await waitFor(() => expect(screen.getByTestId("compose-finder-hint")).toBeInTheDocument());
    expect(asked).toBe(0);
  });

  it("drafts the candidate a reader picks, at the server's own defaults", async () => {
    server.use(candidatesRespond([userCandidate("u-ada", "ada")]));
    const onChange = renderSection([]);
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    fireEvent.change(screen.getByTestId("compose-finder-query"), {
      target: { value: "ada" },
    });
    const candidate = await screen.findByTestId("compose-finder-candidate-u-ada");
    fireEvent.click(candidate);

    expect(onChange).toHaveBeenCalledTimes(1);
    const [drafted] = onChange.mock.calls[0] as [readonly ReferenceDraft[]];
    expect(drafted).toHaveLength(1);
    expect(drafted[0].targetId).toBe("u-ada");
    expect(drafted[0].relevance).toBe(0.1);
    expect(drafted[0].support).toBe(0.1);
  });

  it("says so plainly when a query resolves nothing", async () => {
    server.use(candidatesRespond([]));
    renderSection([]);
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    fireEvent.change(screen.getByTestId("compose-finder-query"), {
      target: { value: "nobody" },
    });
    expect(await screen.findByTestId("compose-finder-empty")).toBeInTheDocument();
  });

  it("marks a target the section already holds rather than offering a refusal", async () => {
    // Referencing the same target twice is REFUSED, never deduplicated.
    server.use(candidatesRespond([userCandidate("u-ada", "ada")]));
    const onChange = renderSection([mention("u-ada", "ada")]);
    fireEvent.click(screen.getByTestId("compose-reference-add"));
    fireEvent.change(screen.getByTestId("compose-finder-query"), {
      target: { value: "ada" },
    });
    const candidate = await screen.findByTestId("compose-finder-candidate-u-ada");
    expect(candidate).toBeDisabled();
    fireEvent.click(candidate);
    expect(onChange).not.toHaveBeenCalled();
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

  it("stops adding at the batch cap and says why", () => {
    const full = Array.from({ length: 10 }, (_, i) => mention(`u-${i}`, `u${i}`));
    renderSection(full);
    expect(screen.getByTestId("compose-reference-add")).toBeDisabled();
    expect(screen.getByTestId("compose-reference-cap")).toHaveTextContent(
      "Up to 10 references per post",
    );
  });

  it("carries no cap where the references are not one batch", () => {
    const many = Array.from({ length: 12 }, (_, i) => mention(`u-${i}`, `u${i}`));
    renderSection(many, vi.fn(), null);
    expect(screen.getByTestId("compose-reference-add")).not.toBeDisabled();
    expect(screen.queryByTestId("compose-reference-cap")).not.toBeInTheDocument();
  });

  it("routes a field-level refusal onto the offending chip", () => {
    render(
      <ReferenceEntryField
        references={[mention("u-ada", "ada"), mention("u-bob", "bob")]}
        onChange={vi.fn()}
        fieldErrors={{ 1: "That target can't be referenced." }}
        testIdPrefix="compose"
      />,
    );
    expect(screen.getByTestId("compose-reference-error-1")).toHaveTextContent(
      "That target can't be referenced.",
    );
    expect(screen.queryByTestId("compose-reference-error-0")).not.toBeInTheDocument();
  });
});
