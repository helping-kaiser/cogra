import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BodyVeil } from "./body-veil";

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
    screen.getByTestId("body-veil-reveal").click();
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

  it("carries the author's reason on the veil and in its accessible name", () => {
    render(
      <BodyVeil reason="Injured seabird">
        <p>Body</p>
      </BodyVeil>,
    );
    expect(screen.getByText("Injured seabird")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sensitive — tap to view — Injured seabird" }),
    ).toBeInTheDocument();
  });

  it("names itself plainly when there is no reason", () => {
    render(
      <BodyVeil>
        <p>Body</p>
      </BodyVeil>,
    );
    expect(screen.getByRole("button", { name: "Sensitive — tap to view" })).toBeInTheDocument();
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
