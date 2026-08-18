import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { InvitesView } from "./invites-view";

const server = startMswServer();

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

type ApplicationFields = {
  id: string;
  handle: string;
  emailVerified: boolean;
  keyAttached: boolean;
  approvedAt: string | null;
  landedAt: string | null;
};

function application(overrides: Partial<ApplicationFields> = {}): ApplicationFields {
  return {
    id: "a1",
    handle: "bob",
    emailVerified: true,
    keyAttached: true,
    approvedAt: null,
    landedAt: null,
    ...overrides,
  };
}

function link(overrides: {
  id?: string;
  revokedAt?: string | null;
  singleUse?: boolean;
  prefillPDirected?: number;
  prefillPInterest?: number;
  applications?: ApplicationFields[];
} = {}) {
  return {
    __typename: "InviteLink",
    id: overrides.id ?? "l1",
    prefillPDirected: overrides.prefillPDirected ?? 0.1,
    prefillPInterest: overrides.prefillPInterest ?? 0.1,
    singleUse: overrides.singleUse ?? false,
    createdAt: "2026-08-07T00:00:00Z",
    expiresAt: "2026-08-14T00:00:00Z",
    revokedAt: overrides.revokedAt ?? null,
    applications: {
      __typename: "ApplicationConnection",
      edges: (overrides.applications ?? []).map((fields) => ({
        __typename: "ApplicationEdge",
        node: { __typename: "Application", ...fields },
      })),
    },
  };
}

function linksHandler(links: ReturnType<typeof link>[]) {
  return graphql.query("InviteLinks", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          inviteLinks: {
            __typename: "InviteLinkConnection",
            edges: links.map((node) => ({ __typename: "InviteLinkEdge", node })),
          },
        },
      },
    }),
  );
}

function approveHandler(onVariables?: (variables: Record<string, unknown>) => void) {
  return graphql.mutation("ApproveApplicants", ({ variables }) => {
    onVariables?.(variables);
    return HttpResponse.json({
      data: {
        approveApplicants: {
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

function refusedApproveHandler(code: string) {
  return graphql.mutation("ApproveApplicants", () =>
    HttpResponse.json({
      data: {
        approveApplicants: {
          __typename: "PreparePayload",
          writes: null,
          userErrors: [{ __typename: "UserError", message: "refused", code, field: null }],
        },
      },
    }),
  );
}

describe("InvitesView", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the in-page lock for an applicant, without the inviter surface", async () => {
    server.use(meHandler("APPLICANT"));
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("invites_locked")).toHaveTextContent(
      "Inviting unlocks once your inviter approves you.",
    );
    expect(screen.queryByTestId("invites_create")).not.toBeInTheDocument();
  });

  it("shows a member the create card alone when no links exist", async () => {
    server.use(meHandler("MEMBER"), linksHandler([]));
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("invites_create")).toBeInTheDocument();
    expect(screen.queryByTestId("invites_locked")).not.toBeInTheDocument();
  });

  it("creates a link and refreshes the list", async () => {
    let created = false;
    server.use(
      meHandler("MEMBER"),
      graphql.query("InviteLinks", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              inviteLinks: {
                __typename: "InviteLinkConnection",
                edges: created
                  ? [{ __typename: "InviteLinkEdge", node: link() }]
                  : [],
              },
            },
          },
        }),
      ),
      graphql.mutation("CreateInviteLink", ({ variables }) => {
        created = true;
        const input = (variables as { input: { singleUse: boolean; prefillPDirected: number } })
          .input;
        expect(input.singleUse).toBe(true);
        expect(input.prefillPDirected).toBe(0.1);
        return HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: { __typename: "InviteLink", id: "l1" },
              userErrors: [],
            },
          },
        });
      }),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("invites_single_use"));
    fireEvent.click(screen.getByTestId("invites_create"));
    expect(await screen.findByTestId("link_l1")).toBeInTheDocument();
  });

  it("a revoked link loses its actions", async () => {
    server.use(
      meHandler("MEMBER"),
      linksHandler([link({ id: "l1" }), link({ id: "l2", revokedAt: "2026-08-07T01:00:00Z" })]),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    expect(await screen.findByTestId("share_l1")).toBeInTheDocument();
    expect(screen.getByTestId("link_l2")).toHaveTextContent("Revoked");
    expect(screen.queryByTestId("share_l2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("revoke_l2")).not.toBeInTheDocument();
  });

  it("copies the join URL on share", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    server.use(meHandler("MEMBER"), linksHandler([link({ id: "l1" })]));
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("share_l1"));
    expect(await screen.findByTestId("copied_l1")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/l1`);
  });

  it.each([
    [application({ landedAt: "2026-08-07T02:00:00Z", approvedAt: "2026-08-07T01:00:00Z" }), "@bob is a member."],
    [application({ approvedAt: "2026-08-07T01:00:00Z" }), "waiting for their signature and landing"],
    [application({ emailVerified: false, keyAttached: false }), "email verification and device key"],
    [application({ emailVerified: false }), "waiting on their email verification."],
    [application({ keyAttached: false }), "waiting on their device key."],
    [application(), "ready for your approval"],
  ])("describes the applicant's state", async (fields, expected) => {
    server.use(meHandler("MEMBER"), linksHandler([link({ applications: [fields] })]));
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("application_a1")).toHaveTextContent(expected);
  });

  it("offers approval only for approvable, unapproved applications", async () => {
    server.use(
      meHandler("MEMBER"),
      linksHandler([
        link({
          applications: [
            application({ id: "a1" }),
            application({ id: "a2", emailVerified: false }),
            application({ id: "a3", approvedAt: "2026-08-07T01:00:00Z" }),
          ],
        }),
      ]),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    expect(await screen.findByTestId("approve_a1")).toBeInTheDocument();
    expect(screen.queryByTestId("approve_a2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("approve_a3")).not.toBeInTheDocument();
  });

  it("approving commits the link's prefill, signs the vouch, and reports it", async () => {
    let variables: Record<string, unknown> | null = null;
    server.use(
      meHandler("MEMBER"),
      linksHandler([
        link({ prefillPDirected: 0.4, prefillPInterest: 0.2, applications: [application()] }),
      ]),
      approveHandler((v) => (variables = v)),
    );
    const writeSigner = fakeWriteSigner();
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner });

    fireEvent.click(await screen.findByTestId("approve_a1"));
    expect(await screen.findByTestId("invites_vouch_signed")).toBeInTheDocument();
    expect(writeSigner.signStaged).toHaveBeenCalledWith(
      expect.objectContaining({ id: "w1", state: "AWAITING_PRE_SIGN" }),
    );
    expect(variables).toEqual({
      input: { approvals: [{ application: "a1", pDirected: 0.4, pInterest: 0.2 }] },
    });
  });

  it("maps an approval refusal to its message", async () => {
    server.use(
      meHandler("MEMBER"),
      linksHandler([link({ applications: [application()] })]),
      refusedApproveHandler("WRITE_RULE_FAILED"),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("approve_a1"));
    expect(await screen.findByTestId("invites_error")).toHaveTextContent(
      "Your account can't fund this approval right now.",
    );
  });

  it("reports an approval whose vouch did not finish signing", async () => {
    server.use(
      meHandler("MEMBER"),
      linksHandler([link({ applications: [application()] })]),
      approveHandler(),
    );
    const writeSigner = fakeWriteSigner({
      signStaged: vi.fn(() =>
        Promise.resolve({ kind: "failed" as const, id: "w1", cause: new Error("offline") }),
      ),
    });
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner });

    fireEvent.click(await screen.findByTestId("approve_a1"));
    expect(await screen.findByTestId("invites_sign_incomplete")).toBeInTheDocument();
    expect(screen.queryByTestId("invites_vouch_signed")).not.toBeInTheDocument();
  });

  it("surfaces a transport fault on the links read", async () => {
    server.use(meHandler("MEMBER"), graphql.query("InviteLinks", () => HttpResponse.error()));
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });
    expect(await screen.findByTestId("invites_error")).toHaveTextContent("Can't reach the server");
  });

  it("revoking refreshes and surfaces a stale-link refusal", async () => {
    server.use(
      meHandler("MEMBER"),
      linksHandler([link({ id: "l1" })]),
      graphql.mutation("RevokeInviteLink", () =>
        HttpResponse.json({
          data: {
            revokeInviteLink: {
              __typename: "RevokeInviteLinkPayload",
              inviteLink: null,
              userErrors: [
                { __typename: "UserError", message: "gone", code: "NOT_FOUND", field: null },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("revoke_l1"));
    expect(await screen.findByTestId("invites_error")).toHaveTextContent(
      "That link is already gone.",
    );
  });

  it("a double-click revokes once", async () => {
    let revokeCalls = 0;
    server.use(
      meHandler("MEMBER"),
      linksHandler([link({ id: "l1" })]),
      graphql.mutation("RevokeInviteLink", () => {
        revokeCalls += 1;
        return HttpResponse.json({
          data: {
            revokeInviteLink: {
              __typename: "RevokeInviteLinkPayload",
              inviteLink: { __typename: "InviteLink", id: "l1" },
              userErrors: [],
            },
          },
        });
      }),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    const revoke = await screen.findByTestId("revoke_l1");
    fireEvent.click(revoke);
    fireEvent.click(revoke);
    await waitFor(() => expect(revokeCalls).toBe(1));
  });

  it("a successful revoke clears a stale refusal line", async () => {
    let refuse = true;
    server.use(
      meHandler("MEMBER"),
      linksHandler([link({ id: "l1" })]),
      graphql.mutation("RevokeInviteLink", () =>
        HttpResponse.json({
          data: {
            revokeInviteLink: refuse
              ? {
                  __typename: "RevokeInviteLinkPayload",
                  inviteLink: null,
                  userErrors: [
                    { __typename: "UserError", message: "gone", code: "NOT_FOUND", field: null },
                  ],
                }
              : {
                  __typename: "RevokeInviteLinkPayload",
                  inviteLink: { __typename: "InviteLink", id: "l1" },
                  userErrors: [],
                },
          },
        }),
      ),
    );
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("revoke_l1"));
    expect(await screen.findByTestId("invites_error")).toHaveTextContent(
      "That link is already gone.",
    );

    refuse = false;
    fireEvent.click(screen.getByTestId("revoke_l1"));
    await waitFor(() => expect(screen.queryByTestId("invites_error")).not.toBeInTheDocument());
  });

  it("a failed copy says so instead of staying silent", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    Object.assign(navigator, { clipboard: { writeText } });
    server.use(meHandler("MEMBER"), linksHandler([link({ id: "l1" })]));
    renderWithProviders(<InvitesView />, { store: signedInStore(), writeSigner: fakeWriteSigner() });

    fireEvent.click(await screen.findByTestId("share_l1"));
    expect(await screen.findByTestId("copy_failed_l1")).toBeInTheDocument();
    expect(screen.queryByTestId("copied_l1")).not.toBeInTheDocument();
  });
});
