// THE SHELL'S QUIET READS, answered by default: the release registry
// (`AppVersions`, read by the cold-open announcer), the bell's dot
// (`NotificationBell`), whether a recovery backup exists (`KeyBackupState`,
// answered: one does, so a key-absent notice offers Restore)
// and the composer's starting license (`DefaultLicense`). Screens ask them
// on arrival whatever the test is about, so each answers the state that
// draws nothing: no releases, nothing unread, no license set (the
// composer then starts at public domain). A test of any answers it with its
// own.

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
    HttpResponse.json({ data: { me: { __typename: "User", id: "u-viewer", keyBackupCreatedAt: "2026-01-01T00:00:00.000Z" } } }),
  ),
  gqlLink.query("DefaultLicense", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u-viewer",
          preferences: { __typename: "UserPreferences", defaultLicense: null },
        },
      },
    }),
  ),
];
