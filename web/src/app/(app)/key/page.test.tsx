// The key-making doors on a browser without WebCrypto Ed25519
// (KeyCeremony.md:9-13, KeyCeremonyUnsupported.md:3): `Create my key`, the
// fresh-key card and the settings key rows open this route, and here the
// refusal stands in the ceremony's place — nothing is minted.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import KeyPage from "./page";

const { canHold, minted } = vi.hoisted(() => ({ canHold: { value: true }, minted: { count: 0 } }));
vi.mock("@/lib/crypto/hashing", async (actual) => ({
  ...(await actual<typeof import("@/lib/crypto/hashing")>()),
  ed25519Available: () => Promise.resolve(canHold.value),
}));
// The ceremony itself is KeyCeremonyView's suite; the stub counts a mount as
// the ceremony having opened.
vi.mock("./key-ceremony-view", () => ({
  KeyCeremonyView: () => {
    minted.count++;
    return <p data-testid="backup_accept">Create my recovery code</p>;
  },
}));

const page = async (params: Record<string, string> = {}) => render(await KeyPage({ searchParams: Promise.resolve(params) }));

describe("/key", () => {
  beforeEach(() => {
    canHold.value = true;
    minted.count = 0;
  });

  it("opens the ceremony on a browser that can hold a key", async () => {
    await page();
    expect(await screen.findByTestId("backup_accept")).toBeInTheDocument();
    expect(screen.queryByTestId("keyCeremonyUnsupported.notice")).toBeNull();
  });

  it("opens KeyCeremonyUnsupported in the ceremony's place on a browser that cannot, and the ceremony never opens", async () => {
    canHold.value = false;
    await page();
    expect(await screen.findByTestId("keyCeremonyUnsupported.notice")).toBeInTheDocument();
    expect(screen.queryByTestId("backup_accept")).toBeNull();
    expect(minted.count).toBe(0);
  });

  it("from the task card or the key-elsewhere card, Back goes to the applicant's feed", async () => {
    canHold.value = false;
    await page();
    const back = await screen.findByTestId("keyCeremonyUnsupported.header.back");
    expect(back).toHaveAccessibleName("Back");
    expect(back).toHaveAttribute("href", "/");
  });

  it("from a key row in settings, Back goes to Settings", async () => {
    canHold.value = false;
    await page({ from: "settings" });
    expect(await screen.findByTestId("keyCeremonyUnsupported.header.back")).toHaveAttribute("href", "/settings");
  });
});
