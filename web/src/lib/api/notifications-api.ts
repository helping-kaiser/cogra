// The notification list, lifted into outcomes (api-spec.md "Private viewer
// state", `User.notifications`, `User.hasUnreadNotifications`,
// `markNotificationsSeen`, `markNotificationRead`). Authenticated-only and
// never member-gated: an applicant reads its list like a member.

import type { ApolloClient } from "@apollo/client";

import {
  MarkNotificationReadDocument,
  MarkNotificationsSeenDocument,
  NotificationBellDocument,
  NotificationsDocument,
  type NotificationsQuery,
} from "@/__generated__/graphql";
import { payloadOutcome, success, viewerField, type Outcome } from "./outcome";

type NotificationEdge = NonNullable<
  NonNullable<NotificationsQuery["me"]>["notifications"]
>["edges"][number];

/** One row of the list, as the page's read serves it. */
export type Notification = NotificationEdge["node"];

/** A page of the reader's own list, newest first. */
export type NotificationPage = {
  readonly items: readonly Notification[];
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

/**
 * A page of the reader's list. A null `me` is the shared UNAUTHENTICATED
 * refusal, so the auth guard refreshes a stale token and replays.
 */
export async function fetchNotificationsPage(
  client: ApolloClient,
  after: string | null,
): Promise<Outcome<NotificationPage>> {
  const fetched = await viewerField(
    () =>
      client.query({
        query: NotificationsDocument,
        variables: { after },
        fetchPolicy: "network-only",
      }),
    (data) => data.me?.notifications,
  );
  if (fetched.kind !== "success") return fetched;
  const page = fetched.value;
  return success({
    items: page.edges.map((edge) => edge.node),
    endCursor: page.pageInfo.endCursor ?? null,
    hasNextPage: page.pageInfo.hasNextPage,
  });
}

/** The bell's dot as the server reads it now — asked on a fresh root load only. */
export function fetchBell(client: ApolloClient): Promise<Outcome<boolean>> {
  return viewerField(
    () => client.query({ query: NotificationBellDocument, fetchPolicy: "network-only" }),
    (data) => (data.me === null || data.me === undefined ? null : data.me.hasUnreadNotifications),
  );
}

/** Moves the seen pointer to `through`; succeeds with whether anything is still unseen. */
export function markNotificationsSeen(
  client: ApolloClient,
  through: string,
): Promise<Outcome<boolean>> {
  return payloadOutcome(
    () => client.mutate({ mutation: MarkNotificationsSeenDocument, variables: { through } }),
    (data) => data.markNotificationsSeen.userErrors,
    (data) => data.markNotificationsSeen.hasUnreadNotifications,
  );
}

/** Marks one row read; succeeds with its read time. */
export function markNotificationRead(
  client: ApolloClient,
  notification: string,
): Promise<Outcome<string>> {
  return payloadOutcome(
    () => client.mutate({ mutation: MarkNotificationReadDocument, variables: { notification } }),
    (data) => data.markNotificationRead.userErrors,
    (data) => data.markNotificationRead.notification?.readAt ?? null,
  );
}
