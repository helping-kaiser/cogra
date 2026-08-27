import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferenceChipRow, type ReferenceChipEntry } from "./reference-chip-row";

function mention(targetId = "l1-u1", relevance = 0.4, support = -0.2): ReferenceChipEntry {
  return {
    targetId,
    target: { kind: "User", label: "@ada", href: "/u/ada" },
    pending: false,
    relevance,
    support,
  };
}

function quote(targetId = "l1-p2"): ReferenceChipEntry {
  return {
    targetId,
    target: { kind: "Post", label: "@carol: On folding", href: "/posts/p2" },
    pending: false,
    relevance: 0.1,
    support: 0.1,
  };
}

describe("ReferenceChipRow", () => {
  it("renders nothing without references", () => {
    const { container } = render(<ReferenceChipRow references={[]} testIdPrefix="post" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a mention on the referenced profile", () => {
    render(<ReferenceChipRow references={[mention()]} testIdPrefix="post" />);
    expect(screen.getByTestId("post-reference-l1-u1-link")).toHaveAttribute(
      "href",
      "/u/ada",
    );
  });

  it("opens a referenced post on its detail", () => {
    render(<ReferenceChipRow references={[quote()]} testIdPrefix="post" />);
    expect(screen.getByTestId("post-reference-l1-p2-link")).toHaveAttribute(
      "href",
      "/posts/p2",
    );
  });

  it("renders an untyped target as a plain chip that navigates nowhere", () => {
    const untyped: ReferenceChipEntry = {
      targetId: "l1-unknown",
      target: { kind: null, label: "l1-unknown", href: null },
      pending: false,
    };
    render(<ReferenceChipRow references={[untyped]} testIdPrefix="post" />);
    expect(screen.getByTestId("post-reference-l1-unknown")).toHaveTextContent("l1-unknown");
    expect(screen.queryByTestId("post-reference-l1-unknown-link")).not.toBeInTheDocument();
  });

  it("marks a reference whose bundle is still in flight", () => {
    render(
      <ReferenceChipRow references={[{ ...mention(), pending: true }]} testIdPrefix="post" />,
    );
    expect(screen.getByTestId("post-reference-l1-u1-pending")).toBeInTheDocument();
  });

  // D16: the reveal belongs to detail surfaces. A card gets no toggle at
  // all, and no values with it.
  it("offers no reveal unless asked for one", () => {
    render(<ReferenceChipRow references={[mention()]} testIdPrefix="feed-post-p1" />);
    expect(screen.queryByTestId("feed-post-p1-references-reveal")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("feed-post-p1-reference-l1-u1-values"),
    ).not.toBeInTheDocument();
  });

  it("keeps the values off screen until a reader asks", () => {
    render(<ReferenceChipRow references={[mention()]} testIdPrefix="post" revealable />);
    const toggle = screen.getByTestId("post-references-reveal");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("post-reference-l1-u1-values")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Both axes are bipolar, so both carry a forced sign.
    expect(screen.getByTestId("post-reference-l1-u1-values")).toHaveTextContent(
      "+0.40 · -0.20",
    );
  });

  it("names both axes for a reader without the row in front of them", () => {
    render(<ReferenceChipRow references={[mention()]} testIdPrefix="post" revealable />);
    fireEvent.click(screen.getByTestId("post-references-reveal"));
    expect(screen.getByTestId("post-reference-l1-u1-values")).toHaveTextContent(
      "relevance +0.40, support -0.20",
    );
  });

  it("reveals every chip on the row from the one control", () => {
    render(
      <ReferenceChipRow references={[mention(), quote()]} testIdPrefix="post" revealable />,
    );
    fireEvent.click(screen.getByTestId("post-references-reveal"));
    expect(screen.getByTestId("post-reference-l1-u1-values")).toBeInTheDocument();
    expect(screen.getByTestId("post-reference-l1-p2-values")).toBeInTheDocument();
  });
});
