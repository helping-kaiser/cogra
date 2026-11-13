import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import { hasCode } from "./outcome";
import {
  approveApplicant,
  createInviteLink,
  checkAskLink,
  fetchInvites,
  fetchMyApplication,
  rejectApplication,
  rejectLinkApplications,
  stageApplicant,
  revokeInviteLink,
} from "./invites-api";
import {
  application,
  applicationNode,
  askCheckAnswer,
  inviteLink,
  daysAgo,
  linkNode,
  PEOPLE_PAGE,
  person,
  staticInvites,
  userError,
  vouchedInHandler,
} from "@/test/invites";
import { gqlLink, startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

describe("createInviteLink", () => {
  const input = {
    expiresAt: "2026-08-14T00:00:00Z",
    singleUse: true,
  };

  it("returns the fresh link, for the sheet's second stage", async () => {
    server.use(
      gqlLink.mutation("CreateInviteLink", () =>
        HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: linkNode(inviteLink({ id: "l1" })),
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await createInviteLink(client(), input);
    expect(outcome.kind === "success" && outcome.value.id).toBe("l1");
  });

  it("surfaces a bad-expiry refusal", async () => {
    server.use(
      gqlLink.mutation("CreateInviteLink", () =>
        HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: null,
              userErrors: [
                { __typename: "UserError", message: "past", code: "BAD_INPUT", field: ["expiresAt"] },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await createInviteLink(client(), input), "BAD_INPUT")).toBe(true);
  });
});

describe("revokeInviteLink", () => {
  it("surfaces the stale-link refusal as a userError", async () => {
    // The contract deviation: NOT_FOUND rides the userError tier here
    // (api-spec.md "Auth and accounts").
    server.use(
      gqlLink.mutation("RevokeInviteLink", () =>
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
    expect(hasCode(await revokeInviteLink(client(), "l1"), "NOT_FOUND")).toBe(true);
  });
});

describe("approveApplicant", () => {
  it("adapts the returned Opinion records for the signer", async () => {
    server.use(
      gqlLink.mutation("ApproveApplicants", ({ variables }) => {
        expect(variables).toEqual({
          input: { approvals: [{ application: "a1", pDirected: 0.4, pInterest: 0.2 }] },
        });
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
      }),
    );
    const outcome = await approveApplicant(client(), "a1", 0.4, 0.2);
    expect(outcome).toEqual({
      kind: "success",
      value: [
        {
          id: "w1",
          family: "OPINION",
          canonicalProposal: "cHJvcG9zYWw=",
          state: "AWAITING_PRE_SIGN",
          verifiedAct: null,
        },
      ],
    });
  });

  it("surfaces a per-entry refusal", async () => {
    server.use(
      gqlLink.mutation("ApproveApplicants", () =>
        HttpResponse.json({
          data: {
            approveApplicants: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "expired",
                  code: "BAD_INPUT",
                  field: ["approvals", "0", "application"],
                },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await approveApplicant(client(), "a1", 0.1, 0.1), "BAD_INPUT")).toBe(true);
  });

  it("maps a transport fault to failed", async () => {
    server.use(gqlLink.mutation("ApproveApplicants", () => HttpResponse.error()));
    expect((await approveApplicant(client(), "a1", 0.1, 0.1)).kind).toBe("failed");
  });
});

describe("fetchInvites", () => {
  it("reads the queue and the links in one round trip", async () => {
    server.use(
      ...staticInvites(
        [application({ handle: "imke" }), application({ handle: "noor", link: null })],
        [inviteLink({ id: "l1" })],
      ),
    );
    const outcome = await fetchInvites(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.queue.map((a) => a.handle)).toEqual(["imke", "noor"]);
    expect(outcome.value.queue[1].inviteLink).toBeNull();
    expect(outcome.value.links.map((l) => l.id)).toEqual(["l1"]);
  });

  it("treats a null viewer as unauthenticated", async () => {
    server.use(
      gqlLink.query("Invites", () => HttpResponse.json({ data: { me: null } })),
      vouchedInHandler(() => []),
    );
    expect(hasCode(await fetchInvites(client()), "UNAUTHENTICATED")).toBe(true);
  });

  it("reads the people let in beside them, newest first, paged to the end", async () => {
    // Two pages: the read follows endCursor until hasNextPage is false.
    const people = Array.from({ length: PEOPLE_PAGE + 2 }, (_, i) =>
      person({ handle: `p${i}`, vouchedAt: daysAgo(i) }),
    );
    server.use(...staticInvites([], [], people));
    const outcome = await fetchInvites(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.people).toHaveLength(PEOPLE_PAGE + 2);
    expect(outcome.value.people.at(-1)?.door).toBe(`p${PEOPLE_PAGE + 1}`);
  });

  it("names a person by their display name, else their handle; a deleted account by nothing", async () => {
    server.use(
      ...staticInvites(
        [],
        [],
        [
          person({ id: "a", handle: "nadia", displayName: "Nadia Okafor", avatarUrl: "https://x/n.jpg" }),
          person({ id: "b", handle: "wren", displayName: "  " }),
          person({ id: "c", handle: "gone", redacted: true, avatarUrl: "https://x/g.jpg" }),
        ],
      ),
    );
    const outcome = await fetchInvites(client());
    if (outcome.kind !== "success") throw new Error("read failed");
    expect(outcome.value.people).toEqual([
      expect.objectContaining({ id: "a", name: "Nadia Okafor", avatarUrl: "https://x/n.jpg", redacted: false }),
      expect.objectContaining({ id: "b", name: "@wren", door: "wren", redacted: false }),
      // The door keeps the route; the row prints neither name, picture nor handle.
      expect.objectContaining({ id: "c", name: null, avatarUrl: null, door: "gone", redacted: true }),
    ]);
  });

  it("is the page's fault when the people cannot be read", async () => {
    // The refusing handler first: MSW answers with the first match.
    server.use(
      gqlLink.query("VouchedInPage", () => HttpResponse.json({ errors: [{ message: "boom" }] })),
      ...staticInvites([application({ handle: "imke" })], []),
    );
    expect((await fetchInvites(client())).kind).not.toBe("success");
  });
});

describe("rejectApplication", () => {
  it("closes the one application", async () => {
    server.use(
      gqlLink.mutation("RejectApplication", ({ variables }) => {
        expect(variables).toEqual({ input: { application: "a1" } });
        return HttpResponse.json({
          data: {
            rejectApplication: {
              __typename: "RejectApplicationPayload",
              application: { __typename: "Application", id: "a1", rejectedAt: "2026-09-15T12:00:00Z" },
              userErrors: [],
            },
          },
        });
      }),
    );
    expect(await rejectApplication(client(), "a1")).toEqual({ kind: "success", value: true });
  });

  it("keeps BAD_INPUT as a refusal (approved, closed, or not the reader's)", async () => {
    server.use(
      gqlLink.mutation("RejectApplication", () =>
        HttpResponse.json({
          data: {
            rejectApplication: {
              __typename: "RejectApplicationPayload",
              application: null,
              userErrors: [userError("BAD_INPUT", ["application"])],
            },
          },
        }),
      ),
    );
    expect(hasCode(await rejectApplication(client(), "a1"), "BAD_INPUT")).toBe(true);
  });
});

describe("rejectLinkApplications", () => {
  it("answers how many it closed", async () => {
    server.use(
      gqlLink.mutation("RejectLinkApplications", () =>
        HttpResponse.json({
          data: {
            rejectLinkApplications: {
              __typename: "RejectLinkApplicationsPayload",
              rejectedCount: 4,
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await rejectLinkApplications(client(), "l1")).toEqual({ kind: "success", value: 4 });
  });

  it("keeps NOT_FOUND for an unknown or foreign link", async () => {
    server.use(
      gqlLink.mutation("RejectLinkApplications", () =>
        HttpResponse.json({
          data: {
            rejectLinkApplications: {
              __typename: "RejectLinkApplicationsPayload",
              rejectedCount: null,
              userErrors: [userError("NOT_FOUND")],
            },
          },
        }),
      ),
    );
    expect(hasCode(await rejectLinkApplications(client(), "l1"), "NOT_FOUND")).toBe(true);
  });
});

describe("checkAskLink", () => {
  it("reads who is asking and whether the reader can take them up", async () => {
    server.use(
      gqlLink.query("AskLinkCheck", () =>
        HttpResponse.json(askCheckAnswer({ usable: false, applicantHandle: "noor", reason: "LANDED" })),
      ),
    );
    const outcome = await checkAskLink(client(), "k1");
    expect(outcome).toEqual({
      kind: "success",
      value: { __typename: "AskLinkCheck", usable: false, applicantHandle: "noor", reason: "LANDED" },
    });
  });

  it("answers null for an id that resolves to nobody", async () => {
    server.use(gqlLink.query("AskLinkCheck", () => HttpResponse.json(askCheckAnswer(null))));
    expect(await checkAskLink(client(), "k1")).toEqual({ kind: "success", value: null });
  });
});

describe("stageApplicant", () => {
  it("returns the staged row", async () => {
    server.use(
      gqlLink.mutation("StageApplicant", ({ variables }) => {
        expect(variables).toEqual({ input: { askLink: "k1" } });
        return HttpResponse.json({
          data: {
            stageApplicant: {
              __typename: "StageApplicantPayload",
              application: applicationNode(application({ handle: "noor", link: null })),
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await stageApplicant(client(), "k1");
    expect(outcome.kind === "success" && outcome.value.id).toBe("app-noor");
  });

  it("keeps ASK_LINK_UNUSABLE as a refusal", async () => {
    server.use(
      gqlLink.mutation("StageApplicant", () =>
        HttpResponse.json({
          data: {
            stageApplicant: {
              __typename: "StageApplicantPayload",
              application: null,
              userErrors: [userError("ASK_LINK_UNUSABLE")],
            },
          },
        }),
      ),
    );
    expect(hasCode(await stageApplicant(client(), "k1"), "ASK_LINK_UNUSABLE")).toBe(true);
  });
});

describe("fetchMyApplication", () => {
  it("reads the application the card names and the ask link", async () => {
    server.use(
      gqlLink.query("MyApplication", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              askLink: "k1",
              application: {
                __typename: "Application",
                id: "a1",
                approvedAt: null,
                rejectedAt: "2026-09-15T12:00:00Z",
                landedAt: null,
                approver: { __typename: "User", id: "u9", handle: "kel" },
              },
            },
          },
        }),
      ),
    );
    const outcome = await fetchMyApplication(client());
    expect(outcome.kind === "success" && outcome.value.askLink).toBe("k1");
    expect(outcome.kind === "success" && outcome.value.application?.approver?.handle).toBe("kel");
  });
});
