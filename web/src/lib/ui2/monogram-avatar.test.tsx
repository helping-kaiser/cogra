import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonogramAvatar, monogramOf, monogramRole } from "./monogram-avatar";

describe("monogramOf", () => {
  it("takes the first letter, uppercased", () => {
    expect(monogramOf("mira")).toBe("M");
    expect(monogramOf("  ada  ")).toBe("A");
  });

  it("does not cut a non-BMP character in half", () => {
    // A naive charAt would return a lone surrogate and render a replacement box.
    expect(monogramOf("😀 sol")).toBe("😀");
  });

  it("has something to draw for an empty name", () => {
    expect(monogramOf("")).toBe("?");
    expect(monogramOf("   ")).toBe("?");
  });
});

describe("MonogramAvatar", () => {
  it("draws the designed monogram when there is no photo", () => {
    render(<MonogramAvatar name="Mira" testId="avatar" />);
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("sits on the secondary container, which is what makes it a placeholder rather than a gap", () => {
    render(<MonogramAvatar name="Mira" testId="avatar" />);
    expect(screen.getByTestId("avatar").className).toContain("bg-secondary-container");
  });

  it("shows the photo when there is one", () => {
    render(<MonogramAvatar name="Mira" src="/media/mira" testId="avatar" />);
    expect(document.querySelector("img")).not.toBeNull();
    expect(screen.queryByText("M")).toBeNull();
  });

  it("gives the photo an empty alt, since the name is already beside it", () => {
    render(<MonogramAvatar name="Mira" src="/media/mira" />);
    expect(document.querySelector("img")!.getAttribute("alt")).toBe("");
  });

  it("falls back to the monogram silently when the photo fails", () => {
    render(<MonogramAvatar name="Mira" src="/media/gone" testId="avatar" />);
    fireEvent.error(document.querySelector("img")!);
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("takes the size it is given as a box, and the master's role for its disc", () => {
    render(<MonogramAvatar name="Mira" size={24} tier="sm" testId="avatar" />);
    const avatar = screen.getByTestId("avatar");
    expect(avatar.style.width).toBe("24px");
    expect((screen.getByText("M") as HTMLElement).className).toBe("text-label-small [font-weight:500]");
  });

  // `ActorChip.jsx` MonogramAvatar: sm/md/lg discs read their roles whole; a
  // disc sized by number label-large below 56px, headline-small from 56.
  it.each([
    [24, "sm", "text-label-small"],
    [32, "md", "text-label-medium"],
    [64, "lg", "text-headline-small"],
    [32, undefined, "text-label-large"],
    [40, undefined, "text-label-large"],
    [56, undefined, "text-headline-small"],
    [80, undefined, "text-headline-small"],
  ] as const)("a %ipx disc (%s) reads %s", (size, tier, role) => {
    expect(monogramRole(size, tier)).toBe(role);
  });
});
