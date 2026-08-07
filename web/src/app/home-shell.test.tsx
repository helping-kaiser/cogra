import { act, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { HomeShell } from "./home-shell";

const server = startMswServer();

function meHandler(accountState: "APPLICANT" | "MEMBER", handle = "ada") {
  return graphql.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle,
          displayName: null,
          accountState,
          invitedBy: null,
        },
      },
    }),
  );
}

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1" });
  return store;
}

describe("HomeShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("greets a member and starts no poll loop", async () => {
    server.use(meHandler("MEMBER"));
    const { flow } = fakeFlow();
    renderWithProviders(<HomeShell />, { store: signedInStore(), flow });
    expect(await screen.findByTestId("home_greeting")).toHaveTextContent("@ada");
    expect(flow.ensureAdvancing).not.toHaveBeenCalled();
    expect(screen.queryByTestId("home_status_loading")).not.toBeInTheDocument();
  });

  it("starts the poll loop for an applicant and renders its progress", async () => {
    server.use(meHandler("APPLICANT"));
    const { flow, emit } = fakeFlow();
    renderWithProviders(<HomeShell />, { store: signedInStore(), flow });
    await waitFor(() => expect(flow.ensureAdvancing).toHaveBeenCalled());
    expect(screen.getByTestId("home_status_loading")).toBeInTheDocument();

    act(() => {
      emit({ kind: "awaitingApproval", emailVerified: false, keyAttached: false, keyOnDevice: false });
    });
    expect(screen.getByTestId("home_verify")).toBeInTheDocument();
    expect(screen.getByTestId("home_create_key")).toBeInTheDocument();
  });

  it("greets a watched landing once and re-reads the viewer", async () => {
    server.use(meHandler("APPLICANT"));
    const { flow, emit } = fakeFlow();
    (flow.consumeLanded as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);
    renderWithProviders(<HomeShell />, { store: signedInStore(), flow });
    await screen.findByTestId("home_greeting");

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
    server.use(graphql.query("Me", () => HttpResponse.error()));
    renderWithProviders(<HomeShell />, { store: signedInStore() });
    expect(await screen.findByTestId("home_transport_error")).toBeInTheDocument();
  });
});
