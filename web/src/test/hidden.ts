// THE HIDE ACTION'S SHARED TEST HARNESS (hidden-actors packet §12.2): the
// hidden set's read and its two verbs answered over MSW, with a log of what
// each surface sent, so every host's test pins the one behaviour the same way.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

export type HiddenLog = {
  /** Every `hideActor`: the actor, and the restore time an Undo passed. */
  hides: { actor: string; at: string | null }[];
  unhides: string[];
  reads: number;
};

export function hiddenLog(): HiddenLog {
  return { hides: [], unhides: [], reads: 0 };
}

/** One hidden account as the read serves it. */
export type HiddenFixture = {
  id: string;
  handle: string;
  displayName: string;
  hiddenAt: string;
  avatarUrl?: string | null;
  /** A deleted account: REDACTED in its name. */
  redacted?: boolean;
};

const UNREACHABLE = [{ message: "unreachable", extensions: { code: "INTERNAL" } }];

function edgeOf(entry: HiddenFixture) {
  return {
    __typename: "HiddenActorEdge",
    cursor: `c-${entry.id}`,
    hiddenAt: entry.hiddenAt,
    node: {
      __typename: "User",
      id: entry.id,
      handle: entry.handle,
      displayName: {
        __typename: "ModeratedText",
        value: entry.redacted === true ? null : entry.displayName,
        status: entry.redacted === true ? "REDACTED" : "NORMAL",
      },
      avatar:
        entry.avatarUrl == null
          ? null
          : { __typename: "MediaRef", url: entry.avatarUrl, status: "NORMAL" },
    },
  };
}

/** The whole set in one page. */
export function hiddenPage(entries: readonly HiddenFixture[]) {
  return {
    data: {
      me: {
        __typename: "User",
        id: "me",
        hiddenActors: {
          __typename: "HiddenActorConnection",
          totalCount: entries.length,
          edges: entries.map(edgeOf),
          pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
        },
      },
    },
  };
}

/** The set read, and `hideActor` / `unhideActor` answering ok — or failing when told. */
export function hiddenHandlers(
  log: HiddenLog,
  {
    entries = [],
    failRead = false,
    failHide = false,
    failUnhide = false,
    hiddenAt = "2026-10-13T12:00:00Z",
  }: {
    entries?: readonly HiddenFixture[];
    failRead?: boolean;
    failHide?: boolean;
    failUnhide?: boolean;
    hiddenAt?: string;
  } = {},
) {
  return [
    gqlLink.query("HiddenActorsPage", () => {
      log.reads += 1;
      if (failRead) return HttpResponse.json({ data: null, errors: UNREACHABLE });
      return HttpResponse.json(hiddenPage(entries));
    }),
    gqlLink.mutation("HideActor", ({ variables }) => {
      log.hides.push({
        actor: variables.actor as string,
        at: (variables.hiddenAt as string | null) ?? null,
      });
      if (failHide) return HttpResponse.json({ data: null, errors: UNREACHABLE });
      return HttpResponse.json({
        data: {
          hideActor: {
            __typename: "HideActorPayload",
            hidden: {
              __typename: "HiddenActorEdge",
              hiddenAt: (variables.hiddenAt as string | null) ?? hiddenAt,
            },
            userErrors: [],
          },
        },
      });
    }),
    gqlLink.mutation("UnhideActor", ({ variables }) => {
      log.unhides.push(variables.actor as string);
      if (failUnhide) return HttpResponse.json({ data: null, errors: UNREACHABLE });
      return HttpResponse.json({
        data: { unhideActor: { __typename: "UnhideActorPayload", ok: true, userErrors: [] } },
      });
    }),
  ];
}

/**
 * The read every signed-in surface makes at mount, answered with an empty
 * set — the default under every MSW server, so a test about something else
 * need not know the hidden set exists.
 */
export const NOBODY_HIDDEN = gqlLink.query("HiddenActorsPage", () =>
  HttpResponse.json(hiddenPage([])),
);
