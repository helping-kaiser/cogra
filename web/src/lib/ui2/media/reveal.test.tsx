import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { BodyRegion } from "@/lib/ui/post-media";
import { forgetReveals, isRevealed, rememberReveal, sensitiveSignature } from "./reveal";

const MARKED = { attachmentsStatus: "SENSITIVE", moderationStatus: "NORMAL" };

beforeEach(forgetReveals);

// Two surfaces that never share a tree — a feed card and a detail page — so the
// only thing they can share is the store.
function Surface({
  nodeId,
  node,
  testId,
}: {
  nodeId: string;
  node: { attachmentsStatus: string; moderationStatus?: string };
  testId: string;
}) {
  return (
    <BodyRegion veiled testId={testId} nodeId={nodeId} signature={sensitiveSignature(node)}>
      <p>{`the body of ${nodeId}`}</p>
    </BodyRegion>
  );
}

describe("the sensitive reveal", () => {
  it("carries from one surface to another — the feed's reveal answers the detail page", () => {
    const feed = render(<Surface nodeId="post-1" node={MARKED} testId="feed" />);
    fireEvent.click(screen.getByTestId("feed-veil-reveal"));
    expect(screen.getByText("the body of post-1")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-veil")).not.toBeInTheDocument();
    feed.unmount();

    // A different component entirely, mounted fresh: the decision is the node's.
    render(<Surface nodeId="post-1" node={MARKED} testId="detail" />);
    expect(screen.queryByTestId("detail-veil")).not.toBeInTheDocument();
  });

  it("is per node — revealing one says nothing about another", () => {
    render(
      <>
        <Surface nodeId="post-1" node={MARKED} testId="one" />
        <Surface nodeId="post-2" node={MARKED} testId="two" />
      </>,
    );
    fireEvent.click(screen.getByTestId("one-veil-reveal"));
    expect(screen.queryByTestId("one-veil")).not.toBeInTheDocument();
    expect(screen.getByTestId("two-veil")).toBeInTheDocument();
  });

  // The consent was to what was there when the reader looked. A moderator
  // marking it afterwards is a different thing to consent to — even when "is it
  // sensitive" was already true and stays true.
  it("is taken back when the node's sensitive state changes", () => {
    const first = render(<Surface nodeId="post-1" node={MARKED} testId="feed" />);
    fireEvent.click(screen.getByTestId("feed-veil-reveal"));
    expect(screen.queryByTestId("feed-veil")).not.toBeInTheDocument();
    first.unmount();

    render(
      <Surface
        nodeId="post-1"
        node={{ attachmentsStatus: "SENSITIVE", moderationStatus: "SENSITIVE" }}
        testId="again"
      />,
    );
    expect(screen.getByTestId("again-veil")).toBeInTheDocument();
  });

  it("governs itself when no node is named", () => {
    render(
      <BodyRegion veiled testId="lone">
        <p>a lone body</p>
      </BodyRegion>,
    );
    fireEvent.click(screen.getByTestId("lone-veil-reveal"));
    expect(screen.queryByTestId("lone-veil")).not.toBeInTheDocument();
    // Nothing was written about a node, because none was named.
    expect(isRevealed("lone", sensitiveSignature(MARKED))).toBe(false);
  });
});

describe("the signature", () => {
  it("reads both marks, so a second mark is a new state to consent to", () => {
    const authorOnly = sensitiveSignature({
      attachmentsStatus: "SENSITIVE",
      moderationStatus: "NORMAL",
    });
    const bothMarked = sensitiveSignature({
      attachmentsStatus: "SENSITIVE",
      moderationStatus: "SENSITIVE",
    });
    expect(authorOnly).not.toBe(bothMarked);

    rememberReveal("post-1", authorOnly);
    expect(isRevealed("post-1", authorOnly)).toBe(true);
    expect(isRevealed("post-1", bothMarked)).toBe(false);
  });

  it("survives a node arriving without a moderation status", () => {
    expect(sensitiveSignature({ attachmentsStatus: "NORMAL" })).toBe("NORMAL|");
  });
});
