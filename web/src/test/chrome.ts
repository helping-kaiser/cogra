// THE SHELL'S QUIET READS, answered by default: the release registry
// (`AppVersions`, read by the cold-open announcer), the bell's dot
// (`NotificationBell`), whether a recovery backup exists (`KeyBackupState`,
// answered: one does, so a key-absent notice offers Restore)
// the composer's starting license (`DefaultLicense`), and the intro's seen
// flag (`IntroAccount`, answered: seen). Screens ask them
// on arrival whatever the test is about, so each answers the state that
// draws nothing: no releases, nothing unread, no license set (the
// composer then starts at public domain). A test of any answers it with its
// own.

import { HttpResponse } from "msw/http";
import { borrowedViewHandler } from "./borrowed-view";
import { gqlLink } from "./gql-link";
import { borrowedStanceHandlers } from "./stance";

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
  // The feed asks whether the intro was seen (OnboardingSteps.md:3); the
  // answer that draws nothing is seen.
  gqlLink.query("IntroAccount", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u-viewer",
          preferences: { __typename: "UserPreferences", hasSeenOnboarding: true },
          invitedBy: null,
          application: null,
        },
      },
    }),
  ),
  // A guest's wide anchor asks whose view it borrows (the vantage law); the
  // answer that draws nothing is a view of one's own.
  borrowedViewHandler(null),
  // A guest's faces ask the borrowed view's stance; the answer that draws
  // nothing new is none held, the hollow face.
  ...borrowedStanceHandlers(),
];
