// Restore on a browser without WebCrypto Ed25519 (Restore.md:3-5,
// KeyCeremonyUnsupported.md:5): every `Restore the key` opens this route, and
// here the refusal stands in the restore's place — the restore never opens and
// the code is never typed.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RestorePage from "./page";

const { canHold } = vi.hoisted(() => ({ canHold: { value: true } }));
vi.mock("@/lib/crypto/hashing", async (actual) => ({
  ...(await actual<typeof import("@/lib/crypto/hashing")>()),
  ed25519Available: () => Promise.resolve(canHold.value),
}));
// The form itself is RestoreForm's suite; here the page's gate is under test.
vi.mock("./restore-form", () => ({
  RestoreForm: () => <input data-testid="restore_code" aria-label="Recovery code" />,
}));

describe("/restore", () => {
  beforeEach(() => {
    canHold.value = true;
  });

  it("opens the restore on a browser that can hold a key", async () => {
    render(<RestorePage />);
    expect(await screen.findByTestId("restore_code")).toBeInTheDocument();
    expect(screen.queryByTestId("keyCeremonyUnsupported.notice")).toBeNull();
  });

  it("opens KeyCeremonyUnsupported in the restore's place on a browser that cannot, and the code is never typed", async () => {
    canHold.value = false;
    render(<RestorePage />);
    expect(await screen.findByTestId("keyCeremonyUnsupported.notice")).toBeInTheDocument();
    expect(screen.queryByTestId("restore_code")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    // never the false line of a server that could not be reached
    expect(document.body).not.toHaveTextContent("Can't reach the server");
  });

  it("its arrow reads Back and goes to the restore's own home, the feed (KeyElsewhere, ApplicantKeyElsewhere)", async () => {
    canHold.value = false;
    render(<RestorePage />);
    const back = await screen.findByTestId("keyCeremonyUnsupported.header.back");
    expect(back).toHaveAccessibleName("Back");
    expect(back).toHaveAttribute("href", "/");
  });
});
