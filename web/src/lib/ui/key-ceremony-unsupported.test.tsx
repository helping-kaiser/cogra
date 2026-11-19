import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KeyCeremonyUnsupported } from "./key-ceremony-unsupported";

// The board and its sidecar, read from the tree (design/ is the law).
const CANONICAL = new URL("../../../../design/designs/canonical/", import.meta.url);
const BOARD = readFileSync(new URL("KeyCeremonyUnsupported.dc.html", CANONICAL), "utf8");
const SIDECAR = readFileSync(new URL("behavior/KeyCeremonyUnsupported.md", CANONICAL), "utf8");
const unescape = (s: string) => s.replace(/&#x27;/g, "'");

describe("KeyCeremonyUnsupported", () => {
  it("prints the board's words: the page title, the notice's title and line, the app's door", () => {
    render(<KeyCeremonyUnsupported backHref="/" />);
    const board = unescape(BOARD);
    for (const words of [
      "Your key",
      "This browser can't hold a key",
      "Open CoGra in a current Chrome, Firefox or Safari, or in the Android app.",
      "On Android? Download the app (APK)",
    ]) {
      expect(board).toContain(`>${words}<`);
    }
    expect(screen.getByTestId("keyCeremonyUnsupported.title")).toHaveTextContent(/^Your key$/);
    expect(screen.getByTestId("keyCeremonyUnsupported.notice.title")).toHaveTextContent(
      /^This browser can't hold a key$/,
    );
    expect(screen.getByTestId("keyCeremonyUnsupported.notice.body")).toHaveTextContent(
      /^Open CoGra in a current Chrome, Firefox or Safari, or in the Android app\.$/,
    );
  });

  it("the notice wears the key-absent register, never the error colour", () => {
    expect(SIDECAR).toContain("ALWAYS the notice This browser can't hold a key wears the key-absent register, never the error colour");
    render(<KeyCeremonyUnsupported backHref="/" />);
    const notice = screen.getByTestId("keyCeremonyUnsupported.notice");
    expect(notice).toHaveClass("bg-tertiary-container", "text-on-tertiary-container", "rounded-large");
    expect(notice.outerHTML).not.toMatch(/\berror\b/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers no commitment and no ?: its only controls are the back arrow and the app's door", () => {
    render(<KeyCeremonyUnsupported backHref="/" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("data-testid"))).toEqual([
      "keyCeremonyUnsupported.header.back",
      "keyCeremonyUnsupported.notice.download",
    ]);
  });

  it("the app's door is the login landing's own download", () => {
    render(<KeyCeremonyUnsupported backHref="/" />);
    const door = screen.getByTestId("keyCeremonyUnsupported.notice.download");
    expect(door).toHaveAttribute("href", "/downloads/app-debug.apk");
    expect(door).toHaveAttribute("download");
    expect(door).toHaveTextContent(/^On Android\? Download the app \(APK\)$/);
    expect(door).toHaveClass("underline", "text-body-medium");
    expect(BOARD).toContain('href="/downloads/app-debug.apk" download=""');
  });

  it("the header's arrow reads Back and is a link to where the ceremony was opened from", () => {
    render(<KeyCeremonyUnsupported backHref="/settings" />);
    const back = screen.getByTestId("keyCeremonyUnsupported.header.back");
    expect(back).toHaveAccessibleName("Back");
    expect(back).toHaveAttribute("href", "/settings");
    expect(BOARD).toContain('aria-label="Back"');
    // the header carries no title of its own: the page's h1 is `Your key`
    expect(within(screen.getByTestId("keyCeremonyUnsupported.header")).queryByRole("heading")).toBeNull();
  });

  it("stands in the page's flow, so the shell's scroller scrolls it when it outgrows the screen", () => {
    render(<KeyCeremonyUnsupported backHref="/" />);
    const main = screen.getByRole("main");
    expect(main.className).not.toMatch(/overflow-hidden|h-screen|fixed/);
  });
});
