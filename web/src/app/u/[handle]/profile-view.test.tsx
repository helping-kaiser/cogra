import { InMemoryCache } from "@apollo/client";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSeenQueueForTests } from "@/lib/history/seen-queue";
import { createTokenStore } from "@/lib/session/token-store";
import { createStubStanceData } from "@/lib/stance/stub-stance-data";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { bookmarkHandlers, bookmarkLog } from "@/test/saved";
import { stanceBundle, stanceHandlers } from "@/test/stance";
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
  rows: { id: string; family: string; targetId?: string; postId?: string }[],
) {
  return gqlLink.query("AuthorRecords", () =>
    HttpResponse.json({
      data: {
        records: {
          __typename: "RecordConnection",
          edges: rows.map((row) => ({
            __typename: "RecordEdge",
            node: {
              __typename: "Record",
              id: row.id,
              family: row.family,
              targetId: row.targetId ?? `mint:${row.id}`,
              terminalId: null,
              target: row.postId
                ? {
                    __typename: "Post",
                    id: row.postId,
                    title: { __typename: "ModeratedText", value: "Hello world" },
                    content: { __typename: "ModeratedText", value: "Body" },
                  }
                : null,
              terminal: null,
            },
          })),
          pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
        },
      },
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetSeenQueueForTests();
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
    expect(await screen.findByTestId("profile-display-name")).toHaveTextContent("Ada L");
    expect(screen.getByTestId("profile-handle")).toHaveTextContent("@ada");
    expect(screen.getByTestId("profile-bio")).toHaveTextContent("Curious.");
    expect(screen.getByTestId("profile-website")).toHaveAttribute("href", "https://ada.example");
    // Another actor's profile carries no own affordances.
    expect(screen.queryByTestId("profile-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile-settings")).not.toBeInTheDocument();
    // The chronicle row labels and links to the touched post.
    const row = await screen.findByTestId("chronicle-row");
    expect(row).toHaveTextContent("Published a post");
    expect(row).toHaveTextContent("Hello world");
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
    expect(await screen.findByTestId("profile-stance")).toBeInTheDocument();
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
      expect(screen.getByTestId("profile-stance")).toHaveTextContent("Really into this"),
    );
    expect(screen.getByTestId("profile-stance-resting-exact")).toHaveTextContent("+0.60 / +0.65");
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
      expect(screen.getByTestId("profile-stance-resting-exact")).toHaveTextContent(
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
    expect(await screen.findByTestId("profile-edit")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-stance")).not.toBeInTheDocument();
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
    await screen.findByTestId("chronicle-row");
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
    await screen.findByTestId("profile-display-name");
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
    await screen.findByTestId("profile-edit");
    tab.unmount();
    renderWithProviders(<ProfileScreen handle="ada" />, { store: signedInStore() });
    await screen.findByTestId("profile-edit");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(marked).toEqual([]);
  });

  // THE PROFILE'S ⋮ (ProfileOwnMenu.md, ProfileMenu.md, ProfileDeletedMenu.md;
  // saved-surface SS-1): three sheets, built whole; History and Mention stand
  // inert until their packets wire them.
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
        "@ada is hidden — their posts stay out of your feed.",
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
        "This account is hidden — its posts stay out of your feed.",
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

    it("opened_from_saved_the_back_arrow_reads_back_to_saved", async () => {
      server.use(other(), recordsHandler([]));
      renderWithProviders(<ProfileScreen handle="ada" from="saved" />);
      const back = await screen.findByTestId("profile-back");
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
    expect(await screen.findByTestId("profile-edit")).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByTestId("profile-settings")).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId("profile-invites")).toHaveAttribute("href", "/invites");
    expect(screen.getByTestId("profile-chronicle-empty")).toBeInTheDocument();
  });

  // A signed profile edit is served from its signature on, pending until it
  // lands (substrate.md §6), and a handle change is immediate — so returning
  // to the profile from the editor or from settings shows the change on the
  // arrival's own read. That holds only because the arrival asks the server
  // rather than the cache the previous visit filled; the shared cache here is
  // that previous visit.
  it("a return to the own profile reads the server, not the last visit's cache", async () => {
    const cache = new InMemoryCache();
    let served = profile("u1", "ada", "Before the edit.");
    server.use(
      meHandler(),
      gqlLink.query("MyProfile", () => HttpResponse.json({ data: { me: served } })),
      recordsHandler([]),
    );
    const store = signedInStore();
    const first = renderWithProviders(<ProfileScreen handle={null} />, { store, cache });
    expect(await screen.findByTestId("profile-bio")).toHaveTextContent("Before the edit.");
    first.unmount();

    served = profile("u1", "ada_renamed", "Signed, not landed.");
    renderWithProviders(<ProfileScreen handle={null} />, { store, cache });
    expect(await screen.findByTestId("profile-bio")).toHaveTextContent("Signed, not landed.");
    expect(screen.getByTestId("profile-handle")).toHaveTextContent("@ada_renamed");
  });

  it("locks the invites entry for an applicant and explains on tap", async () => {
    server.use(
      meHandler("APPLICANT"),
      gqlLink.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    const invites = await screen.findByTestId("profile-invites");
    // Visible but locked (auth.md "Application"): a button, not a link.
    expect(invites).not.toHaveAttribute("href");
    fireEvent.click(invites);
    expect(screen.getByTestId("profile-invites-locked")).toBeInTheDocument();
  });

  it("switches the chronicle filter and refetches", async () => {
    const families: (string | null)[] = [];
    server.use(
      gqlLink.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      gqlLink.query("AuthorRecords", ({ variables }) => {
        families.push((variables as { family: string | null }).family);
        return HttpResponse.json({
          data: {
            records: {
              __typename: "RecordConnection",
              edges: [],
              pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
            },
          },
        });
      }),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId("profile-display-name");
    // Every visitor lands on Posts (decision 2026-08-18).
    await waitFor(() => expect(families).toEqual(["PUBLISH"]));
    fireEvent.click(screen.getByTestId("profile-filter-everything"));
    await waitFor(() => expect(families).toEqual(["PUBLISH", null]));
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
    expect(await screen.findByTestId("profile-display-name")).toBeInTheDocument();
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
      await screen.findByTestId("profile-display-name");
      expect(reads).toBe(1);

      pull(scroller);
      await waitFor(() => expect(reads).toBe(2));
      // The already-drawn profile stays — the pull is an indicator, not
      // a blank page (PostDetailViewModel's shared rule, HT-10).
      expect(screen.getByTestId("profile-display-name")).toBeInTheDocument();
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
      await screen.findByTestId("profile-display-name");

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
      await screen.findByTestId("profile-display-name");

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
    fireEvent.click(await screen.findByTestId("profile-stance"));
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
    fireEvent.click(await screen.findByTestId("profile-stance"));
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
    const anchor = await screen.findByTestId("profile-stance");
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
    fireEvent.click(await screen.findByTestId("profile-stance"));
    fireEvent.click(await screen.findByTestId("profile-stance-cancel"));
    expect(screen.queryByTestId("profile-stance-pad")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-display-name")).toBeInTheDocument();
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
    fireEvent.click(await screen.findByTestId("profile-stance"));
    expect(await screen.findByTestId("profile-stance-pad")).toHaveAttribute(
      "aria-label",
      "Stance pad for @mira",
    );
  });
});
