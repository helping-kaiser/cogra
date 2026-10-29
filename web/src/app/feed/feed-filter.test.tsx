// THE FEED FILTER, view-level: the band's trigger and the sheet it opens,
// compiled line for line from the sidecars — FeedSheet.md, FeedNarrowed.md,
// FeedTopic.md, FeedFar.md, FeedNothing.md, FeedKinds.md — plus the Removed
// and Sensitive cuts (CD-4) and the remembered pages' re-derive. Reads only:
// every read is MSW's, and nothing here is a mutation.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { byNode } from "@/test/data-node";
import { FEED_FILTER_DEFAULT } from "@/lib/feed/feed-filter";
import { writeReaderDefault } from "@/lib/feed/reader-default";
import { FeedView, SHOWING_NOTHING, SHOW_POSTS_AGAIN } from "./feed-view";
import { forgetFeed } from "./feed-memory";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(),
}));

/** Whose view the feed borrows: none by default here, so the reader's own words stand. */
function borrowedView(handle: string | null) {
  return gqlLink.query("BorrowedView", () =>
    HttpResponse.json({
      data: {
        borrowedView:
          handle === null
            ? null
            : {
                __typename: "User",
                id: `${handle}-id`,
                handle,
                displayName: { __typename: "ModeratedText", value: null },
                avatar: null,
              },
      },
    }),
  );
}

// The reader is signed in and reads their own view (no borrowed vantage), so the
// sheet speaks in their own words; the borrowed-view test overrides it.
const server = startMswServer(...stanceHandlers(), borrowedView(null), meHandler(), heldTopics());

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

type Node = { id: string; __typename: string } & Record<string, unknown>;

function post(id: string, change: Record<string, unknown> = {}): Node {
  return {
    __typename: "Post",
    id,
    comments: { __typename: "CommentConnection", totalCount: 0 },
    title: moderated(`Title ${id}`),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: {
      __typename: "User",
      id: "u1",
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
      avatar: null,
    },
    createdAt: "2026-10-27T10:00:00Z",
    updatedAt: "2026-10-27T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    removal: null,
    genesisRecordId: `rec-${id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    ...change,
  };
}

const REMOVED = { removal: { __typename: "Removal", at: "2026-10-27T11:00:00Z", by: "AUTHOR" } };
const SENSITIVE = { moderationStatus: "SENSITIVE" };

function comment(id: string): Node {
  return {
    __typename: "Comment",
    id,
    content: moderated("The third headland light is real"),
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: { __typename: "User", id: "u2", handle: "tobias", displayName: moderated("Tobias"), avatar: null },
    createdAt: "2026-10-27T10:00:00Z",
    updatedAt: "2026-10-27T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    removal: null,
    genesisRecordId: `rec-${id}`,
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    viewerBookmarkedAt: null,
    target: {
      __typename: "Post",
      id: "p1",
      title: moderated("The long way home"),
      content: moderated("words"),
      attachments: [],
      author: { __typename: "User", id: "u1", handle: "ada" },
      moderationStatus: "NORMAL",
      removal: null,
    },
    post: { __typename: "Post", id: "p1" },
  };
}

function person(id: string, handle: string): Node {
  return {
    __typename: "User",
    id,
    handle,
    displayName: moderated("Mira Voss"),
    bio: moderated("Runs the stand by the sea wall."),
    avatar: null,
    viewerBookmarkedAt: null,
  };
}

function tag(id: string, name: string): Node {
  return { __typename: "Hashtag", id, name: moderated(name), taggedContent: [] };
}

const KIND: Record<string, string> = { Post: "POST", Comment: "COMMENT", User: "USER", Hashtag: "HASHTAG" };

type Reads = { ranks: { kinds: unknown; topic: unknown }[]; windows: string[][] };

/**
 * The ranked feed's reads over `nodes` (or a function of the kinds asked, for
 * a feed whose answer follows them): the ranking, the post window (`Feed`)
 * and the other kinds' window (`FeedCards`).
 */
function rankedFeed(nodes: readonly Node[] | ((kinds: string[]) => readonly Node[]), reads: Reads) {
  let current: readonly Node[] = [];
  const windowOf = (ids: string[]) => ({
    feed: {
      __typename: "FeedConnection",
      edges: ids
        .map((id) => current.find((node) => node.id === id))
        .filter((node) => node !== undefined)
        .map((node) => ({ __typename: "FeedEdge", node })),
    },
  });
  return [
    gqlLink.query("FeedRanking", ({ variables }) => {
      const kinds = (variables.kinds as string[] | null) ?? ["POST"];
      reads.ranks.push({ kinds: variables.kinds, topic: variables.topic });
      current = typeof nodes === "function" ? nodes(kinds) : nodes.filter((node) => kinds.includes(KIND[node.__typename]!));
      return HttpResponse.json({
        data: {
          feedRanking: {
            __typename: "FeedRanking",
            asOfEpoch: 4,
            entries: current.map((node, index) => ({
              __typename: "FeedEntry",
              targetId: node.id,
              kind: KIND[node.__typename],
              score: 1 - index / 100,
              mark: node.mark ?? null,
              newestIndex: current.length - 1 - index,
            })),
            settling: [],
          },
        },
      });
    }),
    gqlLink.query("Feed", ({ variables }) => {
      reads.windows.push(variables.orderedIds as string[]);
      return HttpResponse.json({ data: windowOf(variables.orderedIds as string[]) });
    }),
    gqlLink.query("FeedCards", ({ variables }) => {
      reads.windows.push(variables.orderedIds as string[]);
      return HttpResponse.json({ data: windowOf(variables.orderedIds as string[]) });
    }),
  ];
}

function reads(): Reads {
  return { ranks: [], windows: [] };
}

function meHandler() {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState: "MEMBER",
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

/** The reader's held topics: saltmaps and tidepools held for, harbour held against. */
function heldTopics() {
  const edge = (id: string, name: string, pDirected: number) => ({
    __typename: "HeldTopicEdge",
    cursor: id,
    pDirected,
    pInterest: 0.2,
    pending: false,
    node: { __typename: "Hashtag", id, name: moderated(name) },
  });
  return gqlLink.query("HeldTopics", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "acct-1",
          heldTopics: {
            __typename: "HeldTopicConnection",
            totalCount: 3,
            edges: [edge("t-salt", "saltmaps", 0.6), edge("t-tide", "tidepools", 0.3), edge("t-harb", "harbour", -0.4)],
            pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
          },
        },
      },
    }),
  );
}

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/** The feed, for the signed-in reader acct-1. */
function renderFeed() {
  return renderWithProviders(<FeedView />, { store: signedInStore() });
}

const trigger = () => screen.getByTestId(byNode("feed.band.filterTrigger"));
const sheet = () => screen.getByTestId(byNode("feed.filterSheet")) as HTMLDialogElement;
const status = () => screen.getByTestId("feed-filter-status");

async function openSheet() {
  fireEvent.click(await screen.findByTestId(byNode("feed.band.filterTrigger")));
  await waitFor(() => expect(sheet().open).toBe(true));
  return sheet();
}

function chip(path: string) {
  return within(sheet()).getByTestId(byNode(`feed.filterSheet.${path}`));
}

function done() {
  fireEvent.click(within(sheet()).getByTestId(byNode("feed.filterSheet.foot.done")));
}

function cardIds(): string[] {
  return screen
    .getAllByTestId((id) => ["feed.card", "feed.commentCard", "feed.profileCard", "feed.tagCard"].includes(id))
    .map((card) => card.getAttribute("data-testid-key") ?? "");
}

describe("the feed filter", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetFeed();
    replace.mockClear();
    push.mockClear();
  });

  describe("the trigger (FeedNarrowed.md, FeedSheet.md)", () => {
    it("stands on the band and reads Posts at the default, with no glyph", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      const pill = await screen.findByTestId(byNode("feed.band.filterTrigger"));
      expect(pill).toHaveTextContent(/^Posts$/);
      expect(screen.getByTestId(byNode("feed.band")).contains(pill)).toBe(true);
      expect(pill.querySelector("svg")).toBeNull();
      expect(pill).toHaveAttribute("aria-expanded", "false");
    });

    it("is named by its reading followed by what your feed shows", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      expect(await screen.findByTestId(byNode("feed.band.filterTrigger"))).toHaveAccessibleName(
        "Posts, what your feed shows",
      );
    });
  });

  describe("the sheet (FeedSheet.md)", () => {
    it("opens over the feed, holding the four kinds V1.0 serves, Posts the one on", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      await openSheet();
      expect(trigger()).toHaveAttribute("aria-expanded", "true");
      const kinds = ["postsChip", "commentsChip", "profilesChip", "topicsChip"].map((id) => chip(`kinds.${id}`));
      expect(kinds.map((kind) => kind.textContent)).toEqual(["Posts", "Comments", "Profiles", "Tags"]);
      expect(kinds.map((kind) => kind.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false"]);
    });

    it("stands at its default: Ranked, Everyone, seen off, Still settling on, Sensitive and Removed off", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      await openSheet();
      expect(within(sheet()).getByRole("button", { name: "Ranked" })).toHaveAttribute("aria-pressed", "true");
      expect(within(sheet()).getByRole("radio", { name: /^Everyone/ })).toBeChecked();
      expect(within(sheet()).getByRole("checkbox", { name: "Show what you've already seen" })).not.toBeChecked();
      expect(chip("also.settlingChip")).toHaveAttribute("aria-checked", "true");
      expect(chip("also.sensitiveChip")).toHaveAttribute("aria-checked", "false");
      expect(chip("also.removedChip")).toHaveAttribute("aria-checked", "false");
      // No sign row under Everyone (FeedSheet.md:21).
      expect(within(sheet()).queryByRole("radiogroup", { name: "Which of your people" })).toBeNull();
    });

    it("stages every tap and never moves the feed behind it before Done", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1"), post("p2")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(chip("kinds.commentsChip"));
      fireEvent.click(within(sheet()).getByRole("button", { name: "Newest" }));
      fireEvent.click(within(sheet()).getByRole("checkbox", { name: "Show what you've already seen" }));
      fireEvent.click(chip("also.settlingChip"));
      expect(chip("kinds.commentsChip")).toHaveAttribute("aria-checked", "true");
      expect(r.ranks).toHaveLength(1);
      expect(trigger()).toHaveTextContent(/^Posts$/);
      expect(cardIds()).toEqual(["p1", "p2"]);
    });

    it("lets the last kind chip go — it never refuses (FeedSheet.md:75)", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      await openSheet();
      fireEvent.click(chip("kinds.postsChip"));
      expect(chip("kinds.postsChip")).toHaveAttribute("aria-checked", "false");
      expect(chip("kinds.postsChip")).not.toBeDisabled();
    });

    it("raises the sign row under Your people, keeps its word through Everyone (FeedSheet.md:13-27)", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      await openSheet();
      fireEvent.click(within(sheet()).getByRole("radio", { name: /^Your people/ }));
      const signs = within(sheet()).getByRole("radiogroup", { name: "Which of your people" });
      expect(within(signs).getByRole("radio", { name: "Either" })).toBeChecked();
      expect(within(signs).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual([
        "For",
        "Against",
        "Either",
      ]);
      fireEvent.click(within(signs).getByRole("radio", { name: "For" }));
      fireEvent.click(within(sheet()).getByRole("radio", { name: /^Everyone/ }));
      expect(within(sheet()).queryByRole("radiogroup", { name: "Which of your people" })).toBeNull();
      fireEvent.click(within(sheet()).getByRole("radio", { name: /^Your people/ }));
      expect(
        within(within(sheet()).getByRole("radiogroup", { name: "Which of your people" })).getByRole("radio", {
          name: "For",
        }),
      ).toBeChecked();
    });

    it("offers only the topics the reader holds for, one on at a time, last in the sheet (FeedSheet.md:29-35, :53)", async () => {
      server.use(...rankedFeed([post("p1")], reads()), heldTopics(), meHandler());
      renderFeed();
      await openSheet();
      const salt = await within(sheet()).findByTestId(byNode("feed.filterSheet.topic.tag", "saltmaps"));
      const tide = within(sheet()).getByTestId(byNode("feed.filterSheet.topic.tag", "tidepools"));
      expect(within(sheet()).queryByTestId(byNode("feed.filterSheet.topic.tag", "harbour"))).toBeNull();
      expect(salt).toHaveTextContent("#saltmaps");
      fireEvent.click(salt);
      fireEvent.click(tide);
      expect(salt).toHaveAttribute("aria-checked", "false");
      expect(tide).toHaveAttribute("aria-checked", "true");
      fireEvent.click(tide);
      expect(tide).toHaveAttribute("aria-checked", "false");
      expect(salt).toHaveAttribute("aria-checked", "false");
      const groups = within(sheet()).getAllByRole("group");
      expect(groups.at(-1)).toHaveAccessibleName("One topic");
    });

    it("holds Reset in its foot's corner and Done at its end, with no reading of the staged filter", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      await openSheet();
      const foot = within(sheet()).getByTestId(byNode("feed.filterSheet.foot"));
      expect(within(foot).getAllByRole("button").map((button) => button.textContent)).toEqual(["Reset", "Done"]);
      expect(foot).toHaveTextContent(/^ResetDone$/);
    });

    it("Reset stages the reader's default and never re-queries (FeedSheet.md:63)", async () => {
      const r = reads();
      writeReaderDefault("acct-1", { ...FEED_FILTER_DEFAULT, order: "newest" });
      server.use(...rankedFeed([post("p1")], r), heldTopics(), meHandler());
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(within(sheet()).getByRole("button", { name: "Ranked" }));
      fireEvent.click(chip("kinds.commentsChip"));
      fireEvent.click(within(sheet()).getByTestId(byNode("feed.filterSheet.foot.reset")));
      expect(within(sheet()).getByRole("button", { name: "Newest" })).toHaveAttribute("aria-pressed", "true");
      expect(chip("kinds.commentsChip")).toHaveAttribute("aria-checked", "false");
      expect(r.ranks).toHaveLength(1);
    });

    it("says what Reset does in its \"?\" (FeedSheet.md:73-75)", async () => {
      server.use(...rankedFeed([post("p1")], reads()));
      renderFeed();
      await openSheet();
      fireEvent.click(within(sheet()).getByRole("button", { name: "How the filter works" }));
      const help = await screen.findByTestId("feed-filter-help-dialog");
      expect(help).toHaveTextContent("Reset brings back your defaults, to change them go to settings.");
      expect(help).toHaveTextContent(
        "what you've already seen waits below the Already seen line unless you ask for it back",
      );
    });
  });

  describe("Done (FeedSheet.md:81-87)", () => {
    it("with Kinds changed: closes, re-queries once, says the new name, returns focus", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1"), comment("k1")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(chip("kinds.commentsChip"));
      done();
      await waitFor(() => expect(sheet().open).toBe(false));
      await waitFor(() => expect(r.ranks).toHaveLength(2));
      expect(r.ranks[1]!.kinds).toEqual(["POST", "COMMENT"]);
      expect(status()).toHaveTextContent("2 kinds, what your feed shows");
      expect(trigger()).toHaveTextContent(/^2 kinds$/);
      expect(trigger()).toHaveFocus();
      // THE COMMENT CARD COMES ONCE ITS KIND IS SELECTED (FeedKinds.md).
      expect(await screen.findByTestId(byNode("feed.commentCard", "k1"))).toBeInTheDocument();
    });

    it("with only device changes: re-derives on the device and never re-queries", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1"), post("p2")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(within(sheet()).getByRole("button", { name: "Newest" }));
      done();
      await waitFor(() => expect(cardIds()).toEqual(["p2", "p1"]));
      expect(r.ranks).toHaveLength(1);
      expect(status()).toHaveTextContent("Posts · newest, what your feed shows");
      expect(trigger()).toHaveTextContent(/^Posts · newest$/);
    });

    it("with nothing changed: closes, the feed is what it was, nothing is said", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(chip("kinds.commentsChip"));
      fireEvent.click(chip("kinds.commentsChip"));
      done();
      await waitFor(() => expect(sheet().open).toBe(false));
      expect(r.ranks).toHaveLength(1);
      expect(status()).toHaveTextContent(/^$/);
      expect(trigger()).toHaveFocus();
    });

    it("the scrim drops what is staged and never re-queries", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      const dialog = await openSheet();
      fireEvent.click(chip("kinds.commentsChip"));
      fireEvent.click(dialog);
      await waitFor(() => expect(dialog.open).toBe(false));
      expect(r.ranks).toHaveLength(1);
      expect(trigger()).toHaveTextContent(/^Posts$/);
      // Opened again, it stages from the feed as it stands.
      await openSheet();
      expect(chip("kinds.commentsChip")).toHaveAttribute("aria-checked", "false");
    });

    it("Escape drops what is staged", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      const dialog = await openSheet();
      fireEvent.click(within(dialog).getByRole("button", { name: "Newest" }));
      // Escape is the platform's own: a cancel, then the dialog closes itself.
      fireEvent.keyDown(dialog, { key: "Escape" });
      fireEvent(dialog, new Event("cancel"));
      act(() => dialog.close());
      await waitFor(() => expect(dialog.open).toBe(false));
      expect(r.ranks).toHaveLength(1);
      expect(trigger()).toHaveTextContent(/^Posts$/);
    });
  });

  describe("the reader's default (FeedSheet.md:59-69; SettingsReading.md)", () => {
    it("opens every feed with the reader's saved default and speaks only deviations from it", async () => {
      writeReaderDefault("acct-1", { ...FEED_FILTER_DEFAULT, order: "newest" });
      server.use(...rankedFeed([post("p1"), post("p2")], reads()), meHandler());
      renderFeed();
      await waitFor(() => expect(cardIds()).toEqual(["p2", "p1"]));
      expect(trigger()).toHaveTextContent(/^Posts$/);
    });

    it("speaks a deviation back toward the app's default like any other", async () => {
      writeReaderDefault("acct-1", { ...FEED_FILTER_DEFAULT, order: "newest" });
      server.use(...rankedFeed([post("p1"), post("p2")], reads()), meHandler(), heldTopics());
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(within(sheet()).getByRole("button", { name: "Ranked" }));
      done();
      await waitFor(() => expect(trigger()).toHaveTextContent(/^Posts · ranked$/));
    });
  });

  describe("the device's cuts (CD-4)", () => {
    it("removed_is_off_by_default_and_cuts_on_the_device", async () => {
      server.use(...rankedFeed([post("p1"), post("p2", REMOVED), post("p3")], reads()));
      renderFeed();
      await waitFor(() => expect(cardIds()).toEqual(["p1", "p3"]));
    });

    it("removed_on_admits_the_mark_after_a_local_rederive", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1"), post("p2", REMOVED)], r));
      renderFeed();
      await waitFor(() => expect(cardIds()).toEqual(["p1"]));
      await openSheet();
      fireEvent.click(chip("also.removedChip"));
      done();
      await waitFor(() => expect(cardIds()).toEqual(["p1", "p2"]));
      expect(screen.getByTestId(byNode("feed.card.removalMark", "p2"))).toHaveTextContent("Removed by its author");
      expect(r.ranks).toHaveLength(1);
      expect(trigger()).toHaveTextContent(/^Posts · \+ removed$/);
    });

    it("sensitive_is_off_by_default_and_cuts_on_the_device", async () => {
      server.use(...rankedFeed([post("p1"), post("p2", SENSITIVE)], reads()));
      renderFeed();
      await waitFor(() => expect(cardIds()).toEqual(["p1"]));
    });
  });

  describe("FeedNothing", () => {
    it("every kind off: Nothing, the empty state alone, and Show posts again restores the default", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(chip("kinds.postsChip"));
      done();
      const empty = await screen.findByTestId(byNode("feed.nothing"));
      expect(empty).toHaveTextContent(SHOWING_NOTHING);
      expect(trigger()).toHaveTextContent(/^Nothing$/);
      expect(screen.queryByTestId(byNode("feed.seenSeparator"))).toBeNull();
      expect(screen.queryByTestId(byNode("feed.card"))).toBeNull();
      // Nothing was asked of the ranker for a feed admitting nothing.
      expect(r.ranks).toHaveLength(1);
      fireEvent.click(within(empty).getByRole("button", { name: SHOW_POSTS_AGAIN }));
      expect(await screen.findByTestId(byNode("feed.card", "p1"))).toBeInTheDocument();
      expect(trigger()).toHaveTextContent(/^Posts$/);
    });
  });

  describe("FeedTopic", () => {
    it("narrows to one topic: the ranker is asked with it, and the trigger names it", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1")], r), heldTopics(), meHandler());
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(await within(sheet()).findByTestId(byNode("feed.filterSheet.topic.tag", "saltmaps")));
      done();
      await waitFor(() => expect(r.ranks).toHaveLength(2));
      expect(r.ranks[1]!.topic).toBe("t-salt");
      expect(trigger()).toHaveTextContent(/^Posts · #saltmaps$/);
    });
  });

  describe("the four kinds (FeedKinds.md)", () => {
    it("draws profile and tag cards once their kinds are let in", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1"), person("u3", "mira"), tag("t1", "saltmaps")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      expect(screen.queryByTestId(byNode("feed.profileCard"))).toBeNull();
      await openSheet();
      fireEvent.click(chip("kinds.profilesChip"));
      fireEvent.click(chip("kinds.topicsChip"));
      done();
      await waitFor(() => expect(cardIds()).toEqual(["p1", "u3", "t1"]));
      expect(screen.getByTestId(byNode("feed.tagCard", "t1"))).toHaveTextContent("#saltmaps");
      // The other kinds hydrate through their own read; the posts through the feed's.
      expect(r.windows).toContainEqual(["u3", "t1"]);
    });
  });

  describe("restored pages", () => {
    it("come back under the filter they were made under, the trigger reading it", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1"), post("p2")], r));
      const first = renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      await openSheet();
      fireEvent.click(within(sheet()).getByRole("button", { name: "Newest" }));
      done();
      await waitFor(() => expect(cardIds()).toEqual(["p2", "p1"]));
      first.unmount();
      renderFeed();
      expect(await screen.findByTestId(byNode("feed.band.filterTrigger"))).toHaveTextContent(/^Posts · newest$/);
      expect(cardIds()).toEqual(["p2", "p1"]);
      expect(r.ranks).toHaveLength(1);
    });
  });

  // flows.json FeedSheet → YourTopics: "All your topics" opens everything
  // held; back returns the feed with this sheet up, as it was left (design
  // readme, *A sheet that launched a forward navigation comes back*).
  describe("All your topics", () => {
    it("opens Your topics, naming the feed as where the reader came from", async () => {
      server.use(...rankedFeed([post("p1")], reads()), heldTopics(), meHandler());
      renderFeed();
      await openSheet();
      fireEvent.click(await within(sheet()).findByTestId(byNode("feed.filterSheet.topic.allTopics")));
      expect(push).toHaveBeenCalledWith("/explore/topics?from=feed");
    });

    it("brings the sheet back up on return, with what it had staged", async () => {
      server.use(...rankedFeed([post("p1")], reads()), heldTopics(), meHandler());
      const first = renderFeed();
      await openSheet();
      // Staged, never applied: Newest, and the topic on.
      fireEvent.click(within(sheet()).getByRole("button", { name: "Newest" }));
      fireEvent.click(await within(sheet()).findByTestId(byNode("feed.filterSheet.topic.tag", "saltmaps")));
      fireEvent.click(within(sheet()).getByTestId(byNode("feed.filterSheet.topic.allTopics")));
      first.unmount();
      renderFeed();
      await waitFor(() => expect(sheet().open).toBe(true));
      expect(within(sheet()).getByRole("button", { name: "Newest" })).toHaveAttribute("aria-pressed", "true");
      expect(
        await within(sheet()).findByTestId(byNode("feed.filterSheet.topic.tag", "saltmaps")),
      ).toHaveAttribute("aria-checked", "true");
      // The feed behind it is what it was: the staged filter never applied.
      expect(trigger()).toHaveTextContent(/^Posts$/);
    });

    it("comes back once: the next arrival is the feed at rest", async () => {
      server.use(...rankedFeed([post("p1")], reads()), heldTopics(), meHandler());
      const first = renderFeed();
      await openSheet();
      fireEvent.click(await within(sheet()).findByTestId(byNode("feed.filterSheet.topic.allTopics")));
      first.unmount();
      const second = renderFeed();
      await waitFor(() => expect(sheet().open).toBe(true));
      second.unmount();
      renderFeed();
      await screen.findByTestId(byNode("feed.band.filterTrigger"));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(sheet().open).toBe(false);
    });
  });

  describe("a borrowed view (FeedSheet.md, GIVEN the feed borrows a view)", () => {
    it("speaks the borrowed account's people and order, the reader's own words elsewhere", async () => {
      server.use(...rankedFeed([post("p1")], reads()), borrowedView("mira"));
      renderFeed();
      await screen.findByTestId(byNode("feed.borrowedViewBand"));
      await openSheet();
      expect(within(sheet()).getByRole("radio", { name: /^@mira's people/ })).toBeInTheDocument();
      expect(sheet()).toHaveTextContent("The whole feed, as far as @mira's eyes reach.");
      expect(sheet()).toHaveTextContent(
        "Ranked puts what's closest to @mira first — the view you're browsing from. Newest ignores it and lists by time.",
      );
      expect(within(sheet()).getByRole("checkbox", { name: "Show what you've already seen" })).toBeInTheDocument();
      fireEvent.click(within(sheet()).getByRole("radio", { name: /^@mira's people/ }));
      expect(within(sheet()).getByRole("radiogroup", { name: "Which of @mira's people" })).toBeInTheDocument();
      done();
      await waitFor(() => expect(trigger()).toHaveTextContent(/^Posts · @mira's people$/));
    });
  });

  describe("the pull", () => {
    it("never refreshes the feed from inside the sheet (FeedSheet.md:77)", async () => {
      const r = reads();
      server.use(...rankedFeed([post("p1")], r));
      renderFeed();
      await screen.findByTestId(byNode("feed.card", "p1"));
      const dialog = await openSheet();
      act(() => {
        fireEvent.pointerDown(dialog, { clientY: 10, pointerType: "touch" });
        fireEvent.pointerMove(dialog, { clientY: 400, pointerType: "touch" });
        fireEvent.pointerUp(dialog, { clientY: 400, pointerType: "touch" });
      });
      expect(r.ranks).toHaveLength(1);
    });
  });
});
