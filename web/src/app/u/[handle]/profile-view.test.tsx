import { InMemoryCache } from "@apollo/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSeenQueueForTests } from "@/lib/history/seen-queue";
import { heldPicture, releaseHeldPicture } from "@/lib/profile/held-picture";
import { forgetAllProfileViews, recallProfileView } from "@/lib/profile/profile-memory";
import { readerState } from "@/lib/session/reader-state";
import { createTokenStore } from "@/lib/session/token-store";
import { AccountPreferencesSync } from "@/lib/settings/account-preferences-sync";
import { createStubStanceData } from "@/lib/stance/stub-stance-data";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { borrowedViewHandler } from "@/test/borrowed-view";
import { byNode } from "@/test/data-node";
import { bookmarkHandlers, bookmarkLog } from "@/test/saved";
import { stanceBundle, stanceHandlers } from "@/test/stance";
import { chroniclePage, settlingCommentEntry, settlingPostEntry } from "@/test/chronicle";
import { CarriedSnackbar, carrySnackbar } from "@/lib/ui/carried-snackbar";
import {
  closeProfileChangeSeal,
  PROFILE_SIGNED,
  resetProfileChangeForTests,
  signProfileChange,
  type ProfileChangeOutcome,
} from "@/lib/profile/profile-change";
import { readSignedProfile, resetSignedProfileForTests } from "@/lib/profile/signed-profile";
import { ChangeHandleView } from "@/app/(app)/settings/handle/change-handle-view";
import { ProfileScreen } from "./profile-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

// The header's stance control reads its own standing, so the read is a
// default rather than something each test remembers: an unhandled one
// degrades the control silently instead of failing the test.
//
// Opening someone's profile adds it to History (History.md:11), so a signed-in
// render sends a seeing; what was sent is recorded for the tests that ask.
let marked: string[][] = [];
const server = startMswServer(
  ...stanceHandlers(),
  // The header's figures are read beside every profile; a test that does not
  // ask about them gets an answer rather than an unhandled request.
  gqlLink.query("ProfileFigures", () => HttpResponse.json({ data: { user: null } })),
  // Every profile lands on its posts view (ProfilePosts.md:5), so every
  // profile render reads it; a test that does not ask finds no post.
  gqlLink.query("ProfilePosts", ({ variables }) =>
    HttpResponse.json({
      data: {
        user: {
          __typename: "User",
          id: variables.id,
          posts: {
            __typename: "PostConnection",
            edges: [],
            pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          },
        },
      },
    }),
  ),
  gqlLink.mutation("MarkSeen", ({ variables }) => {
    marked.push(variables.nodes as string[]);
    return HttpResponse.json({
      data: { markSeen: { __typename: "MarkSeenPayload", ok: true, userErrors: [] } },
    });
  }),
);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function profile(id: string, handle: string, bio: string | null = "Curious.") {
  return {
    __typename: "User",
    id,
    handle,
    displayName: moderated("Ada L"),
    bio: moderated(bio),
    websiteUrl: moderated("https://ada.example"),
    viewerBookmarkedAt: null,
  };
}

function meHandler(accountState: "APPLICANT" | "MEMBER" = "MEMBER") {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

function recordsHandler(
  rows: {
    id: string;
    family: string;
    targetId?: string;
    postId?: string;
    on?: string;
    pair?: [number, number];
    act?: string;
    topic?: string;
    cites?: string;
  }[],
) {
  return gqlLink.query("ProfileChronicle", () =>
    HttpResponse.json(
      chroniclePage(
        rows.map((row) => ({
          __typename: "Record",
          id: row.id,
          family: row.family,
          act: row.act ?? (row.targetId === undefined ? "GENESIS" : "ORDINARY"),
          targetId: row.targetId ?? `mint:${row.id}`,
          terminalId: null,
          topic: row.topic ? { __typename: "Hashtag", name: { __typename: "ModeratedText", value: row.topic } } : null,
          landedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          pDirected: row.pair?.[0] ?? 0,
          pInterest: row.pair?.[1] ?? 0,
          severed: row.pair ? false : null,
          target: row.postId
            ? {
                __typename: "Post",
                id: row.postId,
                title: { __typename: "ModeratedText", value: "Hello world" },
                content: { __typename: "ModeratedText", value: "Body" },
              }
            : row.on
              ? { __typename: "User", id: `u-${row.on}`, handle: row.on }
              : null,
          terminal: row.cites
            ? {
                __typename: "Post",
                id: row.cites,
                title: { __typename: "ModeratedText", value: "The long way home" },
                content: { __typename: "ModeratedText", value: "Body" },
              }
            : null,
        })),
      ),
    ),
  );
}

/** The chronicle stands on Everything, one tap from where the profile lands. */
async function openEverything() {
  fireEvent.click(await screen.findByTestId(byNode("profile.tabRow.everythingTab")));
}

beforeEach(() => {
  window.localStorage.clear();
  resetSeenQueueForTests();
  forgetAllProfileViews();
  resetProfileChangeForTests();
  marked = [];
});

describe("ProfileScreen", () => {
  it("renders a public profile by handle with its chronicle", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([{ id: "act:a:1:publish", family: "PUBLISH", postId: "p1" }]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    expect(await screen.findByTestId(byNode("profile.identity.name"))).toHaveTextContent("Ada L");
    // The bar carries the handle, so the header does not repeat it
    // (ProfileHeader `showHandle`, ProfileOther.md:3).
    expect(screen.getByTestId(byNode("profile.header.title"))).toHaveTextContent("@ada");
    expect(screen.queryByTestId(byNode("profile.identity.handle"))).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Curious.");
    expect(screen.getByTestId(byNode("profile.identity.website"))).toHaveAttribute("href", "https://ada.example");
    // Another actor's profile carries no own affordances.
    expect(screen.queryByTestId(byNode("profile.identity.actionRow.edit"))).not.toBeInTheDocument();
    expect(screen.queryByTestId(byNode("profile.band.gear"))).not.toBeInTheDocument();
    // The chronicle row labels and links to the touched post.
    await openEverything();
    const row = await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(row).toHaveTextContent("Published a post");
    expect(row).toHaveTextContent("Hello world");
    // Its age on the trailing edge, and its post naming this profile as the
    // way back (ProfileOther.md:59).
    expect(screen.getByTestId(byNode("profile.chronicle.act.trailing", "1"))).toHaveTextContent("3d");
    expect(row.querySelector("a")).toHaveAttribute("href", "/posts/p1?from=u%3Aada");
  });

  // THE CHRONICLE'S ROWS (copy-voice.md, the profile's carried-over words):
  // an opinion on a person wears its face and names them, and has nowhere to
  // open; a profile update is `theirs` on another's page.
  it("reads an opinion on a person and a profile update in the blessed words", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([
        { id: "act:a:2:opinion", family: "OPINION", targetId: "prof:mira", on: "mira", pair: [0.4, 0.5] },
        { id: "act:a:1:registration", family: "REGISTRATION", targetId: "prof:ada" },
      ]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    const opinion = await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(opinion).toHaveTextContent("Gave an opinion");
    expect(screen.getByTestId(byNode("profile.chronicle.act.aside", "1"))).toHaveTextContent("on @mira");
    expect(opinion.querySelector("a")).toBeNull();
    expect(screen.getByTestId(byNode("profile.chronicle.act", "2"))).toHaveTextContent(
      "Updated their profile",
    );
  });

  // THE CHRONICLE'S VERBS (copy-voice, round 22; seam 247 rider 2): the
  // server's `act` picks the verb — a walk-back wears 🤷 and reads `Walked
  // back an opinion`, the vouch that landed someone reads `Vouched for`, and
  // the account's first registration reads `Joined`.
  it("reads a walk-back, a vouch and the joining from the record's act", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([
        { id: "act:a:3:opinion", family: "OPINION", targetId: "prof:mira", on: "mira", pair: [-0.4, -0.5], act: "WALK_BACK" },
        { id: "act:a:2:opinion", family: "OPINION", targetId: "prof:rafa", on: "rafa", pair: [0.1, 0.1], act: "VOUCH" },
        { id: "act:a:1:registration", family: "REGISTRATION", act: "GENESIS" },
      ]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    const walkBack = await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(walkBack).toHaveTextContent("Walked back an opinion");
    expect(screen.getByTestId(byNode("profile.chronicle.act.aside", "1"))).toHaveTextContent("on @mira");
    // 🤷, never the counter-record's own face.
    expect(screen.getByTestId(byNode("profile.chronicle.act.disc", "1"))).toHaveTextContent("🤷");
    expect(screen.getByTestId(byNode("profile.chronicle.act", "2"))).toHaveTextContent("Vouched for");
    expect(screen.getByTestId(byNode("profile.chronicle.act.aside", "2"))).toHaveTextContent("@rafa");
    expect(screen.getByTestId(byNode("profile.chronicle.act.aside", "2"))).not.toHaveTextContent("on @rafa");
    expect(screen.getByTestId(byNode("profile.chronicle.act", "3"))).toHaveTextContent("Joined");
  });

  // copy-voice, *The chronicle's verbs*: a tag's aside is the tag
  // (`#saltmaps`), an opinion on a topic reads `on #saltmaps`, and a citation
  // taken back reads `Withdrew a citation` with the cited thing under it.
  it("prints a tag's topic aside, an opinion on a topic, and a withdrawn citation", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([
        { id: "act:a:3:tag", family: "TAG", targetId: "mint:act:a:1:publish", postId: "p1", topic: "saltmaps", pair: [1, 0.5] },
        { id: "act:a:2:affinity", family: "AFFINITY", targetId: "name:saltmaps", topic: "saltmaps", pair: [0.4, 0.5] },
        { id: "act:a:1:reference", family: "REFERENCE", targetId: "mint:act:a:1:publish", cites: "p9", act: "WITHDRAWAL", pair: [-0.5, -0.5] },
      ]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    const tag = await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    expect(tag).toHaveTextContent("Tagged a post");
    expect(screen.getByTestId(byNode("profile.chronicle.act.aside", "1"))).toHaveTextContent("#saltmaps");
    expect(screen.getByTestId(byNode("profile.chronicle.act", "2"))).toHaveTextContent("Gave an opinion");
    expect(screen.getByTestId(byNode("profile.chronicle.act.aside", "2"))).toHaveTextContent("on #saltmaps");
    const withdrawn = screen.getByTestId(byNode("profile.chronicle.act", "3"));
    expect(withdrawn).toHaveTextContent("Withdrew a citation");
    expect(withdrawn).toHaveTextContent("The long way home");
    expect(withdrawn).not.toHaveTextContent("Cited a post");
  });

  // THE HEADER'S FIGURES (ProfileOther.md:7; Q35 ruled 2026-11-10: bundles,
  // never records): three labelled figures,
  // never merged, grouped as every figure is.
  it("draws the three figures, each labelled, from ProfileFigures", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
      gqlLink.query("ProfileFigures", () =>
        HttpResponse.json({
          data: {
            user: {
              __typename: "User",
              id: "u2",
              posts: { __typename: "PostConnection", totalCount: 12 },
              opinionsOn: { __typename: "RecordConnection", bundleCount: 1204 },
              opinionsBy: { __typename: "RecordConnection", bundleCount: 7 },
            },
          },
        }),
      ),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    const posts = await screen.findByTestId(byNode("profile.identity.figures.posts"));
    expect(posts).toHaveTextContent("12Posts");
    expect(screen.getByTestId(byNode("profile.identity.figures.stancesOn.value"))).toHaveTextContent("1,204");
    expect(screen.getByTestId(byNode("profile.identity.figures.stancesOn.label"))).toHaveTextContent(
      "Opinions on them",
    );
    expect(screen.getByTestId(byNode("profile.identity.figures.stancesTaken.label"))).toHaveTextContent(
      "Opinions by them",
    );
    expect(screen.getByTestId(byNode("profile.identity.figures.stancesTaken.value"))).toHaveTextContent("7");
  });

  // THE TWO OPINION FIGURES ARE TWO DOORS (ProfileOther.md:9 and 57-61,
  // Profile.md:13 and 49-53; ProfileHeader.jsx `onCounts`; copy-voice, *The
  // profile's figures, spoken*): each opens the opinions page on its own
  // direction, the Posts figure is no door.
  describe("the figures row", () => {
    function figures(id: string) {
      return gqlLink.query("ProfileFigures", () =>
        HttpResponse.json({
          data: {
            user: {
              __typename: "User",
              id,
              posts: { __typename: "PostConnection", totalCount: 12 },
              opinionsOn: { __typename: "RecordConnection", bundleCount: 1204 },
              opinionsBy: { __typename: "RecordConnection", bundleCount: 7 },
            },
          },
        }),
      );
    }

    it("opens someone's opinions page on On from Opinions on, and on By from Opinions by", async () => {
      server.use(
        gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })),
        recordsHandler([]),
        figures("u2"),
      );
      renderWithProviders(<ProfileScreen handle="ada" />);
      const on = await screen.findByRole("link", { name: "1,204 Opinions on them" });
      expect(on).toHaveAttribute("data-testid", "profile.identity.figures.stancesOn");
      expect(on).toHaveAttribute("href", "/u/ada/opinions");
      const by = screen.getByRole("link", { name: "7 Opinions by them" });
      expect(by).toHaveAttribute("data-testid", "profile.identity.figures.stancesTaken");
      expect(by).toHaveAttribute("href", "/u/ada/opinions?tab=by");
      expect(screen.getByTestId(byNode("profile.identity.figures")).tagName).toBe("DIV");
      expect(screen.getByTestId(byNode("profile.identity.figures.posts")).closest("a")).toBeNull();
    });

    it("carries the profile's own origin onto the page from either door, so its way back holds", async () => {
      server.use(
        gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })),
        recordsHandler([]),
        figures("u2"),
      );
      renderWithProviders(<ProfileScreen handle="ada" from="saved" />);
      expect(await screen.findByTestId(byNode("profile.identity.figures.stancesOn"))).toHaveAttribute(
        "href",
        "/u/ada/opinions?from=saved",
      );
      expect(screen.getByTestId(byNode("profile.identity.figures.stancesTaken"))).toHaveAttribute(
        "href",
        "/u/ada/opinions?tab=by&from=saved",
      );
    });

    it("opens your own opinions page from your own root on each direction", async () => {
      server.use(
        meHandler(),
        gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
        recordsHandler([]),
        figures("u1"),
      );
      renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
      expect(await screen.findByRole("link", { name: "1,204 Opinions on you" })).toHaveAttribute(
        "href",
        "/profile/opinions",
      );
      expect(screen.getByRole("link", { name: "7 Opinions by you" })).toHaveAttribute(
        "href",
        "/profile/opinions?tab=by",
      );
    });
  });

  // A PERSON OPENED FROM AN OPINIONS PAGE (ProfileStances.md:21): their arrow
  // reads `Back to the opinions` and returns to the page on its tab.
  it("reads Back to the opinions when an opinions row opened it", async () => {
    server.use(
      gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u3", "tobias") } })),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="tobias" from="opinions.by:ada" />);
    const back = await screen.findByTestId(byNode("profile.header.back"));
    expect(back).toHaveAccessibleName("Back to the opinions");
    expect(back).toHaveAttribute("href", "/u/ada/opinions?tab=by");
  });

  // THE CHRONICLE'S TAB ROW (TabBar.jsx; Profile.md:23): three glyph toggles
  // named in the accessibility tree, the reader landing on Posts
  // (ProfileOther.md:21: "NEVER it lands on Everything or Comments").
  it("lands on Posts under the chronicle's glyph tabs", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    const tabs = await screen.findByRole("group", { name: "What the chronicle shows" });
    expect(tabs).toHaveAttribute("data-testid", "profile.tabRow");
    expect(screen.getByTestId(byNode("profile.tabRow.postsTab"))).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(byNode("profile.tabRow.everythingTab"))).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(byNode("profile.tabRow.commentsTab"))).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId(byNode("profile.tabRow.postsTab"))).toHaveAccessibleName("Posts");
    expect(screen.getByTestId(byNode("profile.tabRow.commentsTab"))).toHaveAccessibleName("Comments");
  });

  // THE ACTIONS ROW ON SOMEONE ELSE'S PAGE (ProfileHeader.jsx; ProfileOther.md:9,
  // :53-55): the wide opinion, then Message, then the ⋮.
  it("leads the row with the wide opinion, then Message, then the ⋮", async () => {
    push.mockClear();
    server.use(
      meHandler(),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
    const row = await screen.findByTestId(byNode("profile.identity.actionRow"));
    const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
    expect(anchor.className).toContain("flex-1");
    expect(anchor).toHaveTextContent("Your opinion");
    const wanted = new Set([
      "profile.identity.actionRow.stance",
      "profile.identity.actionRow.message",
      "profile.identity.actionRow.menu",
    ]);
    const order = Array.from(row.querySelectorAll("[data-testid]"))
      .map((el) => el.getAttribute("data-testid"))
      .filter((id) => id !== null && wanted.has(id));
    expect(order).toEqual([...wanted]);
    fireEvent.click(screen.getByTestId(byNode("profile.identity.actionRow.message")));
    expect(push).toHaveBeenCalledWith("/chats?from=u%3Aada");
  });

  // ChatsComingSoon.md:17 and :21: the page reads Back to the profile and its
  // arrow brings the profile back as it was left — opened with the origin it was
  // opened with, so the profile still names Saved and keeps its root lit.
  it("hands Chats the profile's own origin on Message", async () => {
    push.mockClear();
    server.use(
      meHandler(),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" from="saved" />, { store: signedInStore() });
    fireEvent.click(await screen.findByTestId(byNode("profile.identity.actionRow.message")));
    expect(push).toHaveBeenCalledWith("/chats?from=u%3Aada%2Fsaved");
  });

  // ProfileOther.md:51 — a guest's wide anchor names the borrowed view beside
  // the hollow face, its handle ellipsized before `'s opinion`.
  it("profileother_md_51_a_guests_wide_anchor_words_name_the_borrowed_view", async () => {
    server.use(
      borrowedViewHandler("genesismod"),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
    await waitFor(() => expect(anchor).toHaveTextContent("@genesismod's opinion"));
    expect(anchor).not.toHaveTextContent("Your opinion");
    expect(screen.getByTestId(byNode("profile.identity.actionRow.stance.anchor.face"))).toHaveTextContent("🫥");
    expect(screen.getByTestId("profile-stance-words-handle").className).toContain("truncate");
    expect(screen.getByTestId("profile-stance-words-suffix").className).toContain("flex-none");
  });

  // ProfileOther.md:53 — its accessible name keeps the full handle.
  it("profileother_md_53_a_guests_wide_anchor_name_keeps_the_full_handle", async () => {
    server.use(
      borrowedViewHandler("genesismod"),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
    await waitFor(() => expect(anchor).toHaveAccessibleName("@genesismod's opinion on @ada"));
  });

  // ProfileOther.md:49 — the guest's tap still opens the gate under the new words.
  it("profileother_md_49_a_guests_tap_on_the_named_anchor_opens_the_gate", async () => {
    server.use(
      borrowedViewHandler("genesismod"),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
    await waitFor(() => expect(anchor).toHaveTextContent("@genesismod's opinion"));
    fireEvent.click(anchor);
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
  });

  it("asks a guest to join on Message", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    fireEvent.click(await screen.findByTestId(byNode("profile.identity.actionRow.message")));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
  });

  // A DELETED ACCOUNT KEEPS THE SHELLS (ProfileDeleted.md): the reserved disc,
  // `Deleted account`, no handle anywhere — the bar's title included — the
  // mark in the bio's place, the opinion named `this account`, no Message.
  it("placeholders a deleted account's identity and keeps its shells", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({
          data: {
            user: {
              ...profile("u2", "marlow", null),
              displayName: { __typename: "ModeratedText", value: null, status: "REDACTED" },
              websiteUrl: moderated(null),
            },
          },
        }),
      ),
      recordsHandler([{ id: "act:m:1:publish", family: "PUBLISH", postId: "p1" }]),
    );
    renderWithProviders(<ProfileScreen handle="marlow" />);
    const name = await screen.findByTestId(byNode("profile.identity.name"));
    expect(name).toHaveTextContent("Deleted account");
    expect(name.className).toContain("text-on-surface-variant");
    expect(screen.queryByTestId(byNode("profile.header.title"))).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("profile.identity.removalMark.line"))).toHaveTextContent(
      "Deleted by the person whose account it was",
    );
    expect(screen.queryByTestId(byNode("profile.identity.actionRow.message"))).not.toBeInTheDocument();
    expect(
      await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor")),
    ).toHaveAccessibleName("Give your opinion on this account");
    // ProfileDeleted.md:5 — it lands on Posts, as every profile does.
    expect(await screen.findByTestId(byNode("profile.posts.empty.title"))).toBeInTheDocument();
    expect(screen.getByTestId(byNode("profile.tabRow.postsTab"))).toHaveAttribute("aria-pressed", "true");
    await openEverything();
    expect(await screen.findByTestId(byNode("profile.chronicle.act", "1"))).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent("@marlow");
  });

  it("makes the stance the header's primary action on another actor", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    // The interpersonal stance is the same generic gesture a post takes
    // (design.md §6 "Profile header"; api-spec.md "The generic stance").
    expect(await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"))).toBeInTheDocument();
  });

  it("wears the viewer's own standing toward that actor", async () => {
    // §8.3: at rest the target shows the standing — an interpersonal
    // bundle reads exactly the way a post's does.
    server.use(
      meHandler(),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
      ...stanceHandlers({ u2: { pDirected: 0.6, pInterest: 0.65, recordCount: 4 } }),
    );
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profile.identity.actionRow.stance.anchor"))).toHaveAccessibleName(/Really into this/),
    );
    expect(screen.getByTestId(byNode("profile.identity.actionRow.stance.anchor.exact"))).toHaveTextContent("+0.60 / +0.65");
  });

  it("wears that standing on a load that starts with no access token", async () => {
    // The same arrival the post detail surface has a twin for: refresh
    // token persisted, access token still unminted in this tab. The
    // header's own Me read reaches the guard first here, so this surface
    // was never the one that showed the defect — which is exactly why it
    // needs pinning: nothing about the stance read itself was making it
    // work, and a reordering of the header would have taken it too.
    window.localStorage.setItem("cogra.activeAccount", "u1");
    window.localStorage.setItem("cogra.refreshToken", "refresh-1");
    const store = createTokenStore();

    const anonymous: string[] = [];
    server.use(
      gqlLink.query("Me", ({ request }) =>
        HttpResponse.json({
          data:
            request.headers.get("authorization") === null
              ? { me: null }
              : {
                  me: {
                    __typename: "User",
                    id: "u1",
                    handle: "ada",
                    displayName: { __typename: "ModeratedText", value: null },
                    accountState: "MEMBER",
                    hasReciprocated: true,
                    vouchBackDismissed: false,
                    invitedBy: null,
                  },
                },
        }),
      ),
      gqlLink.mutation("RefreshSession", () =>
        HttpResponse.json({
          data: {
            refreshSession: {
              __typename: "AuthPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-2",
                refreshToken: "refresh-2",
                user: { __typename: "User", id: "u1" },
              },
              userErrors: [],
            },
          },
        }),
      ),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
      gqlLink.query("ProfileStance", ({ variables, request }) => {
        const id = String(variables.id);
        const authorized = request.headers.get("authorization") !== null;
        if (!authorized) anonymous.push(id);
        return HttpResponse.json({
          data: {
            user: {
              __typename: "User",
              id,
              viewerStance: authorized
                ? stanceBundle({ pDirected: 0.6, pInterest: 0.65, recordCount: 4 })
                : null,
            },
          },
        });
      }),
    );

    renderWithProviders(<ProfileScreen handle="ada" />, { store });
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profile.identity.actionRow.stance.anchor.exact"))).toHaveTextContent(
        "+0.60 / +0.65",
      ),
    );
    expect(store.accessToken()).toBe("access-2");
    expect(anonymous).not.toContain("u2");
  });

  it("offers no stance on one's own profile", async () => {
    server.use(
      meHandler(),
      gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    expect(await screen.findByTestId(byNode("profile.identity.actionRow.edit"))).toBeInTheDocument();
    expect(screen.queryByTestId(byNode("profile.identity.actionRow.stance.anchor"))).not.toBeInTheDocument();
  });

  it("adds another's opened profile to History, the profile alone", async () => {
    server.use(
      meHandler(),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([{ id: "act:a:1:publish", family: "PUBLISH", postId: "p1" }]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
    await openEverything();
    await screen.findByTestId(byNode("profile.chronicle.act"));
    // The profile, never the chronicle's posts: those join only as a list
    // sees them.
    await waitFor(() => expect(marked).toEqual([["u2"]]));
  });

  it("adds nothing for a profile opened with no session", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId(byNode("profile.identity.name"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(marked).toEqual([]);
  });

  it("adds nothing for the reader's own profile, by tab or by handle", async () => {
    server.use(
      meHandler(),
      gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    const tab = renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    await screen.findByTestId(byNode("profile.identity.actionRow.edit"));
    tab.unmount();
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
    await screen.findByTestId(byNode("profile.identity.actionRow.edit"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(marked).toEqual([]);
  });

  // THE PROFILE'S ⋮ (ProfileOwnMenu.md, ProfileMenu.md, ProfileDeletedMenu.md;
  // saved-surface SS-1): three sheets, built whole.
  describe("the profile menu", () => {
    function rows() {
      return Array.from(
        screen.getByTestId("profile.menuSheet").querySelectorAll("[data-testid^='profile.menuSheet.']"),
        (row) => [row.getAttribute("data-testid"), row.textContent],
      ).filter(([id]) => id !== "profile.menuSheet.dragHandle");
    }

    function other(overrides: Record<string, unknown> = {}) {
      return gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: { ...profile("u2", "ada"), ...overrides } } }),
      );
    }

    it("the_own_menu_reads_saved_history_share_and_opens_saved", async () => {
      server.use(
        meHandler(),
        gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
        recordsHandler([]),
      );
      renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      expect(rows()).toEqual([
        ["profile.menuSheet.saved", "Saved"],
        ["profile.menuSheet.history", "History"],
        ["profile.menuSheet.share", "Share your profile"],
      ]);
      fireEvent.click(screen.getByTestId("profile.menuSheet.saved"));
      expect(push).toHaveBeenCalledWith("/saved");
    });

    // ProfileOwnMenu.md:13/15 — History opens; which state it opens on is the
    // page's own read (`history-view.test.tsx`).
    it("the_own_menus_history_row_opens_history", async () => {
      server.use(
        meHandler(),
        gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
        recordsHandler([]),
      );
      renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.history"));
      expect(push).toHaveBeenCalledWith("/history");
    });

    it("another_persons_menu_reads_save_mention_share_hide_report", async () => {
      server.use(meHandler(), other(), recordsHandler([]));
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      expect(rows()).toEqual([
        ["profile.menuSheet.save", "Save"],
        ["profile.menuSheet.mention", "Mention in a new post"],
        ["profile.menuSheet.share", "Share this profile"],
        ["profile.menuSheet.hide", "Hide @ada"],
        ["profile.menuSheet.report", "Report"],
      ]);
    });

    it("a_deleted_accounts_menu_has_no_mention_and_names_no_handle", async () => {
      server.use(
        meHandler(),
        other({ displayName: { __typename: "ModeratedText", value: null, status: "REDACTED" } }),
        recordsHandler([]),
      );
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      expect(rows()).toEqual([
        ["profile.menuSheet.save", "Save"],
        ["profile.menuSheet.share", "Share this profile"],
        ["profile.menuSheet.hide", "Hide this account"],
        ["profile.menuSheet.report", "Report"],
      ]);
      fireEvent.click(screen.getByTestId("profile.menuSheet.report"));
      expect(await screen.findByText("Report this account?")).toBeInTheDocument();
    });

    it("save_from_a_profile_keeps_the_person_and_snackbars_saved", async () => {
      const log = bookmarkLog();
      server.use(meHandler(), other(), recordsHandler([]), ...bookmarkHandlers(log));
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.save"));
      expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent("Saved.");
      await waitFor(() => expect(log.sets).toEqual([{ node: "u2", at: null }]));
    });

    it("unsave_from_a_profile_offers_undo", async () => {
      const log = bookmarkLog();
      server.use(
        meHandler(),
        other({ viewerBookmarkedAt: "2026-10-01T08:00:00Z" }),
        recordsHandler([]),
        ...bookmarkHandlers(log),
      );
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      expect(screen.getByTestId("profile.menuSheet.save")).toHaveTextContent("Unsave");
      fireEvent.click(screen.getByTestId("profile.menuSheet.save"));
      expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(
        "Removed from Saved.",
      );
      fireEvent.click(screen.getByTestId("profile.snackbar.action"));
      await waitFor(() =>
        expect(log.sets).toEqual([{ node: "u2", at: "2026-10-01T08:00:00Z" }]),
      );
    });

    it("a_failed_profile_save_says_retry_in_the_actions_row", async () => {
      server.use(
        meHandler(),
        other(),
        recordsHandler([]),
        ...bookmarkHandlers(bookmarkLog(), { failSet: true }),
      );
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.save"));
      expect(await screen.findByTestId("profile-row-line")).toHaveTextContent(
        "That didn't go through.",
      );
      expect(screen.queryByTestId("profile.snackbar.message")).not.toBeInTheDocument();
    });
    it("hide_from_a_profile_keeps_the_profile_open", async () => {
      const log = hiddenLog();
      server.use(meHandler(), other(), recordsHandler([]), ...hiddenHandlers(log));
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.hide"));
      expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(
        "@ada is hidden.",
      );
      // ProfileMenu.md:23 — the reader stays on the profile.
      expect(screen.getByTestId("profile.identity.actionRow.menu")).toBeInTheDocument();
      await waitFor(() => expect(log.hides).toEqual([{ actor: "u2", at: null }]));
      fireEvent.click(screen.getByTestId("profile.snackbar.action"));
      await waitFor(() => expect(log.unhides).toEqual(["u2"]));
    });

    it("a_deleted_accounts_hide_reads_this_account_is_hidden", async () => {
      server.use(
        meHandler(),
        other({ displayName: { __typename: "ModeratedText", value: null, status: "REDACTED" } }),
        recordsHandler([]),
        ...hiddenHandlers(hiddenLog()),
      );
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.hide"));
      expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(
        "This account is hidden.",
      );
    });

    it("a_hidden_persons_profile_still_opens", async () => {
      server.use(
        meHandler(),
        other(),
        recordsHandler([]),
        ...hiddenHandlers(hiddenLog(), {
          entries: [{ id: "u2", handle: "ada", displayName: "Ada", hiddenAt: "2026-10-01T00:00:00Z" }],
        }),
      );
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      expect(await screen.findByTestId("profile.identity.actionRow.menu")).toBeInTheDocument();
    });

    // ProfileMenu.md:31 — the hide row reads Unhide with the handle while the
    // person is hidden, the profile reached by a link; :33 — the tap unhides,
    // the reader stays, the snackbar offers Undo, and no dialog asks.
    it("a_hidden_persons_menu_reads_unhide_and_the_tap_unhides_keeping_the_profile", async () => {
      const log = hiddenLog();
      server.use(
        meHandler(),
        other(),
        recordsHandler([]),
        ...hiddenHandlers(log, {
          entries: [{ id: "u2", handle: "ada", displayName: "Ada", hiddenAt: "2026-10-01T00:00:00Z" }],
        }),
      );
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      await waitFor(() => expect(log.reads).toBeGreaterThan(0));
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      await waitFor(() =>
        expect(rows()).toEqual([
          ["profile.menuSheet.save", "Save"],
          ["profile.menuSheet.mention", "Mention in a new post"],
          ["profile.menuSheet.share", "Share this profile"],
          ["profile.menuSheet.hide", "Unhide @ada"],
          ["profile.menuSheet.report", "Report"],
        ]),
      );
      fireEvent.click(screen.getByTestId("profile.menuSheet.hide"));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(
        "@ada is unhidden.",
      );
      expect(screen.getByTestId("profile.snackbar.action")).toHaveTextContent("Undo");
      expect(screen.getByTestId("profile.identity.actionRow.menu")).toBeInTheDocument();
      await waitFor(() => expect(log.unhides).toEqual(["u2"]));
    });

    it("a_guest_meets_the_ask_on_hide", async () => {
      const log = hiddenLog();
      server.use(other(), recordsHandler([]), ...hiddenHandlers(log));
      renderWithProviders(<ProfileScreen handle="ada" />);
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.hide"));
      expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
      expect(log.hides).toEqual([]);
    });

    it("a_guest_meets_the_ask_on_a_profile_save", async () => {
      const log = bookmarkLog();
      server.use(other(), recordsHandler([]), ...bookmarkHandlers(log));
      renderWithProviders(<ProfileScreen handle="ada" />);
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.save"));
      expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
      expect(log.sets).toEqual([]);
    });

    // ProfileMenu.md:17 — the wizard opens with the person staged, through
    // the door a card's Cite uses (`?reference=`).
    it("mention_opens_the_wizard_with_the_person_staged", async () => {
      server.use(meHandler(), other(), recordsHandler([]));
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.mention"));
      expect(push).toHaveBeenCalledWith("/compose?reference=u2");
      await waitFor(() => expect((screen.getByTestId("profile.menuSheet") as HTMLDialogElement).open).toBe(false));
    });

    // ProfileMenu.md:19 — an applicant is told, and the wizard never opens.
    it("an_applicants_mention_says_post_once_in_and_opens_no_wizard", async () => {
      push.mockClear();
      server.use(meHandler("APPLICANT"), other(), recordsHandler([]));
      // The session's one account read answered APPLICANT (`reader-state.ts`).
      renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore(), reader: "APPLICANT" });
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.mention"));
      expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(
        "You can post once you're in.",
      );
      expect(push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/compose/));
      await waitFor(() => expect((screen.getByTestId("profile.menuSheet") as HTMLDialogElement).open).toBe(false));
    });

    // ProfileOther.md:45-49 — the wide anchor, GIVEN the reader is an
    // applicant: the locked look, and a tap tells AND NEVER the pad blooms.
    it("an_applicants_wide_anchor_is_locked_and_its_tap_says_give_your_opinion_once_in", async () => {
      server.use(meHandler("APPLICANT"), other(), recordsHandler([]));
      renderWithProviders(
        <>
          <ProfileScreen handle="ada" />
          <CarriedSnackbar />
        </>,
        { store: signedInStore(), reader: "APPLICANT", stanceData: createStubStanceData() },
      );
      const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
      expect(anchor.className).toContain("opacity-[var(--state-disabled)]");
      fireEvent.click(anchor);
      expect(screen.getByTestId("carried-snackbar")).toHaveTextContent("You can give your opinion once you're in.");
      expect(screen.queryByTestId("profile-stance-pad")).toBeNull();
    });

    it("a_members_wide_anchor_opens_the_pad", async () => {
      server.use(meHandler(), other(), recordsHandler([]));
      renderWithProviders(<ProfileScreen handle="ada" />, {
        store: signedInStore(),
        reader: "MEMBER",
        stanceData: createStubStanceData(),
      });
      const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
      expect(anchor.className).not.toContain("opacity-[var(--state-disabled)]");
      fireEvent.click(anchor);
      expect(await screen.findByTestId("profile-stance-pad")).toBeInTheDocument();
    });

    // ProfileMenu.md:35 — a guest's Mention opens the gate, never the wizard.
    it("a_guest_meets_the_ask_on_mention", async () => {
      push.mockClear();
      server.use(other(), recordsHandler([]));
      renderWithProviders(<ProfileScreen handle="ada" />);
      fireEvent.click(await screen.findByTestId("profile.identity.actionRow.menu"));
      fireEvent.click(screen.getByTestId("profile.menuSheet.mention"));
      expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
      expect(push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/compose/));
    });

    it("opened_from_saved_the_back_arrow_reads_back_to_saved", async () => {
      server.use(other(), recordsHandler([]));
      renderWithProviders(<ProfileScreen handle="ada" from="saved" />);
      const back = await screen.findByTestId(byNode("profile.header.back"));
      expect(back).toHaveAttribute("aria-label", "Back to Saved");
      expect(back).toHaveAttribute("href", "/saved");
    });
  });

  it("shows not-found for an unknown handle", async () => {
    server.use(
      gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: null } })),
    );
    renderWithProviders(<ProfileScreen handle="nobody" />);
    expect(await screen.findByTestId("profile-not-found")).toBeInTheDocument();
  });

  it("offers edit, settings, and invites on the own profile", async () => {
    server.use(
      meHandler(),
      gqlLink.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    expect(await screen.findByTestId(byNode("profile.identity.actionRow.edit"))).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByTestId(byNode("profile.band.gear"))).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId(byNode("profile.identity.actionRow.invites"))).toHaveAttribute("href", "/invites");
    // Profile.md:25 — the own profile lands on Posts.
    expect(await screen.findByTestId(byNode("profile.posts.empty.title"))).toBeInTheDocument();
    // The root wears the band (`ProfileBand`): gear, then chats, then the bell.
    expect(screen.getByTestId(byNode("profile.band.gear"))).toHaveAccessibleName("Settings");
    expect(screen.getByTestId(byNode("profile.band.wordmark"))).toHaveTextContent("cogra");
    push.mockClear();
    fireEvent.click(screen.getByTestId(byNode("profile.band.chats")));
    expect(push).toHaveBeenCalledWith("/chats?from=profile");
    expect(screen.getByTestId(byNode("profile.band.bell"))).toBeInTheDocument();
    // Your own page repeats the handle under the name (the band carries none).
    expect(screen.getByTestId(byNode("profile.identity.handle"))).toHaveTextContent("@ada");
  });

  // Profile.md:47 — the own avatar wears the change badge, the door to the
  // picture's crop and its own seal (ProfileHeader.jsx `changeBadge`).
  it("the own avatar's change badge picks a picture and opens the picture's own flow", async () => {
    server.use(
      meHandler(),
      gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    const badge = await screen.findByTestId(byNode("profile.identity.changeBadge"));
    expect(badge).toHaveAccessibleName("Change your picture");
    // On the avatar's corner, -2/-2 (ProfileHeader.jsx): inline, because
    // `cg-state`'s unlayered `position: relative` beats an `absolute` utility.
    expect(badge.style.position).toBe("absolute");
    expect(badge.style.right).toBe("-2px");
    expect(badge.style.bottom).toBe("-2px");
    // The avatar is a picture, never a door: the badge is the only one.
    expect(screen.getByTestId(byNode("profile.identity.avatar")).closest("button, a")).toBeNull();
    const input = screen.getByTestId("profile-change-badge-input") as HTMLInputElement;
    const opened = vi.spyOn(input, "click");
    fireEvent.click(badge);
    expect(opened).toHaveBeenCalledTimes(1);
    push.mockClear();
    const file = new File([new Uint8Array([1]) as BlobPart], "face.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(push).toHaveBeenCalledWith("/profile/picture");
    expect(heldPicture()).toBe(file);
    releaseHeldPicture();
  });

  it("draws no change badge on someone else's profile", async () => {
    server.use(
      gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId(byNode("profile.identity.name"));
    expect(screen.queryByTestId(byNode("profile.identity.changeBadge"))).toBeNull();
    expect(screen.queryByTestId("profile-change-badge-input")).toBeNull();
  });

  // A signed profile edit is served from its signature on, pending until it
  // lands (substrate.md §6), and a handle change is immediate — so returning
  // to the profile from the editor or from settings shows the change on the
  // arrival's own read. That holds only because the arrival asks the server
  // rather than the cache the previous visit filled; the shared cache here is
  // that previous visit. The first visit is let settle, so its view is held and
  // the second arrival is a return (Profile.md:97): what the held head draws
  // while the read is out is not this test's to say, only that the read's
  // answer replaces it.
  it("a return to the own profile reads the server, not the last visit's cache", async () => {
    const cache = new InMemoryCache();
    let served = profile("u1", "ada", "Before the edit.");
    let asked = 0;
    server.use(
      meHandler(),
      gqlLink.query("MyProfile", () => {
        asked += 1;
        return HttpResponse.json({ data: { me: served } });
      }),
      recordsHandler([]),
    );
    const store = signedInStore();
    const first = renderWithProviders(<ProfileScreen handle={null} />, { store, cache });
    expect(await screen.findByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
    await screen.findByTestId(byNode("profile.posts.empty.title"));
    first.unmount();
    expect(recallProfileView("u1", null, null)).not.toBeNull();

    served = profile("u1", "ada_renamed", "Signed, not landed.");
    renderWithProviders(<ProfileScreen handle={null} />, { store, cache });
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Signed, not landed."),
    );
    expect(screen.getByTestId(byNode("profile.identity.handle"))).toHaveTextContent("@ada_renamed");
    expect(asked).toBe(2);
  });

  // A SIGNED EDIT SHOWS ON ARRIVAL (ProfileEditSeal.md:45 "WHEN the signing is
  // taken -> the profile shows the change AND the snackbar reads Signed — your
  // profile shows it now, still settling."; AvatarSeal.md:37; Profile.md:97 "so
  // a signed edit or a changed handle shows on arrival, and the list never
  // moves"). The return draws its held head at once, so the list does not move
  // — and that first frame must already wear what the device signed, never the
  // values from before the edit under the snackbar. The arrival's read is held
  // open here so the frame before it answers is the one asserted.
  describe("a return after a signed change", () => {
    const signedBio = "Signed, not landed.";
    // Every held read is let go after its test, passed or failed, so no request
    // is left hanging into the next one.
    const gates: (() => void)[] = [];
    const hold = () => new Promise<void>((resolve) => gates.push(resolve));
    afterEach(() => {
      for (const open of gates.splice(0)) open();
    });

    /** The own profile, visited once so its view is held; MyProfile answers only when `open` is called. */
    async function visitThenHold(cache: InMemoryCache) {
      let served = profile("u1", "ada", "Before the edit.");
      let gate: Promise<void> | null = null;
      let asked = 0;
      server.use(
        meHandler(),
        gqlLink.query("MyProfile", async () => {
          asked += 1;
          const answering = served;
          if (gate !== null) await gate;
          return HttpResponse.json({ data: { me: answering } });
        }),
        recordsHandler([]),
      );
      const store = signedInStore();
      const first = renderWithProviders(<ProfileScreen handle={null} />, { store, cache });
      expect(await screen.findByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
      await screen.findByTestId(byNode("profile.posts.empty.title"));
      first.unmount();
      expect(recallProfileView("u1", null, null)).not.toBeNull();
      gate = hold();
      const open = gates[gates.length - 1];
      return {
        store,
        serve: (next: ReturnType<typeof profile>) => {
          served = next;
        },
        open,
        asked: () => asked,
      };
    }

    const edited = {
      profileId: "u1",
      fields: { displayName: "Ada Lovelace", bio: signedBio, websiteUrl: "https://lovelace.example" },
    };

    it("wears the signed name, bio and website from the first frame, the held list unmoved, and the read confirms them", async () => {
      const cache = new InMemoryCache();
      const held = await visitThenHold(cache);
      await act(async () => {
        await signProfileChange(async () => ({ kind: "taken" }), { signed: edited });
      });
      // The edit's own landing, as `ProfileEditScreen`'s onTaken does it.
      carrySnackbar(PROFILE_SIGNED);
      held.serve({
        ...profile("u1", "ada", signedBio),
        displayName: moderated("Ada Lovelace"),
        websiteUrl: moderated("https://lovelace.example"),
      });
      renderWithProviders(
        <>
          <ProfileScreen handle={null} />
          <CarriedSnackbar />
        </>,
        { store: held.store, cache },
      );
      // The first frame: the held page, wearing the change — never the old bio.
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent(signedBio);
      expect(screen.getByTestId(byNode("profile.identity.name"))).toHaveTextContent("Ada Lovelace");
      expect(screen.getByTestId(byNode("profile.identity.website"))).toHaveAttribute(
        "href",
        "https://lovelace.example",
      );
      expect(screen.queryByText("Before the edit.")).toBeNull();
      // The list stands as it was left — no Loading…, no re-landing.
      expect(screen.getByTestId(byNode("profile.posts.empty.title"))).toBeInTheDocument();
      expect(screen.queryByTestId("profile-loading")).toBeNull();
      expect(screen.getByTestId("carried-snackbar")).toHaveTextContent(PROFILE_SIGNED);

      held.open();
      await waitFor(() => expect(held.asked()).toBe(2));
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent(signedBio);
    });

    it("wears the signed picture from the first frame", async () => {
      const cache = new InMemoryCache();
      const held = await visitThenHold(cache);
      const url = "https://media.example/new-face.webp";
      await act(async () => {
        await signProfileChange(async () => ({ kind: "taken" }), {
          signed: { profileId: "u1", fields: { avatar: { id: "m-new", url } } },
        });
      });
      renderWithProviders(<ProfileScreen handle={null} />, { store: held.store, cache });
      const img = screen.getByTestId(byNode("profile.identity.avatar")).querySelector("img");
      expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(url);
      // The fields the picture's own change left alone stand as held.
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
      held.open();
      await waitFor(() => expect(held.asked()).toBe(2));
    });

    it("keeps the head as it was for a change that did not go through, or is still signing", async () => {
      const cache = new InMemoryCache();
      const held = await visitThenHold(cache);
      // Closed while it signed, then not through: the failure line, the old head.
      let answer!: (outcome: ProfileChangeOutcome) => void;
      act(() => {
        void signProfileChange(() => new Promise((resolve) => (answer = resolve)), { signed: edited });
        closeProfileChangeSeal();
      });
      const view = renderWithProviders(<ProfileScreen handle={null} />, { store: held.store, cache });
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
      await act(async () => answer({ kind: "offline" }));
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
      expect(screen.getByTestId("profile-change-line")).toHaveTextContent("That didn't sign.");
      held.open();
      await waitFor(() => expect(held.asked()).toBe(2));
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
      view.unmount();
    });

    it("lets the read's answer stand over what was signed, whatever it says", async () => {
      const cache = new InMemoryCache();
      const held = await visitThenHold(cache);
      await act(async () => {
        await signProfileChange(async () => ({ kind: "taken" }), { signed: edited });
      });
      // The server answers without the change (its pending row gone): the
      // server is the truth about the profile, and the head follows it.
      held.serve(profile("u1", "ada", "What the server holds."));
      renderWithProviders(<ProfileScreen handle={null} />, { store: held.store, cache });
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent(signedBio);
      held.open();
      await waitFor(() =>
        expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent("What the server holds."),
      );
    });

    // A CHANGED HANDLE SHOWS ON ARRIVAL TOO (Profile.md:97). It is no signed
    // act: Settings' handle flow asks the server, and the change is the
    // profile's the moment the server takes it.
    async function changeHandleInSettings(
      store: ReturnType<typeof signedInStore>,
      cache: InMemoryCache,
      answer: Record<string, unknown>,
    ) {
      server.use(
        gqlLink.query("SettingsAccount", () =>
          HttpResponse.json({
            data: {
              me: {
                __typename: "User",
                id: "u1",
                handle: "ada",
                email: "ada@example.com",
                emailVerified: true,
                accountState: "MEMBER",
                actorPubkey: "pk",
                passwordChangedAt: null,
                keyBackupCreatedAt: null,
                pendingEmailChange: null,
                preferences: null,
                sessions: [],
              },
            },
          }),
        ),
        gqlLink.mutation("ChangeHandle", () =>
          HttpResponse.json({ data: { changeHandle: { __typename: "ChangeHandlePayload", ...answer } } }),
        ),
      );
      push.mockClear();
      const settings = renderWithProviders(<ChangeHandleView />, { store, cache });
      await waitFor(() => expect(screen.getByTestId("changeHandle.body")).toHaveTextContent("@ada is how"));
      fireEvent.change(screen.getByTestId("changeHandle.handle.input"), { target: { value: "ada_l" } });
      fireEvent.click(screen.getByTestId("changeHandle.commit.action"));
      fireEvent.click(screen.getByTestId("changeHandle.dialog.change"));
      return settings;
    }

    it("wears a handle Settings changed from the first frame of the return, and the read replaces it", async () => {
      resetSignedProfileForTests();
      const cache = new InMemoryCache();
      const held = await visitThenHold(cache);
      const settings = await changeHandleInSettings(held.store, cache, {
        user: { __typename: "User", id: "u1", handle: "ada_l" },
        userErrors: [],
      });
      await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=handle"));
      settings.unmount();
      held.serve(profile("u1", "ada_l", "Before the edit."));
      renderWithProviders(<ProfileScreen handle={null} />, { store: held.store, cache });
      // The first frame: the held page, wearing the new handle.
      expect(screen.getByTestId(byNode("profile.identity.handle"))).toHaveTextContent("@ada_l");
      expect(screen.getByTestId(byNode("profile.posts.empty.title"))).toBeInTheDocument();
      held.open();
      await waitFor(() => expect(held.asked()).toBe(2));
      expect(screen.getByTestId(byNode("profile.identity.handle"))).toHaveTextContent("@ada_l");
      // The read asked after the change answered: the head reads the server alone.
      expect(readSignedProfile("u1")).toBeNull();
    });

    it("keeps the held handle for a change the server refused", async () => {
      resetSignedProfileForTests();
      const cache = new InMemoryCache();
      const held = await visitThenHold(cache);
      const settings = await changeHandleInSettings(held.store, cache, {
        user: null,
        userErrors: [{ __typename: "UserError", code: "HANDLE_TAKEN", message: "taken", field: ["handle"] }],
      });
      await waitFor(() =>
        expect(screen.getByTestId("changeHandle.handle.support")).toHaveTextContent("That handle is taken."),
      );
      settings.unmount();
      renderWithProviders(<ProfileScreen handle={null} />, { store: held.store, cache });
      expect(screen.getByTestId(byNode("profile.identity.handle"))).toHaveTextContent(/^@ada$/);
      held.open();
      await waitFor(() => expect(held.asked()).toBe(2));
    });

    it("shows a change taken after its seal closed at once, before the profile's re-read answers", async () => {
      let served = profile("u1", "ada", "Before the edit.");
      let gate: Promise<void> | null = null;
      server.use(
        meHandler(),
        gqlLink.query("MyProfile", async () => {
          const answering = served;
          if (gate !== null) await gate;
          return HttpResponse.json({ data: { me: answering } });
        }),
        recordsHandler([]),
      );
      const store = signedInStore();
      let answer!: (outcome: ProfileChangeOutcome) => void;
      act(() => {
        void signProfileChange(() => new Promise((resolve) => (answer = resolve)), { signed: edited });
        closeProfileChangeSeal();
      });
      renderWithProviders(<ProfileScreen handle={null} />, { store });
      expect(await screen.findByTestId(byNode("profile.identity.bio"))).toHaveTextContent("Before the edit.");
      gate = hold();
      served = profile("u1", "ada", signedBio);
      await act(async () => answer({ kind: "taken" }));
      expect(screen.getByTestId(byNode("profile.identity.bio"))).toHaveTextContent(signedBio);
    });
  });

  it("locks the invites entry for an applicant and explains on tap", async () => {
    server.use(
      meHandler("APPLICANT"),
      gqlLink.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore(), reader: "APPLICANT" });
    const invites = await screen.findByTestId(byNode("profile.identity.actionRow.invites"));
    // Visible but locked (auth.md "Application"; ProfileApplicant.md:15): a
    // button at the disabled opacity, not a link, answering in the snackbar.
    expect(invites).not.toHaveAttribute("href");
    expect(invites.className).toContain("opacity-[var(--state-disabled)]");
    fireEvent.click(invites);
    expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent(
      "You can invite once you're in.",
    );
    // ProfileApplicant.md:22 — the page lands with the Posts tab lit, as every
    // profile does, its empty line reading Nothing here yet.
    expect(screen.getByTestId(byNode("profile.tabRow.postsTab"))).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(byNode("profile.posts.empty.title"))).toHaveTextContent(/^Nothing here yet\.$/);
    // The applicant's empty chronicle reads the same line.
    await openEverything();
    expect(await screen.findByTestId(byNode("profile.chronicle.empty.title"))).toHaveTextContent(
      /^Nothing here yet\.$/,
    );
  });

  // ONE SOURCE FOR THE APPLICANT (`reader-state.ts`): the profile's locks read
  // the session's reader state, never a verdict of their own.
  it("the_applicant_locks_read_the_shared_reader_state", async () => {
    server.use(
      meHandler("MEMBER"),
      gqlLink.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore(), reader: "APPLICANT" });
    // The page's own read says member; the shared state says applicant, and the
    // lock follows the shared state. The Invites lock is what still tells the
    // applicant apart here: the empty line reads the same for both
    // (round 42 cut its applicant tail).
    await waitFor(() => expect(screen.getByTestId(byNode("profile.posts.empty.title"))).toBeInTheDocument());
    const invites = screen.getByTestId(byNode("profile.identity.actionRow.invites"));
    expect(invites).not.toHaveAttribute("href");
    expect(invites.className).toContain("opacity-[var(--state-disabled)]");
    fireEvent.click(invites);
    expect(await screen.findByTestId("profile.snackbar.message")).toHaveTextContent("You can invite once you're in.");
  });

  // AN APPLICANT LET IN MID-SESSION: the profile's own fresh `me` read says
  // member, and the locks lift with no reload.
  it("the_profiles_fresh_me_read_saying_member_lifts_its_locks", async () => {
    const served = { accountState: "APPLICANT" as "APPLICANT" | "MEMBER" };
    server.use(
      gqlLink.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              handle: "ada",
              displayName: { __typename: "ModeratedText", value: null },
              actorPubkey: null,
              accountState: served.accountState,
              hasReciprocated: true,
              vouchBackDismissed: false,
              invitedBy: null,
              preferences: { __typename: "UserPreferences", contentFilteringSeverityLevel: null },
            },
          },
        }),
      ),
      gqlLink.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    function Later() {
      const [shown, show] = useState(false);
      return (
        <>
          <button type="button" data-testid="later-open" onClick={() => show(true)} />
          {shown && <ProfileScreen handle={null} />}
        </>
      );
    }
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Later />
      </>,
      { store: signedInStore() },
    );
    await waitFor(() => expect(readerState().accountState).toBe("APPLICANT"));
    served.accountState = "MEMBER";
    fireEvent.click(screen.getByTestId("later-open"));
    await waitFor(() => expect(readerState().accountState).toBe("MEMBER"));
    // The locked button gives way to the link (re-read: the element changes).
    await waitFor(() =>
      expect(screen.getByTestId(byNode("profile.identity.actionRow.invites"))).toHaveAttribute("href", "/invites"),
    );
  });

  it("switches the tab and reads the one it lands on", async () => {
    const reads: string[] = [];
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      gqlLink.query("ProfilePosts", () => {
        reads.push("posts");
        return HttpResponse.json({ data: { user: null } });
      }),
      gqlLink.query("ProfileComments", () => {
        reads.push("comments");
        return HttpResponse.json({ data: { user: null } });
      }),
      gqlLink.query("ProfileChronicle", ({ variables }) => {
        // The chronicle reads every family: no tab narrows it.
        expect(variables).not.toHaveProperty("family");
        reads.push("everything");
        return HttpResponse.json(chroniclePage([]));
      }),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId(byNode("profile.identity.name"));
    // Every visitor lands on Posts and reads it alone (ProfilePosts.md:5).
    await waitFor(() => expect(reads).toEqual(["posts"]));
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.commentsTab")));
    await waitFor(() => expect(reads).toEqual(["posts", "comments"]));
    fireEvent.click(screen.getByTestId(byNode("profile.tabRow.everythingTab")));
    await waitFor(() => expect(reads).toEqual(["posts", "comments", "everything"]));
  });

  // THE PAGE THAT DID NOT ARRIVE (Profile.md:35): the quiet line and Retry
  // where the page would have stood — never the error colour, never Show more.
  it("says a chronicle page did not arrive, quietly, with Retry", async () => {
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      gqlLink.query("ProfileChronicle", () => HttpResponse.error()),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    const line = await screen.findByTestId("profile-rows-failed");
    expect(line).toHaveTextContent("Couldn't load more");
    expect(line.className).not.toContain("text-error");
    expect(screen.queryByTestId("profile-rows-more")).not.toBeInTheDocument();
    server.use(recordsHandler([{ id: "act:a:1:publish", family: "PUBLISH", postId: "p1" }]));
    fireEvent.click(screen.getByTestId("profile-rows-retry"));
    expect(await screen.findByTestId(byNode("profile.chronicle.act", "1"))).toBeInTheDocument();
  });

  it("offers a retry on the nothing-loaded transport fault", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.error()));
    renderWithProviders(<ProfileScreen handle="ada" />);
    expect(await screen.findByTestId("profile-transport-error")).toBeInTheDocument();
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    fireEvent.click(screen.getByTestId("profile-retry"));
    expect(await screen.findByTestId(byNode("profile.identity.name"))).toBeInTheDocument();
  });

  // The profile is one of the named surfaces (design/readme.md, "The
  // pull-down lives on every full-screen scrolling root", ruled
  // 2026-09-10) — the feed's own twin test (feed-view.test.tsx,
  // "pulling down at the top").
  describe("pulling down at the top", () => {
    function touch(type: string, clientY: number): Event {
      const event = new Event(type, { bubbles: true });
      const points = [{ clientY }];
      Object.defineProperty(event, "touches", { value: points });
      Object.defineProperty(event, "changedTouches", { value: points });
      return event;
    }

    function pull(scroller: HTMLElement, travel = PULL_THRESHOLD) {
      fireEvent(scroller, touch("touchstart", 100));
      fireEvent(scroller, touch("touchmove", 100 + travel));
      fireEvent(scroller, touch("touchend", 100 + travel));
    }

    function profileIn() {
      const scroller = document.createElement("div");
      document.body.append(scroller);
      renderWithProviders(
        <ScrollHostProvider value={{ current: scroller }}>
          <ProfileScreen handle="ada" />
        </ScrollHostProvider>,
      );
      return scroller;
    }

    it("asks the server again without blanking the profile already on screen", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("UserProfile", () => {
          reads += 1;
          return HttpResponse.json({ data: { user: profile("u2", "ada") } });
        }),
        recordsHandler([]),
      );
      const scroller = profileIn();
      await screen.findByTestId(byNode("profile.identity.name"));
      expect(reads).toBe(1);

      pull(scroller);
      await waitFor(() => expect(reads).toBe(2));
      // The already-drawn profile stays — the pull is an indicator, not
      // a blank page (PostDetailViewModel's shared rule, HT-10).
      expect(screen.getByTestId(byNode("profile.identity.name"))).toBeInTheDocument();
      scroller.remove();
    });

    it("takes a short tug for what it is — a scroll, not an ask", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("UserProfile", () => {
          reads += 1;
          return HttpResponse.json({ data: { user: profile("u2", "ada") } });
        }),
        recordsHandler([]),
      );
      const scroller = profileIn();
      await screen.findByTestId(byNode("profile.identity.name"));

      pull(scroller, PULL_THRESHOLD - 1);
      await waitFor(() => expect(reads).toBe(1));
      scroller.remove();
    });

    it("ignores a pull that starts anywhere but the top", async () => {
      let reads = 0;
      server.use(
        gqlLink.query("UserProfile", () => {
          reads += 1;
          return HttpResponse.json({ data: { user: profile("u2", "ada") } });
        }),
        recordsHandler([]),
      );
      const scroller = profileIn();
      await screen.findByTestId(byNode("profile.identity.name"));

      scroller.scrollTop = 900;
      pull(scroller);
      await waitFor(() => expect(reads).toBe(1));
      scroller.remove();
    });
  });
});

// THE VOUCH-BACK STAYS OPEN FROM THE VOUCHER'S PROFILE (VouchBack.md:51):
// the anchor's tap opens the vouch-back pad (ProfileOther.md:35), and any
// signing taken on that person — Set or the hold — opens the ceremony (:37).
describe("ProfileScreen — the voucher's profile", () => {
  function voucherMe(hasReciprocated = false) {
    return gqlLink.query("Me", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "u1",
            handle: "noa",
            displayName: { __typename: "ModeratedText", value: null },
            accountState: "MEMBER",
            hasReciprocated,
            vouchBackDismissed: true,
            invitedBy: {
              __typename: "User",
              id: "u2",
              handle: "mira",
              displayName: { __typename: "ModeratedText", value: "Mira Voss" },
              avatar: null,
            },
          },
        },
      }),
    );
  }

  function serveVoucher(hasReciprocated = false) {
    server.use(
      voucherMe(hasReciprocated),
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "mira") } }),
      ),
      recordsHandler([]),
    );
  }

  beforeEach(() => push.mockClear());

  // ProfileOther.md:35 — the card put away or not (this account put it away).
  it("tapping the voucher's anchor opens the vouch-back pad", async () => {
    serveVoucher();
    renderWithProviders(<ProfileScreen handle="mira" />, {
      store: signedInStore(),
      stanceData: createStubStanceData(),
    });
    fireEvent.click(await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor")));
    expect(await screen.findByTestId("profile-stance-pad")).toHaveAttribute(
      "aria-label",
      "Your vouch back",
    );
    expect(screen.getByTestId("profile-stance-note")).toHaveTextContent(
      "Your vouch back. The pad is how you shape what reaches you — for or against, and how much.",
    );
  });

  it("an opinion on the voucher from the profile opens the ceremony", async () => {
    // By Set on the pad.
    serveVoucher();
    const data = createStubStanceData();
    const { unmount } = renderWithProviders(<ProfileScreen handle="mira" />, {
      store: signedInStore(),
      stanceData: data,
    });
    fireEvent.click(await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor")));
    fireEvent.click(await screen.findByTestId("profile-stance-set"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/vouched-in"));
    expect(data.sent[0]?.target).toBe("u2");
    unmount();

    // By the hold, which signs without opening anything.
    push.mockClear();
    serveVoucher();
    const held = createStubStanceData();
    renderWithProviders(<ProfileScreen handle="mira" />, {
      store: signedInStore(),
      stanceData: held,
    });
    const anchor = await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor"));
    await waitFor(() => expect(anchor).not.toHaveAttribute("aria-busy", "true"));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.pointerDown(anchor, { pointerId: 1 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(push).toHaveBeenCalledWith("/vouched-in"));
    expect(held.sent[0]).toEqual({ target: "u2", pick: { pDirected: 0.1, pInterest: 0.1 } });
    expect(screen.queryByTestId("profile-stance-pad")).not.toBeInTheDocument();
  });

  // ruling 42, VouchBackPad.md:47 — back onto the profile, nothing staged.
  it("cancel on a profile-origin vouch-back pad closes onto the profile", async () => {
    serveVoucher();
    const data = createStubStanceData();
    renderWithProviders(<ProfileScreen handle="mira" />, {
      store: signedInStore(),
      stanceData: data,
    });
    fireEvent.click(await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor")));
    fireEvent.click(await screen.findByTestId("profile-stance-cancel"));
    expect(screen.queryByTestId("profile-stance-pad")).not.toBeInTheDocument();
    expect(screen.getByTestId(byNode("profile.identity.name"))).toBeInTheDocument();
    expect(data.sent).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  // With the pair complete, the voucher's anchor is an ordinary one.
  it("keeps the plain pad once the pair is complete", async () => {
    serveVoucher(true);
    renderWithProviders(<ProfileScreen handle="mira" />, {
      store: signedInStore(),
      stanceData: createStubStanceData(),
    });
    fireEvent.click(await screen.findByTestId(byNode("profile.identity.actionRow.stance.anchor")));
    expect(await screen.findByTestId("profile-stance-pad")).toHaveAttribute(
      "aria-label",
      "Opinion pad for @mira",
    );
  });
});

// A POST OR A COMMENT STILL SETTLING ON THE EVERYTHING TAB (Profile.md:31,
// ProfileOther.md:27; `_shared.jsx` `ChronicleAct`'s `settling`): on every
// profile, the act's card — its disc, verb and snippet — its age read off its
// signing and `Still settling` under it (`ContentRow` `pending`), in the
// order `User.chronicle` pages it: the settling entries lead, then the landed
// acts. Every other act stands only once landed, as its record.
describe("the chronicle's still-settling posts and comments", () => {
  const REGISTRY = JSON.parse(
    readFileSync(join(process.cwd(), "..", "design", "designs", "canonical", "nodes.json"), "utf8"),
  ) as { screens: Record<string, { nodes: Record<string, string[]> }> };

  /** A landed post's genesis record, as the chronicle serves it. */
  function landedPublish(id: string, postId: string) {
    return {
      __typename: "Record",
      id,
      family: "PUBLISH",
      act: "GENESIS",
      targetId: `mint:${id}`,
      terminalId: null,
      topic: null,
      landedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      pDirected: 0,
      pInterest: 0,
      severed: null,
      target: {
        __typename: "Post",
        id: postId,
        title: { __typename: "ModeratedText", value: "Hello world" },
        content: { __typename: "ModeratedText", value: "Body" },
        removal: null,
      },
      terminal: null,
    };
  }

  type Read = { id: string; after: string | null };
  /** The chronicle's pages by the cursor each answers (`""` the first), and the reads asked. */
  function serveChronicle(pages: Record<string, { nodes: unknown[]; next: string | null }>): Read[] {
    const reads: Read[] = [];
    server.use(
      gqlLink.query("ProfileChronicle", ({ variables }) => {
        const read = { id: variables.id as string, after: (variables.after as string | null | undefined) ?? null };
        reads.push(read);
        const page = pages[read.after ?? ""];
        return HttpResponse.json(
          chroniclePage(page.nodes, { userId: read.id, hasNextPage: page.next !== null, endCursor: page.next }),
        );
      }),
    );
    return reads;
  }

  const THREE = [
    settlingPostEntry({ id: "p9", title: "The long way home" }),
    settlingCommentEntry({ id: "c9", postId: "p1", content: "The third headland light is real" }),
    landedPublish("act:a:1:publish", "p1"),
  ];

  const row = (n: number) => screen.getByTestId(byNode("profile.chronicle.act", String(n)));
  const rowIds = () =>
    screen
      .getAllByTestId(/^chronicle-row-.*-open$/)
      .map((element) => element.getAttribute("data-testid")?.replace(/-open$/, ""));

  it("draws another's settling post and comment as their acts, Still settling under the age, ahead of the landed acts, for a guest", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    const reads = serveChronicle({ "": { nodes: THREE, next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    await screen.findByTestId(byNode("profile.chronicle.act", "3"));
    expect(reads).toEqual([{ id: "u2", after: null }]);
    // The settling post: the publish's verb, its title, its age `now`, the marker.
    expect(screen.getByTestId(byNode("profile.chronicle.act.title", "1"))).toHaveTextContent("Published a post");
    expect(screen.getByTestId(byNode("profile.chronicle.act.second", "1"))).toHaveTextContent("The long way home");
    expect(screen.getByTestId(byNode("profile.chronicle.act.trailing", "1"))).toHaveTextContent("now");
    expect(screen.getByTestId(byNode("profile.chronicle.act.pending", "1"))).toHaveTextContent("Still settling");
    // Its door is its card's on the Posts tab: the post itself.
    expect(row(1).querySelector("a")).toHaveAttribute("href", "/posts/p9?from=u%3Aada");
    // The settling comment: the comment's verb, its words, the marker, and the
    // thread landed on it, the Comments tab card's door.
    expect(screen.getByTestId(byNode("profile.chronicle.act.title", "2"))).toHaveTextContent("Commented");
    expect(screen.getByTestId(byNode("profile.chronicle.act.second", "2"))).toHaveTextContent(
      "The third headland light is real",
    );
    expect(screen.getByTestId(byNode("profile.chronicle.act.pending", "2"))).toHaveTextContent("Still settling");
    expect(row(2).querySelector("a")).toHaveAttribute("href", "/posts/p1?comment=c9&from=u%3Aada");
    // The landed act after them, drawn as ever: no marker, its landing's age.
    expect(screen.getByTestId(byNode("profile.chronicle.act.title", "3"))).toHaveTextContent("Published a post");
    expect(screen.getByTestId(byNode("profile.chronicle.act.trailing", "3"))).toHaveTextContent("3d");
    expect(screen.queryByTestId(byNode("profile.chronicle.act.pending", "3"))).not.toBeInTheDocument();
    expect(row(3).querySelector("a")).toHaveAttribute("href", "/posts/p1?from=u%3Aada");
    // The marker is the honesty register, never the error colour.
    expect(screen.getByTestId(byNode("profile.chronicle.act.pending", "1")).className).not.toContain("text-error");
  });

  // A removed comment keeps its card, its verb, its age and its door, the
  // second line `Removed by its author` where its words were — never the
  // parent post's title (Profile.md:39, ProfileOther.md:39; `_shared.jsx`
  // `ChronicleAct`: the plain second line, no other ink).
  it("draws a removed comment's act as Removed by its author, never its post's title", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    const parent = landedPublish("act:a:1:publish", "p1").target;
    serveChronicle({
      "": {
        nodes: [
          {
            ...landedPublish("act:a:2:review", "p1"),
            family: "REVIEW",
            terminal: {
              __typename: "Comment",
              id: "c1",
              content: { __typename: "ModeratedText", value: null },
              removal: { __typename: "Removal", at: "2026-11-20T10:00:00Z", by: "AUTHOR" },
              target: { __typename: "Post", id: "p1" },
            },
            target: parent,
          },
          landedPublish("act:a:1:publish", "p1"),
        ],
        next: null,
      },
    });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    await screen.findByTestId(byNode("profile.chronicle.act", "2"));
    expect(screen.getByTestId(byNode("profile.chronicle.act.title", "1"))).toHaveTextContent("Commented");
    const second = screen.getByTestId(byNode("profile.chronicle.act.second", "1"));
    expect(second).toHaveTextContent("Removed by its author");
    expect(second).not.toHaveTextContent("Hello world");
    expect(row(1).querySelector("a")).toHaveAttribute("href", "/posts/p1?from=u%3Aada");
    // The live act beside it reads its own words, as ever.
    expect(screen.getByTestId(byNode("profile.chronicle.act.second", "2"))).toHaveTextContent("Hello world");
  });

  it("draws them on another's profile for a signed-in reader too", async () => {
    server.use(meHandler(), gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    serveChronicle({ "": { nodes: THREE, next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
    await openEverything();
    expect(await screen.findByTestId(byNode("profile.chronicle.act.pending", "1"))).toHaveTextContent("Still settling");
    expect(screen.getByTestId(byNode("profile.chronicle.act.pending", "2"))).toHaveTextContent("Still settling");
  });

  it("draws the reader's own settling post and comment on their own chronicle, the doors naming their profile", async () => {
    server.use(meHandler(), gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })));
    const reads = serveChronicle({ "": { nodes: THREE, next: null } });
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    await openEverything();
    expect(await screen.findByTestId(byNode("profile.chronicle.act.pending", "1"))).toHaveTextContent("Still settling");
    expect(reads).toEqual([{ id: "u1", after: null }]);
    expect(row(1).querySelector("a")).toHaveAttribute("href", "/posts/p9?from=profile");
    expect(row(2).querySelector("a")).toHaveAttribute("href", "/posts/p1?comment=c9&from=profile");
  });

  it("wears every part the Profile and ProfileOther boards register for a settling act, keyed by its position", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    serveChronicle({ "": { nodes: [THREE[0]], next: null } });
    renderWithProviders(<ProfileScreen handle="ada" />);
    await openEverything();
    await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    for (const board of ["Profile", "ProfileOther"]) {
      const nodes = REGISTRY.screens[board].nodes;
      expect(nodes["profile.chronicle.act.pending"]).toEqual(["1"]);
      for (const path of [
        "profile.chronicle.act",
        "profile.chronicle.act.disc",
        "profile.chronicle.act.title",
        "profile.chronicle.act.second",
        "profile.chronicle.act.trailing",
        "profile.chronicle.act.pending",
      ]) {
        expect(nodes[path], `${board} registers ${path}`).toContain("1");
        expect(screen.getByTestId(byNode(path, "1"))).toBeInTheDocument();
      }
    }
  });

  it("pages across the settling / landed boundary with the server's cursors, in the order served", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    const reads = serveChronicle({
      "": { nodes: [settlingPostEntry({ id: "p9" }), settlingCommentEntry({ id: "c9", postId: "p1" })], next: "c1" },
      c1: { nodes: [landedPublish("act:a:1:publish", "p1")], next: null },
    });
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await openEverything();
    await screen.findByTestId(byNode("profile.chronicle.act", "2"));
    const { intersect } = await import("@/test/media-env");
    act(() => intersect(true));
    await screen.findByTestId(byNode("profile.chronicle.act", "3"));
    expect(reads).toEqual([
      { id: "u2", after: null },
      { id: "u2", after: "c1" },
    ]);
    expect(rowIds()).toEqual(["chronicle-row-act:p9", "chronicle-row-act:c9", "chronicle-row-act:a:1:publish"]);
    expect(screen.queryByTestId(byNode("profile.chronicle.act.pending", "3"))).not.toBeInTheDocument();
    scroller.remove();
  });

  it("shows an entry that lands between two reads once: the next page's record is the held row, and a re-read draws it landed", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    // Page one serves the post still settling; it lands before page two, whose
    // walk serves its minting record (`act:p9`, the post's `genesisRecordId`).
    serveChronicle({
      "": { nodes: [settlingPostEntry({ id: "p9" })], next: "c1" },
      c1: { nodes: [landedPublish("act:p9", "p9"), landedPublish("act:a:1:publish", "p1")], next: null },
    });
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <ProfileScreen handle="ada" />
      </ScrollHostProvider>,
    );
    await openEverything();
    await screen.findByTestId(byNode("profile.chronicle.act.pending", "1"));
    const { intersect, pullsAtTop } = await import("@/test/media-env");
    act(() => intersect(true));
    await screen.findByTestId(byNode("profile.chronicle.act", "2"));
    // One row for the post: the held page stands, the repeat is dropped.
    expect(rowIds()).toEqual(["chronicle-row-act:p9", "chronicle-row-act:a:1:publish"]);
    // A re-read replaces the list: the post stands once, as its record, unmarked.
    serveChronicle({
      "": { nodes: [landedPublish("act:p9", "p9"), landedPublish("act:a:1:publish", "p1")], next: null },
    });
    pullsAtTop(scroller, PULL_THRESHOLD);
    await waitFor(() =>
      expect(screen.queryByTestId(byNode("profile.chronicle.act.pending", "1"))).not.toBeInTheDocument(),
    );
    expect(rowIds()).toEqual(["chronicle-row-act:p9", "chronicle-row-act:a:1:publish"]);
    expect(screen.getByTestId(byNode("profile.chronicle.act.trailing", "1"))).toHaveTextContent("3d");
    scroller.remove();
  });

  it("restores the held Everything view with its settling rows on the way back", async () => {
    server.use(gqlLink.query("UserProfile", () => HttpResponse.json({ data: { user: profile("u2", "ada") } })));
    const reads = serveChronicle({ "": { nodes: THREE, next: null } });
    const left = renderWithProviders(<ProfileScreen handle="ada" from="feed" />);
    await openEverything();
    const first = await screen.findByTestId(byNode("profile.chronicle.act", "1"));
    fireEvent.click(first.querySelector("a")!);
    left.unmount();
    renderWithProviders(<ProfileScreen handle="ada" from="feed" />);
    expect(screen.getByTestId(byNode("profile.chronicle.act.pending", "1"))).toHaveTextContent("Still settling");
    expect(screen.getByTestId(byNode("profile.chronicle.act.pending", "2"))).toHaveTextContent("Still settling");
    expect(screen.queryByTestId(byNode("profile.chronicle.act.pending", "3"))).not.toBeInTheDocument();
    await screen.findByTestId(byNode("profile.identity.name"));
    expect(reads).toHaveLength(1);
  });
});
