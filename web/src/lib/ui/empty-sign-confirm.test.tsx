// The empty-sign ask, line by line: design/components/stance/EmptySignConfirm.jsx
// and design/designs/canonical/behavior/EmptySignConfirm.md. Its words are
// read out of the master, not transcribed, so a wording edited there and not
// here fails.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_SIGN_WORDS, EmptySignConfirm } from "./empty-sign-confirm";

// jsdom's `import.meta.url` is not a file URL; vitest runs from `web/`.
const MASTER = readFileSync(
  join(process.cwd(), "..", "design", "components", "stance", "EmptySignConfirm.jsx"),
  "utf-8",
);

function show(props: Partial<React.ComponentProps<typeof EmptySignConfirm>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<EmptySignConfirm targetLabel="@ada" onConfirm={onConfirm} onCancel={onCancel} {...props} />);
  return { onConfirm, onCancel };
}

describe("the empty-sign ask", () => {
  it("carries the master's words verbatim", () => {
    for (const field of ["title", "cost", "confirm", "busy", "keep"] as const) {
      expect(MASTER, field).toContain(`${field}: ${JSON.stringify(EMPTY_SIGN_WORDS[field])}`);
    }
    expect(MASTER).toContain(EMPTY_SIGN_WORDS.effect("${targetLabel}"));
    expect(MASTER).toContain(EMPTY_SIGN_WORDS.vouchIn("${targetLabel}"));
    expect(MASTER).toContain("That didn&apos;t send. Try again.");
  });

  it("reads, in order, its title, what the record does and its cost (EmptySignConfirm.md:7)", () => {
    show();
    const dialog = screen.getByTestId<HTMLDialogElement>("empty-sign-confirm");
    expect(dialog.open).toBe(true);
    expect(dialog).toHaveTextContent(
      "Sign an empty opinion?" +
        "This says nothing about @ada, shapes no feed, and leaves you where you are." +
        "It signs 1 thing, paid on its own.",
    );
    expect(dialog).not.toHaveTextContent("Walk it all back?");
  });

  it("swaps the first line for the vouch-in warning where the opinion vouches someone in (:9)", () => {
    show({ targetLabel: "@rafa", vouchIn: true });
    expect(screen.getByTestId("empty-sign-effect")).toHaveTextContent(
      "@rafa would be vouched in but start out cut off: no feed can carry them, and community funds stay closed to them, until someone gives them an opinion that says something.",
    );
    expect(screen.getByTestId("empty-sign-cost")).toHaveTextContent("It signs 1 thing, paid on its own.");
  });

  it("puts Keep it filled on the right and Set it anyway quiet on the left (:15)", () => {
    show();
    const proceed = screen.getByTestId("empty-sign-proceed");
    const keep = screen.getByTestId("empty-sign-keep");
    expect([...proceed.parentElement!.children]).toEqual([proceed, keep]);
    expect(proceed).toHaveTextContent("Set it anyway");
    expect(keep).toHaveTextContent("Keep it");
    // The filled answer is the primary button; the act is a text button.
    expect(keep.className).not.toBe(proceed.className);
  });

  it("asks, never blocks: Set it anyway is enabled and signs (:5)", () => {
    const { onConfirm, onCancel } = show();
    const proceed = screen.getByTestId<HTMLButtonElement>("empty-sign-proceed");
    expect(proceed.disabled).toBe(false);
    fireEvent.click(proceed);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("closes on Keep it and on Escape, signing nothing (:35, :37)", () => {
    const { onConfirm, onCancel } = show();
    fireEvent.click(screen.getByTestId("empty-sign-keep"));
    fireEvent(screen.getByTestId("empty-sign-confirm"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("waits while it signs: inert, never dimmed, Setting… past 200ms, the ways out locked (:23, :25, :39)", () => {
    const { onConfirm, onCancel } = show({ busy: true, slow: true });
    const proceed = screen.getByTestId<HTMLButtonElement>("empty-sign-proceed");
    expect(proceed).toHaveTextContent("Setting…");
    expect(proceed.disabled).toBe(false);
    expect(proceed).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(proceed);
    fireEvent.click(screen.getByTestId("empty-sign-keep"));
    fireEvent(screen.getByTestId("empty-sign-confirm"), new Event("cancel", { cancelable: true }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("stays up when the signing did not go through, with the fault line and Retry (:33)", () => {
    show({ failed: true });
    expect(screen.getByTestId("empty-sign-failed")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("empty-sign-proceed")).toHaveTextContent("Retry");
  });
});
