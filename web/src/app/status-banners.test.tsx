import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSecurityNotices } from "@/lib/session/security-notices";
import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { StatusBanners } from "./status-banners";

const server = startMswServer();

function meHandler(accountState: "APPLICANT" | "MEMBER", handle = "ada") {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle,
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

describe("StatusBanners", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("says a dead device lock once, and Got it puts it away for good", async () => {
    // PR-62: the sign-in completed, the dead ciphertext was deleted, and the
    // shell says so in the notice vehicle.
    server.use(meHandler("MEMBER"));
    const notices = createSecurityNotices();
    notices.postLockLost();
    renderWithProviders(<StatusBanners notices={notices} />, { store: signedInStore() });
    expect(screen.getByTestId("lock_lost_notice")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("lock_lost_notice_dismiss"));
    expect(screen.queryByTestId("lock_lost_notice")).not.toBeInTheDocument();
    expect(notices.lockLost()).toBe(false);
  });

  it("stays quiet for a settled member and starts no poll loop", async () => {
    server.use(meHandler("MEMBER"));
    const { flow } = fakeFlow();
    renderWithProviders(<StatusBanners />, { store: signedInStore(), flow });
    await waitFor(() =>
      expect(screen.queryByTestId("home_loading")).not.toBeInTheDocument(),
    );
    expect(flow.ensureAdvancing).not.toHaveBeenCalled();
    expect(screen.queryByTestId("home_status_loading")).not.toBeInTheDocument();
  });

  it("starts the poll loop for an applicant and renders its progress", async () => {
    server.use(
      meHandler("APPLICANT"),
      gqlLink.query("MyApplication", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              askLink: null,
              application: {
                __typename: "Application",
                id: "a1",
                approvedAt: null,
                rejectedAt: null,
                landedAt: null,
                approver: { __typename: "User", id: "u9", handle: "mira" },
              },
            },
          },
        }),
      ),
    );
    const { flow, emit } = fakeFlow();
    renderWithProviders(<StatusBanners />, { store: signedInStore(), flow });
    await waitFor(() => expect(flow.ensureAdvancing).toHaveBeenCalled());
    expect(screen.getByTestId("home_status_loading")).toBeInTheDocument();

    act(() => {
      emit({ kind: "awaitingApproval", emailVerified: false, keyAttached: false, keyOnDevice: false });
    });
    expect(screen.getByTestId("feed.verifyCard")).toBeInTheDocument();
    expect(await screen.findByTestId("feed.keyCard.create")).toBeInTheDocument();
  });

  it("greets a watched landing once and re-reads the viewer", async () => {
    server.use(meHandler("APPLICANT"));
    const { flow, emit } = fakeFlow();
    (flow.consumeLanded as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    renderWithProviders(<StatusBanners />, { store: signedInStore(), flow });
    await waitFor(() =>
      expect(screen.queryByTestId("home_loading")).not.toBeInTheDocument(),
    );

    server.use(meHandler("MEMBER"));
    act(() => {
      emit({ kind: "member" });
    });
    expect(await screen.findByTestId("home_welcome")).toBeInTheDocument();
    // The applicant cards are gone once the refreshed viewer is a member.
    await waitFor(() =>
      expect(screen.queryByTestId("home_status_loading")).not.toBeInTheDocument(),
    );
  });

  it("surfaces a transport fault on the viewer read", async () => {
    server.use(gqlLink.query("Me", () => HttpResponse.error()));
    renderWithProviders(<StatusBanners />, { store: signedInStore() });
    expect(await screen.findByTestId("home_transport_error")).toBeInTheDocument();
  });

  it("renders a pending security notice and dismisses it for good", async () => {
    server.use(meHandler("MEMBER"));
    const notices = createSecurityNotices();
    notices.post("2026-08-10T09:30:00Z");
    renderWithProviders(<StatusBanners notices={notices} />, { store: signedInStore() });
    expect(await screen.findByTestId("security_notice")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("security_notice_dismiss"));
    expect(screen.queryByTestId("security_notice")).not.toBeInTheDocument();
    expect(notices.reuseDetectedAt()).toBeNull();
  });

  it("shows no security notice when none is pending", async () => {
    server.use(meHandler("MEMBER"));
    renderWithProviders(<StatusBanners notices={createSecurityNotices()} />, {
      store: signedInStore(),
    });
    await waitFor(() =>
      expect(screen.queryByTestId("home_loading")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("security_notice")).not.toBeInTheDocument();
  });
});
