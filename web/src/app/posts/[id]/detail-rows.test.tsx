// THE DETAIL'S TWO COUNT LINES AND THEIR SHEETS, view-level: PostDetail.md's
// opinions and citedBy lines, PostOpinions.md and CitedBy.md compiled line by
// line against the page as a reader meets it — MSW answering the reads, no
// write anywhere.
//
// THE ADVERSARIAL CASE IS COUNTS VERSUS ROWS. The chronicle serves records; a
// revised opinion or citation is several records and one row, and a withdrawn
// citation is records and no row. Every count asserted here is the ROW count,
// and every sheet holds exactly the rows its line counts.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { citingRecord, citingRecords, nodeOpinions, opinionRecord } from "@/test/inbound";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceHandlers } from "@/test/stance";
import { PostView } from "./post-view";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const moderated = (value: string | null) => ({ __typename: "ModeratedText", value, status: "NORMAL" });

/** The post the detail opens: one author, no thread, a tag so the tags line stands. */
const POST = {
  __typename: "Post",
  id: "p1",
  title: moderated("Salt maps of the coast road"),
  description: moderated(null),
  content: moderated("The body"),
  attachments: [],
  attachmentsStatus: "NORMAL",
  author: {
    __typename: "User",
    id: "u-alice",
    handle: "alice",
    displayName: { __typename: "ModeratedText", value: "Alice" },
    avatar: null,
  },
  createdAt: "2026-08-12T10:00:00Z",
  updatedAt: "2026-08-12T10:00:00Z",
  landing: { __typename: "Landing", state: "LANDED" },
  moderationStatus: "NORMAL",
  removal: null,
  genesisRecordId: "rec-p1",
  license: { __typename: "License", attribution: 0, provenance: 0 },
  topics: [
    {
      __typename: "TopicClaim",
      hashtag: { __typename: "Hashtag", id: "h1", name: moderated("coastroad") },
      relevance: 0.4,
      confidence: 0.9,
      pending: false,
    },
  ],
  references: [],
  viewerBookmarkedAt: null,
  sensitiveSelfMark: false,
  sensitiveReason: null,
  comments: {
    __typename: "CommentConnection",
    totalCount: 0,
    edges: [],
    pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
  },
};

const server = startMswServer(
  ...stanceHandlers(),
  gqlLink.query("PostDetail", () => HttpResponse.json({ data: { post: POST } })),
  gqlLink.query("PostComments", () =>
    HttpResponse.json({ data: { post: { __typename: "Post", id: "p1", comments: POST.comments } } }),
  ),
);

/** The board's holders, Mira's opinion taking two records (she revised it). */
function boardOpinions() {
  return [
    opinionRecord("mira", 0.5, 0.2, { displayName: "Mira Voss" }),
    opinionRecord("juno", -0.55, 0.25, { displayName: "Juno" }),
    opinionRecord("ada", 0.7, 0.4, { displayName: "Ada Okonkwo" }),
    opinionRecord("mira", 0.4, 0.05, { displayName: "Mira Voss" }),
    opinionRecord("kel", 0.25, 0, { displayName: "Kel" }),
  ];
}

/**
 * What cites the post: Sol's citation revised (two records, one row), Ada's
 * withdrawn (two records netting to nothing, no row), Tobias's comment once.
 */
function boardCitations() {
  const salt = { kind: "post", id: "p-salt", title: "Where the salt goes in winter" } as const;
  const honey = { kind: "post", id: "p-honey", title: "A honey stand and a headland" } as const;
  const tide = { kind: "comment", id: "c-tide", body: "Answering the tide-market piece", root: "p-root" } as const;
  return [
    citingRecord("sol", salt, 0.4, 0.2),
    citingRecord("ada", honey, -0.3, 0.35),
    citingRecord("tobias", tide, 0.4, 0.65),
    citingRecord("ada", honey, 0.3, -0.35),
    citingRecord("sol", salt, 0.3, 0.3),
  ];
}

const opinionsLine = () => screen.findByTestId(byNode("postDetail.card.opinions"));
const citedByLine = () => screen.findByTestId(byNode("postDetail.card.citedBy"));

async function openPost() {
  renderWithProviders(<PostView postId="p1" />, { writeSigner: fakeWriteSigner() });
  await screen.findByTestId(byNode("postDetail.card.title"));
}

describe("the post detail's opinions line (PostDetail.md)", () => {
  beforeEach(() => window.localStorage.clear());

  it("counts the people holding an opinion, not their records, and carries no face", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const line = await opinionsLine();
    // Five records, four people: Mira's revision is one opinion.
    expect(line).toHaveTextContent(/^4 opinions on this post$/);
    expect(line.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("is named by its own words, the count inside them", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    await opinionsLine();
    expect(screen.getByRole("button", { name: "4 opinions on this post" })).toBeInTheDocument();
  });

  it("says one opinion in the singular", async () => {
    server.use(nodeOpinions([opinionRecord("mira", 0.9, 0.25), opinionRecord("mira", -0.1, 0)]));
    await openPost();
    expect(await opinionsLine()).toHaveTextContent(/^1 opinion on this post$/);
  });

  it("is absent given no opinion is held on the post", async () => {
    let read = false;
    server.use(nodeOpinions([], () => (read = true)));
    await openPost();
    await waitFor(() => expect(read).toBe(true));
    expect(screen.queryByTestId(byNode("postDetail.card.opinions"))).toBeNull();
  });

  it("stands under the tags line and over the cited-by line", async () => {
    server.use(nodeOpinions(boardOpinions()), citingRecords(boardCitations()));
    await openPost();
    const opinions = await opinionsLine();
    const citedBy = await citedByLine();
    const tags = screen.getByTestId(byNode("postDetail.card.tagsLine"));
    expect(tags.compareDocumentPosition(opinions)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(opinions.compareDocumentPosition(citedBy)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe("the opinions sheet (PostOpinions.md)", () => {
  beforeEach(() => window.localStorage.clear());

  async function openSheet() {
    fireEvent.click(await opinionsLine());
    return screen.getByRole("dialog", { name: "Opinions on this post" });
  }

  it("opens over the post detail, the post still open beneath it", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const sheet = await openSheet();
    expect(sheet).toHaveAttribute("open");
    expect(screen.getByTestId(byNode("postDetail.card"))).toBeInTheDocument();
  });

  it("holds as many rows as the line counts", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const count = Number((await opinionsLine()).textContent?.match(/^\d+/)?.[0]);
    const sheet = await openSheet();
    expect(within(sheet).getAllByTestId(byNode("postDetail.opinionsSheet.opinion"))).toHaveLength(count);
  });

  it("stands strongest first, down past nothing into the ones held against", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const sheet = await openSheet();
    const names = within(sheet)
      .getAllByTestId(byNode("postDetail.opinionsSheet.opinion.name"))
      .map((name) => name.textContent);
    expect(names).toEqual(["Mira Voss", "Ada Okonkwo", "Kel", "Juno"]);
  });

  it("carries the person and their standing opinion, the face leading and the pair the geek reading", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const sheet = await openSheet();
    const mira = within(sheet).getAllByTestId(byNode("postDetail.opinionsSheet.opinion"))[0]!;
    expect(within(mira).getByTestId(byNode("postDetail.opinionsSheet.opinion.handle"))).toHaveTextContent("@mira");
    // The revision netted: 0.5 + 0.4, 0.2 + 0.05.
    expect(within(mira).getByRole("img", { name: "Love this, +0.90 / +0.25" })).toBeInTheDocument();
    expect(within(mira).getByTestId(byNode("postDetail.opinionsSheet.opinion.value.exact")).className).toContain(
      "cg-exact",
    );
  });

  it("wears 🤔, spoken as the state, on an opinion with exactly one number at zero", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const sheet = await openSheet();
    const kel = within(sheet).getAllByTestId(byNode("postDetail.opinionsSheet.opinion"))[2]!;
    expect(within(kel).getByTestId(byNode("postDetail.opinionsSheet.opinion.value.face"))).toHaveTextContent("🤔");
  });

  it("speaks a walked-back standing as walked back, an empty-signed one as saying nothing", async () => {
    server.use(
      nodeOpinions([
        opinionRecord("wren", 0.1, 0.1),
        opinionRecord("wren", -0.1, -0.1, { severed: true }),
        opinionRecord("nadia", 0, 0),
      ]),
    );
    await openPost();
    const sheet = await openSheet();
    expect(within(sheet).getByRole("img", { name: "Walked back, +0.00 / +0.00" })).toBeInTheDocument();
    expect(within(sheet).getByRole("img", { name: "Says nothing, +0.00 / +0.00" })).toBeInTheDocument();
  });

  it("lists the same rows for the post's own author as for anyone", async () => {
    server.use(nodeOpinions(boardOpinions()));
    const store = createTokenStore();
    store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u-alice" });
    renderWithProviders(<PostView postId="p1" />, { store, writeSigner: fakeWriteSigner() });
    const sheet = await openSheet();
    expect(within(sheet).getAllByTestId(byNode("postDetail.opinionsSheet.opinion"))).toHaveLength(4);
  });

  it("closes on Escape and the post stands open beneath it as it was", async () => {
    server.use(nodeOpinions(boardOpinions()));
    await openPost();
    const sheet = (await openSheet()) as HTMLDialogElement;
    act(() => sheet.close());
    await waitFor(() => expect(sheet.open).toBe(false));
    expect(screen.getByTestId(byNode("postDetail.card"))).toBeInTheDocument();
    expect(await opinionsLine()).toHaveTextContent("4 opinions on this post");
  });
});

describe("the cited-by line and sheet (PostDetail.md, CitedBy.md)", () => {
  beforeEach(() => window.localStorage.clear());

  it("counts the standing citations — a revised one once, a withdrawn one not at all", async () => {
    server.use(citingRecords(boardCitations()));
    await openPost();
    expect(await citedByLine()).toHaveTextContent(/^Cited by 2$/);
    expect(screen.getByRole("button", { name: "Cited by 2" })).toBeInTheDocument();
  });

  it("is absent given nothing cites the post — a withdrawn citation included", async () => {
    let read = false;
    server.use(
      citingRecords(
        [
          citingRecord("ada", { kind: "post", id: "p-honey", title: "Honey" }, -0.3, 0.35),
          citingRecord("ada", { kind: "post", id: "p-honey", title: "Honey" }, 0.3, -0.35),
        ],
        () => (read = true),
      ),
    );
    await openPost();
    await waitFor(() => expect(read).toBe(true));
    expect(screen.queryByTestId(byNode("postDetail.card.citedBy"))).toBeNull();
  });

  it("opens over the detail holding exactly the rows its line counts, newest first", async () => {
    server.use(citingRecords(boardCitations()));
    await openPost();
    fireEvent.click(await citedByLine());
    const sheet = screen.getByRole("dialog", { name: "Cited by" });
    expect(screen.getByTestId(byNode("postDetail.card"))).toBeInTheDocument();
    const rows = within(sheet).getAllByTestId(byNode("postDetail.citedBySheet.citation"));
    expect(rows).toHaveLength(2);
    // Sol's revision is the newest act, so his citation leads.
    expect(rows.map((row) => within(row).getByTestId(byNode("postDetail.citedBySheet.citation.name")).textContent)).toEqual([
      "Where the salt goes in winter",
      "Answering the tide-market piece",
    ]);
    // At its net: 0.4 + 0.3, 0.2 + 0.3.
    expect(within(rows[0]!).getByTestId(byNode("postDetail.citedBySheet.citation.value.exact"))).toHaveTextContent(
      "+0.70 / +0.50",
    );
  });

  it("stands apart from the tags-and-references sheet: neither count folds into the other", async () => {
    server.use(citingRecords(boardCitations()));
    await openPost();
    await citedByLine();
    expect(screen.getByTestId(byNode("postDetail.card.tagsLine"))).not.toHaveTextContent("2");
  });

  it("sends a citing comment's row to the thread it answers", async () => {
    server.use(citingRecords(boardCitations()));
    await openPost();
    fireEvent.click(await citedByLine());
    const rows = screen.getAllByTestId(byNode("postDetail.citedBySheet.citation"));
    expect(rows[1]).toHaveAttribute("href", "/posts/p-root");
  });
});
