import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BodyVeil, veilSourceLine } from "./body-veil";

describe("BodyVeil", () => {
  it("keeps the body mounted under the veil, so revealing moves nothing", () => {
    render(
      <BodyVeil>
        <p>The salt crust reaches the road by March.</p>
      </BodyVeil>,
    );
    // Present in the DOM, and reserving its space, while still veiled.
    expect(screen.getByText("The salt crust reaches the road by March.")).toBeInTheDocument();
    expect(screen.getByTestId("body-veil-reveal")).toBeInTheDocument();
  });

  it("reveals on its own when nothing else governs it", async () => {
    render(
      <BodyVeil>
        <p>Body</p>
      </BodyVeil>,
    );
    fireEvent.click(screen.getByTestId("body-veil-reveal"));
    expect(screen.queryByTestId("body-veil-reveal")).toBeNull();
  });

  it("hands the decision up when a surface governs it", () => {
    const onReveal = vi.fn();
    const { rerender } = render(
      <BodyVeil revealed={false} onReveal={onReveal}>
        <p>Body</p>
      </BodyVeil>,
    );
    screen.getByTestId("body-veil-reveal").click();
    expect(onReveal).toHaveBeenCalledOnce();
    // Still veiled: the surface owns the state, so one reveal can answer for
    // the whole post rather than for this region alone.
    expect(screen.getByTestId("body-veil-reveal")).toBeInTheDocument();

    rerender(
      <BodyVeil revealed onReveal={onReveal}>
        <p>Body</p>
      </BodyVeil>,
    );
    expect(screen.queryByTestId("body-veil-reveal")).toBeNull();
  });

  // THE SOURCE LINE RIDES EVERY VEIL (Q47; LadderStates.md, round 26): whose
  // mark it is, the reason after it where there is one.
  it("names whose mark it is, the author's reason after it, on the face and in its name", () => {
    render(
      <BodyVeil reason="Injured seabird">
        <p>Body</p>
      </BodyVeil>,
    );
    expect(screen.getByTestId("body-veil-source")).toHaveTextContent("The author's warning — Injured seabird");
    expect(
      screen.getByRole("button", { name: "Sensitive — tap to view. The author's warning — Injured seabird" }),
    ).toBeInTheDocument();
  });

  it("names the source even with no reason — an unnamed source would read as the other one", () => {
    render(
      <BodyVeil>
        <p>Body</p>
      </BodyVeil>,
    );
    expect(screen.getByRole("button", { name: "Sensitive — tap to view. The author's warning" })).toBeInTheDocument();
  });

  it("names the platform's verdict as its own source", () => {
    render(
      <BodyVeil source="platform">
        <p>Body</p>
      </BodyVeil>,
    );
    expect(screen.getByTestId("body-veil-source")).toHaveTextContent("The platform's verdict");
  });

  it("a words-only post's text face blurs the words in place with Show and names the source under them (FeedWordsSensitive.md)", () => {
    render(
      <BodyVeil face="text" reason="Grief">
        <p>The salt crust reaches the road by March.</p>
      </BodyVeil>,
    );
    const show = screen.getByRole("button", { name: "Show" });
    expect(show).toHaveTextContent("Show");
    expect(screen.getByText("The salt crust reaches the road by March.").closest("[aria-hidden]")).toHaveStyle({ filter: "blur(6px)" });
    expect(screen.getByTestId("body-veil-source")).toHaveTextContent("The author's warning — Grief");
    fireEvent.click(show);
    // WHEN tap Show -> the words unveil in place AND the source line goes.
    expect(screen.queryByTestId("body-veil-source")).toBeNull();
    expect(screen.getByText("The salt crust reaches the road by March.").closest("[aria-hidden]")).toBeNull();
  });

  it("a text face under a veiled clip leaves the line to the clip's face — once per post", () => {
    render(
      <BodyVeil face="text" named={false}>
        <p>Words</p>
      </BodyVeil>,
    );
    expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
    expect(screen.queryByTestId("body-veil-source")).toBeNull();
  });

  it("a comment's compact face is one block naming the source, in the theme's type (CommentCard.jsx)", () => {
    render(
      <BodyVeil face="compact" source="platform">
        <p>Comment words</p>
      </BodyVeil>,
    );
    const block = screen.getByRole("button", { name: "Sensitive — tap to view. The platform's verdict" });
    expect(block).toHaveTextContent("Sensitive — tap to view");
    expect(screen.getByTestId("body-veil-source")).toHaveTextContent("The platform's verdict");
    expect(block.className).toContain("text-on-surface");
    // The body stays mounted beneath, out of view.
    expect(screen.getByText("Comment words")).toBeInTheDocument();
    fireEvent.click(block);
    expect(screen.getByText("Comment words")).toBeVisible();
  });

  it("does not use the failure role — a veiled post is not an error", () => {
    render(
      <BodyVeil>
        <p>Body</p>
      </BodyVeil>,
    );
    const veil = screen.getByTestId("body-veil");
    expect(veil.innerHTML).not.toContain("error");
  });
});

// WHOSE MARK THE LINE NAMES (SensitiveVeil.jsx `sensitiveSourceLine`; round 27,
// seam 253; copy-voice, *Both marks at once*).
describe("veilSourceLine", () => {
  it("names the author's warning with its reason, or the platform's verdict", () => {
    expect(veilSourceLine("author", "Grief")).toBe("The author's warning — Grief");
    expect(veilSourceLine("author")).toBe("The author's warning");
    expect(veilSourceLine("platform")).toBe("The platform's verdict");
  });

  it("names both marks, the author's first, then the verdict in the edit's blessed words", () => {
    expect(veilSourceLine("both", "One rubbing includes a dead seabird.")).toBe(
      "The author's warning — One rubbing includes a dead seabird. Also veiled by the platform's verdict",
    );
    expect(veilSourceLine("both", "A dead seabird in the second frame")).toBe(
      "The author's warning — A dead seabird in the second frame. Also veiled by the platform's verdict",
    );
    expect(veilSourceLine("both")).toBe("The author's warning. Also veiled by the platform's verdict");
    expect(veilSourceLine("both", null, "Graphic injury")).toBe(
      "The author's warning. Also veiled by the platform's verdict — Graphic injury",
    );
  });
});
