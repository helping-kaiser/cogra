import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostView } from "@/lib/api/content-api";
import { fakeClampLayout } from "@/test/fake-clamp-layout";
import { renderWithProviders } from "@/test/providers";
import { createTokenStore } from "@/lib/session/token-store";
import { setAccountFilterLevel } from "@/lib/settings/sensitive-content";
import { forgetReveals } from "@/lib/ui2/media/reveal";
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
    sensitiveSelfMark: false,
    sensitiveReason: null,
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
    // No removal: the node stands (api-spec.md `Post.removal`).
    removal: null,
    genesisRecordId: "rec-genesis",
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

  // `More` STANDS ONLY WHERE A CLAMP CUTS SOMETHING (`PostCard.jsx`: "only
  // where there is something folded away"), read off the clamped paragraph's
  // own heights (`clamp-fold.ts`). jsdom lays nothing out, so the heights are
  // the stand-in layout's: 40 characters to a 20px line.
  describe("the opener, measured", () => {
    let layout: ReturnType<typeof fakeClampLayout>;
    beforeEach(() => {
      layout = fakeClampLayout(40);
    });
    afterEach(() => layout.restore());

    const captioned = (caption: string) =>
      post({ attachments: [picture()], content: moderated(null), description: moderated(caption) });

    it("offers no opener under a caption that fits its two lines", () => {
      mount(captioned("A caption"));
      expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
    });

    it("offers no opener under a short text post", () => {
      mount(post({ description: moderated("A short description") }));
      expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
    });

    it("offers More under a caption its two lines cut", () => {
      mount(captioned("x".repeat(81)));
      expect(screen.getByTestId("card-opener")).toHaveTextContent("More");
    });

    it("offers More under a text body its eighteen lines cut", () => {
      mount(post({ content: moderated("x".repeat(18 * 40 + 1)) }));
      expect(screen.getByTestId("card-opener")).toHaveTextContent("More");
    });

    it("unfolds the text in place, and folds it back", () => {
      mount(post({ content: moderated("x".repeat(18 * 40 + 1)) }));
      const opener = screen.getByTestId("card-opener");
      expect(opener).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(opener);
      expect(opener).toHaveTextContent("Less");
      expect(screen.getByTestId("card-body").className).not.toContain("line-clamp");
      fireEvent.click(opener);
      expect(opener).toHaveTextContent("More");
    });

    it("drops the opener when a wider line lets the caption fit", () => {
      mount(captioned("x".repeat(81)));
      expect(screen.getByTestId("card-opener")).toBeInTheDocument();
      layout.resize(60);
      expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
      layout.resize(40);
      expect(screen.getByTestId("card-opener")).toHaveTextContent("More");
    });

    it("offers no opener on the read surface", () => {
      mount(captioned("x".repeat(200)), { variant: "detail" });
      expect(screen.queryByTestId("card-opener")).not.toBeInTheDocument();
    });
  });

  // `More` opens text in place and never navigates, so it stands outside the
  // link — as does everything else with a meaning of its own.
  it("keeps the acting controls outside the link", () => {
    const layout = fakeClampLayout(40);
    mount(post({ content: moderated("x".repeat(18 * 40 + 1)) }));
    layout.restore();
    const link = screen.getByTestId("card-link");
    expect(link).toHaveAttribute("href", "/posts/p1");
    expect(link).not.toContainElement(screen.getByTestId("card-opener"));
    expect(link).not.toContainElement(screen.getByTestId("card-comments"));
    expect(link).not.toContainElement(screen.getByTestId("card-author"));
  });

  // THE LINK IS THE CARD'S DOOR (`Card.jsx`, the K13 round): hovered or
  // pressed, the whole card takes the layer — the controls keep their own.
  it("lights the whole card from its door", () => {
    mount(post());
    expect(screen.getByTestId("card-link").className).toContain("cg-door");
    expect(screen.getByTestId("card").className).toContain("cg-door-card");
  });

  // TITLE · BODY · DESCRIPTION, one visible join apart (`PostCard.jsx`
  // `textBlock`, `--space-1`).
  it("stands title, body and description 4px apart", () => {
    mount(post({ title: moderated("A title"), content: moderated("Words") }));
    const block = screen.getByTestId("card-body").parentElement!;
    expect(block.className).toContain("gap-1");
    expect(block).toContainElement(screen.getByTestId("card-title"));
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

  // THE ⋮ IS ON EVERY NON-DETAIL CARD (`PostCard.jsx:262`), and the menu it
  // raises is the HOST's (`PostMenuHost`, ruling 84): the card only asks. The
  // rows each host's sheet holds are pinned on the hosts' own suites.
  describe("the overflow trigger", () => {
    it("asks its host to raise the menu", () => {
      const onOpenMenu = vi.fn();
      mount(post(), { onOpenMenu });
      const trigger = screen.getByTestId("card-menu");
      expect(trigger).toHaveAccessibleName("More on this post");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(trigger);
      expect(onOpenMenu).toHaveBeenCalledTimes(1);
    });

    it("says the host's sheet is up for it", () => {
      mount(post(), { onOpenMenu: vi.fn(), menuOpen: true });
      expect(screen.getByTestId("card-menu")).toHaveAttribute("aria-expanded", "true");
    });

    // ON A DETAIL SURFACE THE PAGE HEADER OWNS THE ONE OVERFLOW
    // (`_shared.jsx:341-346`): two dots would be two menus for one post.
    it("yields the dot on the detail surface", () => {
      mount(post(), { variant: "detail", onOpenMenu: vi.fn() }, { store: storeFor("u1") });
      expect(screen.queryByTestId("card-menu")).not.toBeInTheDocument();
    });

    // A REMOVED POST HAS NO MENU AT ALL (`Removed.jsx:5-6`) — the ⋮ goes
    // wholesale, not a row at a time.
    it("drops the whole menu on a removed post", () => {
      mount(post({ content: moderated(null, "REDACTED"), description: moderated(null, "REDACTED") }), {
        onOpenMenu: vi.fn(),
      });
      expect(screen.queryByTestId("card-menu")).not.toBeInTheDocument();
    });
  });

  it("keeps the affordance row on one line, in the ruled order", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    mount(post({ comments: { __typename: "CommentConnection", totalCount: 3 } }), { comments: 3 });
    const row = screen.getByTestId("card-affordances");
    expect(row.className).toContain("flex-nowrap");
    // It spreads across the card, share closing it at the right edge
    // (`PostCard.jsx`, the geek round).
    expect(row.className).toContain("justify-between");
    expect(row.className).toContain("w-full");
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

// V-1 (feed-card-rework §6): the card's veil answers the account's choice
// (settings packet §3.1a) — both states of the switch.
describe("PostCard and the account's sensitive-content choice", () => {
  afterEach(() => {
    setAccountFilterLevel(null);
    forgetReveals();
  });

  const sensitive = () =>
    post({ attachmentsStatus: "SENSITIVE", content: moderated("The marked body", "SENSITIVE") });

  it("a_sensitive_card_unveils_when_the_account_always_unveils", () => {
    setAccountFilterLevel(0);
    mount(sensitive());
    expect(screen.queryByTestId("card-veil")).not.toBeInTheDocument();
    expect(screen.getByText("The marked body")).toBeInTheDocument();
    // The title stays readable either way.
    expect(screen.getByText("The title")).toBeInTheDocument();
  });

  it("a_sensitive_card_stays_veiled_for_a_guest", () => {
    mount(sensitive());
    expect(screen.getByTestId("card-veil")).toBeInTheDocument();
  });
});

// THE VEIL NAMES ITS SOURCE ON EVERY VEIL, ONCE PER POST (LadderStates.md,
// round 26; FeedWordsSensitive.md; PostCard.jsx's two faces).
describe("PostCard's veil faces", () => {
  afterEach(() => {
    forgetReveals();
  });

  const marked = (over: Record<string, unknown>) =>
    post({
      attachmentsStatus: "SENSITIVE",
      moderationStatus: "SENSITIVE",
      content: moderated("The marked body", "SENSITIVE"),
      ...over,
    });

  it("a words-only post blurs its words in place with Show, the author's warning and reason under them", () => {
    mount(marked({ sensitiveSelfMark: true, sensitiveReason: "Grief" }));
    expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Sensitive — tap to view/ })).toBeNull();
    expect(screen.getByTestId("card-veil-source")).toHaveTextContent("The author's warning — Grief");
    expect(screen.getByText("The title")).toBeInTheDocument();
  });

  it("the author's mark reads the author's line alone until the wire names a verdict beside it (seam 253)", () => {
    // A SENSITIVE status with the self-mark set may also carry a verdict, but
    // nothing served says so yet (`sensitiveSource`, B-C1): the author's line
    // alone, never a guessed second sentence.
    mount(marked({ sensitiveSelfMark: true, sensitiveReason: "Grief" }));
    expect(screen.getByTestId("card-veil-source")).toHaveTextContent(/^The author's warning — Grief$/);
    expect(screen.getByTestId("card-veil-source")).not.toHaveTextContent("Also veiled");
  });

  it("a verdict alone names the platform's verdict", () => {
    mount(marked({ sensitiveSelfMark: false }));
    expect(screen.getByTestId("card-veil-source")).toHaveTextContent("The platform's verdict");
  });

  // THE CAPTION VEIL SPLIT (seam 253; PostCard.jsx: the media's face, each
  // caption paragraph's text veil, one SensitiveScope): the media face lies
  // over the media alone, and the caption blurs in place with its own Show.
  it("a picture post's caption blurs in place with Show, outside the media face, the source named once", () => {
    mount(
      marked({
        content: moderated(null),
        description: moderated("Rubbings from three weekends", "SENSITIVE"),
        attachments: [picture()],
        sensitiveSelfMark: true,
        sensitiveReason: "Grief",
      }),
    );
    const face = screen.getByTestId("card-veil");
    expect(face).toContainElement(screen.getByTestId("card-media"));
    expect(face).not.toContainElement(screen.getByTestId("card-description"));
    const caption = screen.getByTestId("card-description-veil");
    expect(caption).toContainElement(screen.getByTestId("card-description"));
    expect(within(caption).getByRole("button", { name: "Show" })).toBeInTheDocument();
    // One source line per post: the media face carries it, the caption leaves it.
    expect(screen.getAllByTestId(/-veil-source$/)).toHaveLength(1);
    expect(within(face).getByTestId("card-veil-source")).toHaveTextContent("The author's warning — Grief");
    // The title stays readable, outside every veil.
    expect(face).not.toContainElement(screen.getByTestId("card-title"));
    expect(caption).not.toContainElement(screen.getByTestId("card-title"));
  });

  it("one Show on the caption lifts the media face too: one reveal for the post", () => {
    mount(
      marked({
        content: moderated(null),
        description: moderated("Rubbings from three weekends", "SENSITIVE"),
        attachments: [picture()],
        sensitiveSelfMark: true,
      }),
    );
    fireEvent.click(within(screen.getByTestId("card-description-veil")).getByRole("button", { name: "Show" }));
    expect(screen.queryByTestId("card-veil")).toBeNull();
    expect(screen.queryByTestId("card-description-veil")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Sensitive — tap to view/ })).toBeNull();
  });

  it("the media face's tap lifts the caption's veil too", () => {
    mount(
      marked({
        content: moderated(null),
        description: moderated("Rubbings from three weekends", "SENSITIVE"),
        attachments: [picture()],
        sensitiveSelfMark: true,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Sensitive — tap to view/ }));
    expect(screen.queryByTestId("card-description-veil")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
  });

  it("a words-only post's title stays readable outside the veil (FeedWordsSensitive.md:9)", () => {
    mount(marked({ sensitiveSelfMark: true }));
    const veil = screen.getByTestId("card-veil");
    expect(veil).toContainElement(screen.getByTestId("card-body"));
    expect(veil).not.toContainElement(screen.getByTestId("card-title"));
    expect(screen.getByTestId("card-title").closest("[aria-hidden='true']")).toBeNull();
  });

  it("a picture post wears the media face, naming the source once", () => {
    mount(marked({ content: moderated(null), attachments: [picture()], sensitiveSelfMark: true }));
    expect(
      screen.getByRole("button", { name: "Sensitive — tap to view. The author's warning" }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("card-veil-source")).toHaveLength(1);
  });
});
