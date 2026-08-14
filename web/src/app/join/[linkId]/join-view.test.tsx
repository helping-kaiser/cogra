import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RegisterMutationVariables } from "@/__generated__/graphql";
import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { JoinView } from "./join-view";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const server = startMswServer();

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

const usableCheck = graphql.query("InviteLinkCheck", () =>
  HttpResponse.json({
    data: {
      inviteLinkCheck: {
        __typename: "InviteLinkCheck",
        usable: true,
        inviterHandle: "grace",
        expiresAt: "2026-08-08T00:00:00Z",
      },
    },
  }),
);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function meHandler(accountState: "APPLICANT" | "MEMBER") {
  return graphql.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          invitedBy: null,
        },
      },
    }),
  );
}

describe("JoinView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  it("shows who is vouching and the apply form on a usable invite", async () => {
    server.use(usableCheck);
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_inviter")).toHaveTextContent("@grace");
    expect(screen.getByTestId("apply_handle")).toBeInTheDocument();
  });

  it("refuses an unknown invite before the form", async () => {
    server.use(
      graphql.query("InviteLinkCheck", () => HttpResponse.json({ data: { inviteLinkCheck: null } })),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_error")).toBeInTheDocument();
    expect(screen.queryByTestId("apply_handle")).not.toBeInTheDocument();
  });

  it("refuses an unusable invite before the form", async () => {
    server.use(
      graphql.query("InviteLinkCheck", () =>
        HttpResponse.json({
          data: {
            inviteLinkCheck: {
              __typename: "InviteLinkCheck",
              usable: false,
              inviterHandle: "grace",
              expiresAt: "2026-08-08T00:00:00Z",
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_error")).toBeInTheDocument();
  });

  it("flags a path segment with no invite in it without a network call", () => {
    renderWithProviders(<JoinView linkId="not-an-invite" />);
    expect(screen.getByTestId("invite_error")).toBeInTheDocument();
  });

  it("surfaces a transport fault on the check", async () => {
    server.use(graphql.query("InviteLinkCheck", () => HttpResponse.error()));
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_transport_error")).toBeInTheDocument();
  });

  it("registers, stores the session, and goes home", async () => {
    const captured: RegisterMutationVariables[] = [];
    server.use(
      usableCheck,
      graphql.mutation("Register", ({ variables }) => {
        captured.push(variables as RegisterMutationVariables);
        return HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-1",
                refreshToken: "refresh-1",
                user: { __typename: "User", id: "acct-1" },
              },
              expiresAt: "2026-08-08T00:00:00Z",
              userErrors: [],
            },
          },
        });
      }),
    );
    const { store } = renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");

    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByTestId("apply_continue"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(store.hasSession()).toBe(true);
    // The handle is lowercased on entry and the invite rides the input.
    expect(captured[0]?.input).toMatchObject({ handle: "ada", inviteLink: ID });
  });

  it("keeps the submit disabled until the form is plausible", async () => {
    server.use(usableCheck);
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");
    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), { target: { value: "short" } });
    expect(screen.getByTestId("apply_continue")).toBeDisabled();
  });

  it("pins a registration refusal to the form", async () => {
    server.use(
      usableCheck,
      graphql.mutation("Register", () =>
        HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: null,
              expiresAt: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "taken",
                  code: "HANDLE_TAKEN",
                  field: ["handle"],
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");
    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByTestId("apply_continue"));
    expect(await screen.findByTestId("apply_error")).toHaveTextContent("taken");
  });

  it("renders a rate-limited registration as a backoff, not a connectivity failure", async () => {
    server.use(
      usableCheck,
      graphql.mutation("Register", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");
    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByTestId("apply_continue"));
    expect(await screen.findByTestId("apply_error")).toHaveTextContent(
      "Too many attempts — wait a moment and try again.",
    );
    expect(screen.queryByTestId("apply_transport_error")).not.toBeInTheDocument();
  });

  it("offers re-arm instead of the form to a signed-in applicant", async () => {
    server.use(usableCheck, meHandler("APPLICANT"));
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    expect(await screen.findByTestId("rearm_submit")).toBeInTheDocument();
    expect(screen.queryByTestId("apply_handle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invite_login")).not.toBeInTheDocument();
  });

  it("offers a member no action — the invite is for someone new", async () => {
    server.use(usableCheck, meHandler("MEMBER"));
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    expect(await screen.findByTestId("join_member_note")).toBeInTheDocument();
    expect(screen.getByTestId("join_member_invites")).toHaveAttribute("href", "/invites");
    expect(screen.queryByTestId("rearm_submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("apply_handle")).not.toBeInTheDocument();
  });

  it("offers no action while the account state is unknown", async () => {
    server.use(usableCheck, graphql.query("Me", () => HttpResponse.error()));
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    expect(await screen.findByTestId("invite_inviter")).toBeInTheDocument();
    expect(screen.queryByTestId("rearm_submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("join_member_note")).not.toBeInTheDocument();
  });

  it("re-arms, pokes the loop, and goes home", async () => {
    server.use(
      usableCheck,
      meHandler("APPLICANT"),
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          data: {
            applyWithInvite: {
              __typename: "ApplyWithInvitePayload",
              application: { __typename: "Application", id: "app-2" },
              userErrors: [],
            },
          },
        }),
      ),
    );
    const { flow } = fakeFlow();
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore(), flow });
    fireEvent.click(await screen.findByTestId("rearm_submit"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(flow.ensureAdvancing).toHaveBeenCalled();
  });

  it("surfaces a re-arm refusal", async () => {
    server.use(
      usableCheck,
      meHandler("APPLICANT"),
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          data: {
            applyWithInvite: {
              __typename: "ApplyWithInvitePayload",
              application: null,
              userErrors: [
                { __typename: "UserError", message: "live", code: "BAD_INPUT", field: null },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    fireEvent.click(await screen.findByTestId("rearm_submit"));
    expect(await screen.findByTestId("rearm_error")).toHaveTextContent("still live");
  });
});
