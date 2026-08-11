import { screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { RootView } from "./root-view";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const server = startMswServer();

const meMember = graphql.query("Me", () =>
  HttpResponse.json({
    data: {
      me: {
        __typename: "User",
        id: "user-1",
        handle: "tester",
        displayName: null,
        accountState: "MEMBER",
        hasReciprocated: true,
        invitedBy: null,
      },
    },
  }),
);

const meAnonymous = graphql.query("Me", () => HttpResponse.json({ data: { me: null } }));

const refreshInvalid = graphql.mutation("RefreshSession", () =>
  HttpResponse.json({
    data: {
      refreshSession: {
        __typename: "RefreshPayload",
        auth: null,
        userErrors: [
          {
            __typename: "UserError",
            code: "REFRESH_TOKEN_INVALID",
            message: "rotated",
            field: null,
          },
        ],
      },
    },
  }),
);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("RootView", () => {
  it("shows the front door when signed out", () => {
    renderWithProviders(<RootView />);
    expect(screen.getByTestId("invite_login")).toBeInTheDocument();
  });

  it("shows the member shell with the viewer's greeting when signed in", async () => {
    server.use(meMember);
    renderWithProviders(<RootView />, { store: signedInStore() });
    expect(screen.getByTestId("home_loading")).toBeInTheDocument();
    expect(await screen.findByTestId("home_greeting")).toHaveTextContent("@tester");
    expect(screen.queryByTestId("home_loading")).not.toBeInTheDocument();
  });

  it("keeps transport failures in their own slot", async () => {
    server.use(graphql.query("Me", () => HttpResponse.error()));
    renderWithProviders(<RootView />, { store: signedInStore() });
    expect(await screen.findByTestId("home_transport_error")).toBeInTheDocument();
  });

  it("tears down to the front door when the session is dead", async () => {
    // A null viewer read is UNAUTHENTICATED; the refresh comes back
    // REFRESH_TOKEN_INVALID, the store clears, and the phase flip lands
    // on the front door — the shell never navigates itself.
    server.use(meAnonymous, refreshInvalid);
    const store = signedInStore();
    renderWithProviders(<RootView />, { store });
    await waitFor(() => expect(store.hasSession()).toBe(false));
    expect(await screen.findByTestId("invite_login")).toBeInTheDocument();
  });
});
