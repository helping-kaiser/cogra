import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostView } from "@/lib/api/content-api";
import { renderWithProviders } from "@/test/providers";
import { createTokenStore } from "@/lib/session/token-store";
import { PostCard } from "./post-card";

// The card's ⋮ rows navigate, so the card reaches the router the way every
// other surface that pushes a route does.
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/** The viewer, for the ownership test the menu makes. */
function storeFor(accountId: string) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId });
  return store;
}

// The card's own rules — order, the XOR, the clamps, the opener — read
// directly rather than through a surface: every one of them is a fact about
// this component, and driving them through the feed would test the feed.
//
// The fixture is shaped as the wire serves it and cast once: the generated
// node type is a query's, and hand-writing every `__typename` for a rule about
// layout would say nothing extra.
function post(over: Record<string, unknown> = {}): PostView {
  return {
    __typename: "Post",
    id: "p1",
    title: { __typename: "ModeratedText", value: "The title", status: "NORMAL" },
    description: { __typename: "ModeratedText", value: null, status: "NORMAL" },
    content: { __typename: "ModeratedText", value: "The body", status: "NORMAL" },
    attachments: [],
    attachmentsStatus: "NORMAL",
    author: {
      __typename: "User",
      id: "u1",
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
      avatar: null,
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
    comments: { __typename: "CommentConnection", totalCount: 0 },
    ...over,
  } as unknown as PostView;
}

const picture = (status = "NORMAL") => ({
  __typename: "MediaAttachment",
  id: "m1",
  url: "https://media.test/m1.webp",
  altText: null,
  status,
  mimeType: "image/webp",
  options: { __typename: "MediaOptions", aspectRatio: "4:5", durationMs: null },
  coverMedia: null,
});

const moderated = (value: string | null, status = "NORMAL") => ({
  __typename: "ModeratedText",
  value,
  status,
});

/**
 * A post carrying one signed act of each family — enough for the line to state
 * a count, which is the control that raises the sheet.
 */
const tagged = () => ({
  topics: [
    {
      __typename: "TopicClaim",
      hashtag: { __typename: "Hashtag", id: "h1", name: moderated("photography") },
      relevance: 0.4,
      confidence: 0.9,
      pending: false,
    },
  ],
  references: [
    {
      __typename: "ReferenceClaim",
      targetId: "l1-mira",
      relevance: 0.1,
      support: 0.1,
      withdrawalCost: 1,
      pending: false,
      target: {
        __typename: "User",
        id: "u2",
        handle: "mira",
        displayName: moderated("Mira Voss"),
      },
    },
  ],
});

function mount(
  node: PostView,
  over: Record<string, unknown> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  return renderWithProviders(
    <PostCard
      post={node}
      href="/posts/p1"
      testId="card"
      authorTestId="card-author"
      stanceTestId="card-stance"
      comments={0}
      onLinkCopied={() => {}}
      {...over}
    />,
    options,
  );
}

/** The narrow-share fold's own idiom (`stance-control.test.tsx`). */
function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  routerPush.mockClear();
  setViewport(1024);
});

describe("PostCard", () => {
  // PEOPLE FIRST: the author leads, on a media post too.
  it("puts the author above everything, the age beside it", () => {
    const { container } = mount(post({ attachments: [picture()], content: moderated(null) }));
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-author")).toBeLessThan(order.indexOf("card-media"));
    expect(order.indexOf("card-author")).toBeLessThan(order.indexOf("card-title"));
    expect(screen.getByTestId("card-timestamp")).toHaveTextContent("2h");
  });

  // ONE ORDER FOR BOTH KINDS — title · body · description.
  it("draws a text post title, body, description", () => {
    const { container } = mount(post({ description: moderated("The caption") }));
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-title")).toBeLessThan(order.indexOf("card-body"));
    expect(order.indexOf("card-body")).toBeLessThan(order.indexOf("card-description"));
  });

  // The title stays ABOVE the media because it titles the thing.
  it("draws a media post title, media, description — and no words body", () => {
    const { container } = mount(
      post({ attachments: [picture()], description: moderated("The caption") }),
    );
    const order = Array.from(
      container.querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-title")).toBeLessThan(order.indexOf("card-media"));
    expect(order.indexOf("card-media")).toBeLessThan(order.indexOf("card-description"));
    // Handed both, the card draws the documented media reading and the
    // `content` never appears.
    expect(screen.queryByTestId("card-body")).not.toBeInTheDocument();
  });

  it("clamps a summary at one title line, eighteen body lines and two caption lines", () => {
    mount(post({ description: moderated("The caption") }));
    expect(screen.getByTestId("card-title").className).toContain("line-clamp-1");
    expect(screen.getByTestId("card-body").className).toContain("line-clamp-[18]");
    expect(screen.getByTestId("card-description").className).toContain("line-clamp-2");
  });

  it("clamps nothing on the read surface and leads at headline-small", () => {
    mount(post({ description: moderated("The caption") }), { variant: "detail" });
    const title = screen.getByTestId("card-title");
    expect(title.tagName).toBe("H1");
    expect(title.className).toContain("text-headline-small");
    expect(screen.getByTestId("card-body").className).not.toContain("line-clamp");
    expect(screen.getByTestId("card-description").className).not.toContain("line-clamp");
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
  });

  // A media post's caption is clamped to two lines and always carries the
  // opener; a text post's body has eighteen lines to fill first.
  it("offers the opener only where something is folded away", () => {
    mount(post());
    expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
    mount(post({ attachments: [picture()], content: moderated(null), description: moderated("A caption") }));
    expect(screen.getByTestId("card-opener")).toHaveTextContent("More");
  });

  it("unfolds the text in place, and folds it back", () => {
    mount(post({ content: moderated("x".repeat(18 * 51 + 1)) }));
    const opener = screen.getByTestId("card-opener");
    expect(opener).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(opener);
    expect(opener).toHaveTextContent("Less");
    expect(screen.getByTestId("card-body").className).not.toContain("line-clamp");
    fireEvent.click(opener);
    expect(opener).toHaveTextContent("More");
  });

  // `More` opens text in place and never navigates, so it stands outside the
  // link — as does everything else with a meaning of its own.
  it("keeps the acting controls outside the link", () => {
    mount(post({ content: moderated("x".repeat(18 * 51 + 1)) }));
    const link = screen.getByTestId("card-link");
    expect(link).toHaveAttribute("href", "/posts/p1");
    expect(link).not.toContainElement(screen.getByTestId("card-opener"));
    expect(link).not.toContainElement(screen.getByTestId("card-comments"));
    expect(link).not.toContainElement(screen.getByTestId("card-author"));
  });

  // REDACTION IS RECORD-GRANULAR: every authored field goes at once, and the
  // skeleton is what is left.
  it("replaces the whole payload with the Removed mark, keeping the skeleton", () => {
    mount(post({ content: moderated(null, "REDACTED"), description: moderated(null, "REDACTED") }));
    expect(screen.getByTestId("card-removed")).toHaveTextContent("Removed by its author");
    expect(screen.queryByTestId("card-title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-body")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-author")).toBeInTheDocument();
    expect(screen.getByTestId("card-timestamp")).toBeInTheDocument();
    expect(screen.getByTestId("card-stance")).toBeInTheDocument();
  });

  // THE COUNTS ARE THE WAY IN (graph.json: every `reference count` edge
  // advances to `RefsSheet`), and which control opens it is the master's own
  // split between a summary card and a detail surface.
  it("opens the tags-and-references sheet from the counts on a summary card", () => {
    mount(post(tagged()));
    expect(screen.getByTestId("card-refs-sheet")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByTestId("card-topics-counts"));
    expect(screen.getByTestId("card-refs-sheet")).toHaveAttribute("open");
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByTestId("card-refs-sheet-topic-photography-pair")).toHaveTextContent(
      "+0.40 / 0.90",
    );
  });

  it("makes the whole line the opener on the detail surface", () => {
    mount(post(tagged()), { variant: "detail" });
    fireEvent.click(screen.getByTestId("card-topics"));
    expect(screen.getByTestId("card-refs-sheet")).toHaveAttribute("open");
  });

  // THE ⋮ IS ON EVERY NON-DETAIL CARD (`PostCard.jsx:262`). The rows are the
  // detail's own — one menu for a post wherever it is drawn — so what these
  // read is that the card picks the right set and names the author.
  describe("the overflow menu", () => {
    // `OWN_POST_MENU` (`_shared.jsx:369-375`): Save · Edit · Mark as
    // sensitive · Remove · License terms.
    it("gives the creator the own-post rows", () => {
      mount(post(), {}, { store: storeFor("u1") });
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.getByTestId("card-menu-save")).toHaveTextContent("Save");
      expect(screen.getByTestId("card-menu-edit")).toHaveTextContent("Edit");
      expect(screen.getByTestId("card-menu-sensitive")).toHaveTextContent("Mark as sensitive");
      expect(screen.getByTestId("card-menu-remove")).toHaveTextContent("Remove");
      expect(screen.getByTestId("card-menu-license")).toHaveTextContent("License terms");
      expect(screen.queryByTestId("card-menu-cite")).not.toBeInTheDocument();
      expect(screen.queryByTestId("card-menu-hide")).not.toBeInTheDocument();
    });

    // `READER_POST_MENU` (`_shared.jsx:376`): Save · Cite in a new post ·
    // Hide @handle · License terms.
    it("gives a reader the reader rows, naming the author in the hide row", () => {
      mount(post(), {}, { store: storeFor("someone-else") });
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.getByTestId("card-menu-cite")).toHaveTextContent("Cite in a new post");
      // `Hide @alice`, never "Hide this author" (`ActorChip.jsx:67`).
      expect(screen.getByTestId("card-menu-hide")).toHaveTextContent("Hide @alice");
      expect(screen.queryByTestId("card-menu-edit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("card-menu-remove")).not.toBeInTheDocument();
    });

    // A signed-out reader is nobody's author, so the reader rows are what a
    // card carries before anyone signs in.
    it("gives a signed-out reader the reader rows", () => {
      mount(post());
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.getByTestId("card-menu-cite")).toBeInTheDocument();
      expect(screen.queryByTestId("card-menu-edit")).not.toBeInTheDocument();
    });

    // ON A DETAIL SURFACE THE PAGE HEADER OWNS THE ONE OVERFLOW
    // (`_shared.jsx:341-346`): two dots would be two menus for one post.
    it("yields the dot on the detail surface", () => {
      mount(post(), { variant: "detail" }, { store: storeFor("u1") });
      expect(screen.queryByTestId("card-menu")).not.toBeInTheDocument();
    });

    // A REMOVED POST HAS NO MENU AT ALL (`Removed.jsx:5-6`) — the ⋮ goes
    // wholesale, not a row at a time.
    it("drops the whole menu on a removed post", () => {
      mount(post({ content: moderated(null, "REDACTED"), description: moderated(null, "REDACTED") }));
      expect(screen.queryByTestId("card-menu")).not.toBeInTheDocument();
    });

    // The rows navigate from a card exactly as they do from the detail.
    it("opens the edit route from the creator's Edit row", () => {
      mount(post(), {}, { store: storeFor("u1") });
      fireEvent.click(screen.getByTestId("card-menu"));
      fireEvent.click(screen.getByTestId("card-menu-edit"));
      expect(routerPush).toHaveBeenCalledWith("/compose?post=p1");
    });

    it("stages the post in the composer from the reader's Cite row", () => {
      mount(post(), {}, { store: storeFor("someone-else") });
      fireEvent.click(screen.getByTestId("card-menu"));
      fireEvent.click(screen.getByTestId("card-menu-cite"));
      expect(routerPush).toHaveBeenCalledWith("/compose?reference=p1");
    });

    // THE SHEETS THE ROWS OPEN RIDE THE CARD, the way the refs sheet does:
    // the license reads on the surface the reader asked from.
    it("raises the card's own license sheet from the license row", () => {
      mount(post());
      fireEvent.click(screen.getByTestId("card-menu"));
      fireEvent.click(screen.getByTestId("card-menu-license"));
      expect(screen.getByTestId("card-license-sheet")).toHaveAttribute("open");
    });

    // THE NARROW PHONE'S MENU HOLDS THE SHARE IT TOOK (design/readme.md,
    // jakob 2026-09-17, sharpened 2026-09-22 — PR #794): strictly below
    // 360px the reader's menu leads with it.
    it("leads the reader's menu with Share strictly below the narrow breakpoint", () => {
      vi.stubGlobal("navigator", { share: vi.fn() });
      setViewport(359);
      mount(post(), {}, { store: storeFor("someone-else") });
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.getByTestId("card-menu-share")).toHaveTextContent("Share");
      const order = Array.from(
        screen.getByTestId("card-menu-sheet").querySelectorAll("[data-testid]"),
        (node) => node.getAttribute("data-testid"),
      );
      expect(order[0]).toBe("card-menu-share");
      expect(order.indexOf("card-menu-share")).toBeLessThan(order.indexOf("card-menu-save"));
    });

    // AT 360 THE WIDE LAYOUT STANDS — the inequality is strict, since 360dp
    // is a mainstream android width (jakob 2026-09-22).
    it("keeps the reader's menu free of Share at the breakpoint itself", () => {
      vi.stubGlobal("navigator", { share: vi.fn() });
      setViewport(360);
      mount(post(), {}, { store: storeFor("someone-else") });
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.queryByTestId("card-menu-share")).not.toBeInTheDocument();
    });

    // A dead row is worse than none (`share.ts`'s "the control does not
    // render" law) — the fold never outruns the button's own capability gate.
    it("keeps the reader's menu free of Share where the browser has no share door", () => {
      vi.stubGlobal("navigator", {});
      setViewport(359);
      mount(post(), {}, { store: storeFor("someone-else") });
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.queryByTestId("card-menu-share")).not.toBeInTheDocument();
    });

    // No board draws Share leaving the author's own menu — the ruling names
    // only the reader's (design/readme.md). Pinned so a future change to
    // this scope is a deliberate one, not a drift.
    it("never adds Share to the creator's own menu, even below the narrow breakpoint", () => {
      vi.stubGlobal("navigator", { share: vi.fn() });
      setViewport(359);
      mount(post(), {}, { store: storeFor("u1") });
      fireEvent.click(screen.getByTestId("card-menu"));
      expect(screen.queryByTestId("card-menu-share")).not.toBeInTheDocument();
    });
  });

  it("keeps the affordance row on one line, in the ruled order", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    mount(post({ comments: { __typename: "CommentConnection", totalCount: 3 } }), { comments: 3 });
    const row = screen.getByTestId("card-affordances");
    expect(row.className).toContain("flex-nowrap");
    expect(row).toContainElement(screen.getByTestId("card-stance"));
    expect(row).toContainElement(screen.getByTestId("card-comments"));
    expect(row).toContainElement(screen.getByTestId("card-share"));
    const order = Array.from(
      screen.getByTestId("card").querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order.indexOf("card-stance")).toBeLessThan(order.indexOf("card-comments"));
    expect(order.indexOf("card-comments")).toBeLessThan(order.indexOf("card-share"));
  });

  // THE NARROW PHONE SHEDS SHARE FROM THE ROW (design/readme.md, jakob
  // 2026-09-17, sharpened 2026-09-22 — PR #794): strictly below 360px of
  // viewport width, the row gives way from its end.
  it("sheds the row's Share control strictly below the narrow breakpoint", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    setViewport(359);
    mount(post());
    expect(screen.queryByTestId("card-share")).not.toBeInTheDocument();
  });

  // AT 360 THE WIDE LAYOUT STANDS — the inequality is strict, since 360dp is
  // a mainstream android width (jakob 2026-09-22), so this is the breakpoint
  // itself, not just "above" it.
  it("keeps the row's Share control at the breakpoint itself", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    setViewport(360);
    mount(post());
    expect(screen.getByTestId("card-share")).toBeInTheDocument();
  });
});
