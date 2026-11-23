// The key-making doors on a browser without WebCrypto Ed25519
// (KeyCeremony.md:9-13, KeyCeremonyUnsupported.md:3): `Create my key`, the
// fresh-key card and the settings key rows open this route, and here the
// refusal stands in the ceremony's place — nothing is minted.
//
// And the address itself (jakob 2026-11-23, seam 405/411): a member who has a
// key lands where settings' `Your key` row opens, never the ceremony; every
// other reader meets the route as before.

import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import KeyPage from "./page";

type Account = { accountState: "APPLICANT" | "MEMBER"; actorPubkey: string | null };

const { canHold, minted, read, redirect } = vi.hoisted(() => ({
  canHold: { value: true },
  minted: { count: 0 },
  read: { answer: null as null | Promise<{ kind: "success"; value: Account } | { kind: "networkError" }> },
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
}));
vi.mock("@/lib/crypto/hashing", async (actual) => ({
  ...(await actual<typeof import("@/lib/crypto/hashing")>()),
  ed25519Available: () => Promise.resolve(canHold.value),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@apollo/client/react", async (actual) => ({
  ...(await actual<typeof import("@apollo/client/react")>()),
  useApolloClient: () => ({}),
}));
const guard = { run: <T,>(op: () => Promise<T>) => op() };
vi.mock("@/lib/session/runtime", () => ({ useAuthGuard: () => guard }));
vi.mock("@/lib/api/settings-api", () => ({
  fetchSettingsAccount: () => read.answer,
}));
// The ceremony itself is KeyCeremonyView's suite; the stub counts a mount as
// the ceremony having opened.
vi.mock("./key-ceremony-view", () => ({
  KeyCeremonyView: () => {
    minted.count++;
    return <p data-testid="backup_accept">Create my recovery code</p>;
  },
}));

/** Next's redirect boundary, as the App Router wraps a page: a thrown redirect lands. */
class RedirectBoundary extends Component<{ children: ReactNode }, { to: string | null }> {
  state = { to: null };
  static getDerivedStateFromError(error: { to?: string }) {
    return { to: error.to ?? "error" };
  }
  render() {
    return this.state.to === null ? this.props.children : <p data-testid="landed">{this.state.to}</p>;
  }
}

const answered = (account: Account) => Promise.resolve({ kind: "success" as const, value: account });
const APPLICANT_BEFORE_KEY: Account = { accountState: "APPLICANT", actorPubkey: null };
const APPLICANT_WITH_KEY: Account = { accountState: "APPLICANT", actorPubkey: "pk" };
const MEMBER: Account = { accountState: "MEMBER", actorPubkey: "pk" };

const page = async (params: Record<string, string> = {}) =>
  render(<RedirectBoundary>{await KeyPage({ searchParams: Promise.resolve(params) })}</RedirectBoundary>);

describe("/key", () => {
  beforeEach(() => {
    canHold.value = true;
    minted.count = 0;
    read.answer = answered(APPLICANT_BEFORE_KEY);
    redirect.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
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

  describe("by address", () => {
    it("a member with a key lands on what settings' Your key row opens, and the ceremony never opens", async () => {
      read.answer = answered(MEMBER);
      await page();
      expect(await screen.findByTestId("landed")).toHaveTextContent("/settings/key");
      expect(redirect).toHaveBeenCalledWith("/settings/key");
      expect(minted.count).toBe(0);
    });

    it("a member with a key on a browser that cannot hold one lands there too — the row opens it on any browser", async () => {
      read.answer = answered(MEMBER);
      canHold.value = false;
      await page();
      expect(await screen.findByTestId("landed")).toHaveTextContent("/settings/key");
      expect(screen.queryByTestId("keyCeremonyUnsupported.notice")).toBeNull();
    });

    it("nothing is drawn while the account read runs — no ceremony for a frame", async () => {
      read.answer = new Promise(() => {});
      const { container } = await page();
      // long enough for the custody probe to answer, which on its own would draw the ceremony
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(container).toBeEmptyDOMElement();
      expect(minted.count).toBe(0);
    });

    it("an applicant before any key meets the ceremony as before", async () => {
      read.answer = answered(APPLICANT_BEFORE_KEY);
      await page();
      expect(await screen.findByTestId("backup_accept")).toBeInTheDocument();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("an applicant whose key is attached meets the route as before (the ceremony sends them home itself)", async () => {
      read.answer = answered(APPLICANT_WITH_KEY);
      await page();
      expect(await screen.findByTestId("backup_accept")).toBeInTheDocument();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("a read that does not answer leaves the route as before", async () => {
      read.answer = Promise.resolve({ kind: "networkError" as const });
      await page();
      expect(await screen.findByTestId("backup_accept")).toBeInTheDocument();
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
