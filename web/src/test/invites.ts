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

/** One person the reader let in (`VouchedInEdge`), as the wire carries them. */
export type PersonFixture = {
  id: string;
  handle: string;
  /** Null for no written name; REDACTED reads a deleted account. */
  displayName: string | null;
  redacted: boolean;
  avatarUrl: string | null;
  vouchedAt: string;
};

export function person(overrides: Partial<PersonFixture> = {}): PersonFixture {
  const handle = overrides.handle ?? "nadia";
  return {
    id: `id-${handle}`,
    handle,
    displayName: null,
    redacted: false,
    avatarUrl: null,
    vouchedAt: daysAgo(2),
    ...overrides,
  };
}

export function personEdge(fixture: PersonFixture, cursor: string) {
  return {
    __typename: "VouchedInEdge",
    cursor,
    vouchedAt: fixture.vouchedAt,
    node: {
      __typename: "User",
      id: fixture.id,
      handle: fixture.handle,
      displayName: {
        __typename: "ModeratedText",
        value: fixture.redacted ? null : fixture.displayName,
        status: fixture.redacted ? "REDACTED" : "NORMAL",
      },
      avatar:
        fixture.avatarUrl === null
          ? null
          : { __typename: "MediaAttachment", url: fixture.avatarUrl, status: "NORMAL" },
    },
  };
}

/** How many people one `VouchedInPage` answer carries, as the client asks (`first: 100`). */
export const PEOPLE_PAGE = 100;

/**
 * The `VouchedInPage` read over the live array, a page of `PEOPLE_PAGE` at a
 * time keyed by the edge's index — newest first, as the array is given.
 */
export function vouchedInHandler(people: () => readonly PersonFixture[]) {
  return gqlLink.query("VouchedInPage", ({ variables }) => {
    const all = people();
    const start = typeof variables.after === "string" ? Number(variables.after) + 1 : 0;
    const page = all.slice(start, start + PEOPLE_PAGE);
    const end = start + page.length - 1;
    return HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          vouchedIn: {
            __typename: "VouchedInConnection",
            edges: page.map((p, i) => personEdge(p, String(start + i))),
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: end < all.length - 1,
              endCursor: page.length === 0 ? null : String(end),
            },
          },
        },
      },
    });
  });
}

/**
 * The page's reads — `Invites` (the queue and the links) and `VouchedInPage`
 * (the people let in, none unless given) — answering from the live arrays on
 * every call. Spread into `server.use`.
 */
export function invitesHandler(state: {
  queue: () => readonly ApplicationFixture[];
  links: () => readonly LinkFixture[];
  people?: () => readonly PersonFixture[];
}) {
  return [
    gqlLink.query("Invites", () =>
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
    ),
    vouchedInHandler(state.people ?? (() => [])),
  ];
}

export function staticInvites(
  queue: readonly ApplicationFixture[],
  links: readonly LinkFixture[],
  people: readonly PersonFixture[] = [],
) {
  return invitesHandler({ queue: () => queue, links: () => links, people: () => people });
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
