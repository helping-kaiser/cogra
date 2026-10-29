// WalletComingSoon.md, compiled line by line: the bar's Wallet slot opens a
// tab root wearing the coming-soon door, one face for every reader state.

import { fireEvent, screen, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { WalletView } from "./wallet-view";

const push = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer();

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  server.use(
    gqlLink.query("NotificationBell", () =>
      HttpResponse.json({ data: { me: { __typename: "User", id: "me", hasUnreadNotifications: false } } }),
    ),
  );
});

describe("WalletComingSoon", () => {
  it.each([
    ["a member", true],
    ["a guest", false],
  ])("wallet_md_3_5_7_the_door_reads_the_same_for_%s_with_no_action_and_no_date", (_who, member) => {
    renderWithProviders(<WalletView />, member ? { store: signedIn() } : {});
    const card = screen.getByTestId(byNode("wallet.comingSoonCard"));
    expect(within(card).getByRole("heading")).toHaveTextContent("Wallet — coming soon");
    expect(within(card).getByTestId(byNode("wallet.comingSoonCard.title"))).toBe(
      within(card).getByRole("heading"),
    );
    expect(within(card).getByTestId(byNode("wallet.comingSoonCard.line"))).toHaveTextContent(
      "Your earnings will be here.",
    );
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(card).queryByRole("link")).toBeNull();
    // A root: no back arrow.
    expect(screen.queryByRole("link", { name: /^Back/ })).toBeNull();
  });

  it("wallet_md_11_the_band_carries_chats_and_the_bell_for_a_signed_in_reader", () => {
    renderWithProviders(<WalletView />, { store: signedIn() });
    fireEvent.click(screen.getByRole("button", { name: "Chats" }));
    expect(push).toHaveBeenCalledWith("/chats?from=wallet");
    expect(screen.getByTestId(byNode("wallet.band.bell"))).toBeInTheDocument();
  });

  it("wallet_md_13_15_a_guests_band_is_bare_and_its_chats_open_the_guest_gate", () => {
    renderWithProviders(<WalletView />);
    expect(screen.queryByTestId(byNode("wallet.band.bell"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chats" }));
    expect((screen.getByTestId("join-prompt") as HTMLDialogElement).open).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});
