// Wire fixtures for the invites family (queue, links, the two closes, the ask
// link), shaped as the generated operations read them. Every mutation is
// mocked: no test here ever reaches the shared stack.

import { HttpResponse } from "msw/http";

import { gqlLink } from "./msw";

export type ApplicationFixture = {
  id: string;
  handle: string;
  emailVerified: boolean;
  keyAttached: boolean;
  graphId: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  landedAt: string | null;
  /** Null for an ask-link staging. */
  link: { id: string; singleUse: boolean } | null;
};

export const NOW = Date.parse("2026-09-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

export function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

export function daysAhead(days: number): string {
  return new Date(NOW + days * DAY).toISOString();
}

export function graphIdOf(handle: string): string {
  const hex = [...handle].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return `prof:${hex.padEnd(40, "0").slice(0, 40)}`;
}

export const MANY = { id: "c47b19e0-3a52-4f68-b1d9-6e0a85f37c24", singleUse: false };
export const SINGLE = { id: "8f3c1d2a-5b47-4e90-9a61-2d7fbc084e15", singleUse: true };
// A spent single-use link: @rafa came through it, so it keys his group and never
// stands under Live links (the board's re-keyed `invites.group`, design round 23).
export const USED = { id: "3e9a6b52-71d4-4c08-b5f3-9c2e18a07d64", singleUse: true };

export function application(overrides: Partial<ApplicationFixture> = {}): ApplicationFixture {
  const handle = overrides.handle ?? "rafa";
  return {
    id: `app-${handle}`,
    handle,
    emailVerified: true,
    keyAttached: true,
    graphId: graphIdOf(handle),
    createdAt: daysAgo(3),
    approvedAt: null,
    rejectedAt: null,
    landedAt: null,
    link: SINGLE,
    ...overrides,
  };
}

export function applicationNode(fixture: ApplicationFixture) {
  const { link, ...fields } = fixture;
  return {
    __typename: "Application",
    ...fields,
    inviteLink:
      link === null ? null : { __typename: "InviteLink", id: link.id, singleUse: link.singleUse },
  };
}

export type LinkFixture = {
  id: string;
  singleUse: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  usable: boolean;
};

export function inviteLink(overrides: Partial<LinkFixture> = {}): LinkFixture {
  return {
    id: SINGLE.id,
    singleUse: true,
    createdAt: daysAgo(0),
    expiresAt: daysAhead(7),
    revokedAt: null,
    usable: true,
    ...overrides,
  };
}

export function linkNode(fixture: LinkFixture) {
  return { __typename: "InviteLink", ...fixture };
}

/** The `Invites` read, answering from the live arrays on every call. */
export function invitesHandler(state: {
  queue: () => readonly ApplicationFixture[];
  links: () => readonly LinkFixture[];
}) {
  return gqlLink.query("Invites", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          approvalQueue: {
            __typename: "ApplicationConnection",
            edges: state.queue().map((a) => ({ __typename: "ApplicationEdge", node: applicationNode(a) })),
          },
          inviteLinks: {
            __typename: "InviteLinkConnection",
            edges: state.links().map((l) => ({ __typename: "InviteLinkEdge", node: linkNode(l) })),
          },
        },
      },
    }),
  );
}

export function staticInvites(queue: readonly ApplicationFixture[], links: readonly LinkFixture[]) {
  return invitesHandler({ queue: () => queue, links: () => links });
}

export function userError(code: string, field: string[] | null = null) {
  return { __typename: "UserError", message: code.toLowerCase(), code, field };
}

export function approveAnswer() {
  return {
    data: {
      approveApplicants: {
        __typename: "PreparePayload",
        writes: [
          { __typename: "PreparedWrite", id: "w1", family: "OPINION", canonicalProposal: "cHJvcG9zYWw=" },
        ],
        userErrors: [],
      },
    },
  };
}

export function askCheckAnswer(
  check: { usable: boolean; applicantHandle: string; reason: "LANDED" | "WAITING_ON_VIEWER" | null } | null,
) {
  return {
    data: { askLinkCheck: check === null ? null : { __typename: "AskLinkCheck", ...check } },
  };
}

export function meHandler(accountState: "APPLICANT" | "MEMBER", id = "u1", handle = "ada") {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id,
          handle,
          displayName: { __typename: "ModeratedText", value: null },
          actorPubkey: null,
          accountState,
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
          preferences: { __typename: "UserPreferences", contentFilteringSeverityLevel: null },
        },
      },
    }),
  );
}
