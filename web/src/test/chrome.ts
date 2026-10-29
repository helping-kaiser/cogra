// THE SHELL'S QUIET READS, answered by default: the release registry
// (`AppVersions`, read by the cold-open announcer), the bell's dot
// (`NotificationBell`) and whether a recovery backup exists
// (`KeyBackupState`). Screens ask them on arrival whatever the test is
// about, so each answers the state that draws nothing: no releases, nothing
// unread, no backup. A test of either answers them with its own.

import { HttpResponse } from "msw/http";
import { gqlLink } from "./gql-link";

export const QUIET_CHROME = [
  gqlLink.query("AppVersions", () =>
    HttpResponse.json({
      data: {
        appVersions: {
          __typename: "AppVersionConnection",
          pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          edges: [],
        },
      },
    }),
  ),
  gqlLink.query("NotificationBell", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u-viewer", hasUnreadNotifications: false } } }),
  ),
  gqlLink.query("KeyBackupState", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u-viewer", keyBackupCreatedAt: null } } }),
  ),
];
