import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonogramAvatar, monogramOf } from "./monogram-avatar";

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

  it("takes the size it is given, both as a box and as a mark", () => {
    render(<MonogramAvatar name="Mira" size={24} testId="avatar" />);
    const avatar = screen.getByTestId("avatar");
    expect(avatar.style.width).toBe("24px");
    // The mark scales with the disc rather than taking a fixed type role, or a
    // 24px avatar would overflow.
    expect((screen.getByText("M") as HTMLElement).style.fontSize).toBe("10px");
  });
});
