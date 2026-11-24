import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  // THE COGRA MARK AS AN ACCOUNT'S PICTURE (round 67, `ActorChip.jsx` `mark`;
  // jakob 2026-11-24, "(a) orange tile"): `design/assets/icon.svg`, the tile,
  // fills the disc and is clipped round, wins over a photo, yields to redaction.
  describe("the mark", () => {
    const iconSvg = readFileSync(resolve(process.cwd(), "../design/assets/icon.svg"), "utf8");
    const attrsOf = (svg: string, tag: string) =>
      [...svg.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].map((m) =>
        Object.fromEntries([...m[1]!.matchAll(/([a-z-]+)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!])),
      );

    it("draws the tile in the disc, and no letter and no photo", () => {
      render(<MonogramAvatar name="The Publisher" src="/media/x" mark testId="avatar" />);
      const disc = screen.getByTestId("avatar");
      expect(disc.querySelector("svg")).not.toBeNull();
      expect(disc.querySelector("img")).toBeNull();
      expect(screen.queryByText("T")).toBeNull();
    });

    it("is clipped round: the disc is the circle and hides what falls outside it", () => {
      render(<MonogramAvatar name="x" mark testId="avatar" />);
      const disc = screen.getByTestId("avatar");
      expect(disc.className).toContain("rounded-full");
      expect(disc.className).toContain("overflow-hidden");
    });

    it("fills the disc at every size", () => {
      for (const size of [24, 32, 40, 44, 56, 64, 80]) {
        const { unmount } = render(<MonogramAvatar name="x" mark size={size} testId="avatar" />);
        const disc = screen.getByTestId("avatar");
        expect(disc.style.width).toBe(`${size}px`);
        const svg = disc.querySelector("svg")!;
        expect(svg.getAttribute("width")).toBe("100%");
        expect(svg.getAttribute("height")).toBe("100%");
        unmount();
      }
    });

    it("is decorative, the name being beside it", () => {
      render(<MonogramAvatar name="x" mark testId="avatar" />);
      expect(screen.getByTestId("avatar").querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    });

    it("carries icon.svg's geometry and three fills verbatim, in no theme's colours", () => {
      const { container } = render(<MonogramAvatar name="x" mark />);
      const drawn = container.querySelector("svg")!.outerHTML;
      expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 100 100");
      for (const tag of ["rect", "circle", "path"]) {
        const want = attrsOf(iconSvg, tag);
        const got = attrsOf(drawn, tag);
        expect(got).toHaveLength(want.length);
        want.forEach((attrs, i) => expect(got[i]).toEqual(attrs));
      }
      expect(drawn).not.toContain("var(");
    });

    it("yields to a redaction: a deleted account's disc stays empty", () => {
      render(<MonogramAvatar name="x" mark redacted testId="avatar" />);
      expect(screen.getByTestId("avatar").querySelector("svg")).toBeNull();
    });

    it("is never drawn unless asked for", () => {
      render(<MonogramAvatar name="Mira" testId="avatar" />);
      expect(screen.getByTestId("avatar").querySelector("svg")).toBeNull();
      expect(screen.getByText("M")).toBeInTheDocument();
    });
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
