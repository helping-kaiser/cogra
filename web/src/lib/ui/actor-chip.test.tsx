// The actor chip against its master (`design/components/people/ActorChip.jsx`).

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActorChip } from "./actor-chip";

const byNode = (path: string) => `[data-testid="${path}"]`;

function mount() {
  const { container } = render(
    <ActorChip
      handle="ada"
      displayName="Ada Quist"
      node={{ path: "feed.card.authorChip", key: "p1" }}
    />,
  );
  const at = (path: string) => container.querySelector(byNode(path)) as HTMLElement;
  return {
    chip: at("feed.card.authorChip"),
    name: at("feed.card.authorChip.name"),
    handle: at("feed.card.authorChip.handle"),
  };
}

describe("ActorChip", () => {
  it("opens the actor's profile and names them", () => {
    mount();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/u/ada");
    expect(screen.getByText("Ada Quist")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  // THE ROW NEVER WRAPS AND NEVER CROWDS (jakob 2026-09-23): the chip yields,
  // the name ellipsizes first, the handle only after it.
  it("ellipsizes the name ahead of the handle and never wraps", () => {
    const { chip, name, handle } = mount();
    expect(chip.className).toContain("min-w-0");
    expect(name.className).toContain("truncate");
    expect(name.className).toContain("shrink-[999]");
    expect(handle.className).toContain("truncate");
    expect(handle.className).toMatch(/\bshrink\b/);
  });

  // The master sets the handle's whole role (`ActorChip.jsx`, round 28).
  it("draws the handle in label-medium whole", () => {
    const { handle } = mount();
    expect(handle.className.split(" ")).toContain("text-label-medium");
    expect(handle.className).not.toContain("text-[length:");
  });

  it("is a pressable surface with a focus ring", () => {
    const { chip } = mount();
    expect(chip.className).toContain("cg-state");
    expect(chip.className).toContain("cg-focus");
  });
});
