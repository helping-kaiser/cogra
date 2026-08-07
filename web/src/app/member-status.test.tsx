import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MeUser } from "@/lib/api/auth-api";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { MemberStatus } from "./member-status";

const server = startMswServer();

const invited: MeUser = {
  id: "u1",
  handle: "ada",
  displayName: null,
  accountState: "MEMBER",
  hasReciprocated: false,
  invitedBy: { id: "u0", handle: "grace" },
};

// Vacuously reciprocated, as the server answers without an inviter.
const genesis: MeUser = { ...invited, invitedBy: null, hasReciprocated: true };

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1" });
  return store;
}

function prepareStanceHandler(
  onVariables?: (variables: Record<string, unknown>) => void,
) {
  return graphql.mutation("PrepareStance", ({ variables }) => {
    onVariables?.(variables);
    return HttpResponse.json({
      data: {
        prepareStance: {
          __typename: "PreparePayload",
          writes: [
            {
              __typename: "PreparedWrite",
              id: "w1",
              family: "OPINION",
              canonicalProposal: "cHJvcG9zYWw=",
            },
          ],
          userErrors: [],
        },
      },
    });
  });
}

describe("MemberStatus", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("prompts an invited member whose key is on this device", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true });
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("home_reciprocation")).toHaveTextContent(
      "@grace vouched you in",
    );
  });

  it("shows no prompt to a genesis member", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true });
    renderWithProviders(<MemberStatus me={genesis} store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await waitFor(() =>
      expect(screen.queryByTestId("home_reciprocation")).not.toBeInTheDocument(),
    );
  });

  it("shows the husk warning and no prompt when the key lives elsewhere", async () => {
    const store = fakeIdentityStore({ keyOnDevice: false });
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("home_restore")).toBeInTheDocument();
    expect(screen.queryByTestId("home_reciprocation")).not.toBeInTheDocument();
  });

  it("shows no prompt once the device remembers a dismissal", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true, reciprocationDismissed: true });
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await waitFor(() =>
      expect(screen.queryByTestId("home_reciprocation")).not.toBeInTheDocument(),
    );
  });

  it("the server's answer silences the prompt on a fresh device", async () => {
    // Reciprocated elsewhere: no local bit, still no prompt.
    const store = fakeIdentityStore({ keyOnDevice: true });
    renderWithProviders(
      <MemberStatus me={{ ...invited, hasReciprocated: true }} store={store} />,
      { store: signedInStore(), writeSigner: fakeWriteSigner() },
    );
    await waitFor(() =>
      expect(screen.queryByTestId("home_reciprocation")).not.toBeInTheDocument(),
    );
    await expect(store.reciprocationDismissed()).resolves.toBe(false);
  });

  it("reciprocating prepares the stance and signs without touching the device bit", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(prepareStanceHandler((v) => (variables = v)));
    const store = fakeIdentityStore({ keyOnDevice: true });
    const writeSigner = fakeWriteSigner();
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner,
    });

    fireEvent.click(await screen.findByTestId("home_reciprocate"));
    expect(await screen.findByTestId("home_reciprocated")).toBeInTheDocument();
    expect(screen.queryByTestId("home_reciprocation")).not.toBeInTheDocument();
    expect(writeSigner.signStaged).toHaveBeenCalledWith(
      expect.objectContaining({ id: "w1", state: "AWAITING_PRE_SIGN", verifiedAct: null }),
    );
    expect(variables).toEqual({
      input: { target: "u0", pDirected: 0.1, pInterest: 0.1 },
    });
    // The graph knows (the staged write is in flight); the device bit
    // is dismissal memory only.
    await expect(store.reciprocationDismissed()).resolves.toBe(false);
  });

  it("keeps the prompt and surfaces the failure when signing does not finish", async () => {
    server.use(prepareStanceHandler());
    const store = fakeIdentityStore({ keyOnDevice: true });
    const writeSigner = fakeWriteSigner({
      signStaged: vi.fn(() =>
        Promise.resolve({ kind: "failed" as const, id: "w1", cause: new Error("offline") }),
      ),
    });
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner,
    });

    fireEvent.click(await screen.findByTestId("home_reciprocate"));
    expect(await screen.findByTestId("home_signing_failed")).toBeInTheDocument();
    expect(screen.getByTestId("home_reciprocation")).toBeInTheDocument();
    await expect(store.reciprocationDismissed()).resolves.toBe(false);
  });

  it("keeps the prompt when the prepare itself fails", async () => {
    server.use(graphql.mutation("PrepareStance", () => HttpResponse.error()));
    const store = fakeIdentityStore({ keyOnDevice: true });
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });

    fireEvent.click(await screen.findByTestId("home_reciprocate"));
    expect(await screen.findByTestId("home_signing_failed")).toBeInTheDocument();
    await expect(store.reciprocationDismissed()).resolves.toBe(false);
  });

  it("dismissal is remembered too", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true });
    renderWithProviders(<MemberStatus me={invited} store={store} />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });

    fireEvent.click(await screen.findByTestId("home_reciprocate_skip"));
    await waitFor(() =>
      expect(screen.queryByTestId("home_reciprocation")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("home_reciprocated")).not.toBeInTheDocument();
    await expect(store.reciprocationDismissed()).resolves.toBe(true);
  });

  it("offers to resume parked handshakes", async () => {
    const store = fakeIdentityStore({ keyOnDevice: true, handshakeIds: ["w1", "w2"] });
    const writeSigner = fakeWriteSigner();
    renderWithProviders(<MemberStatus me={genesis} store={store} />, {
      store: signedInStore(),
      writeSigner,
    });

    expect(await screen.findByTestId("home_pending")).toHaveTextContent("2 signed act(s)");
    fireEvent.click(screen.getByTestId("home_resume"));
    await waitFor(() => expect(writeSigner.resume).toHaveBeenCalled());
  });
});
