// The feed-hosted post menu (FeedPostMenu.md; ruling 84) and the report it
// carries at its tail (ReportConfirm.md; ruling 75, FC-G15): one sheet the
// feed hosts for every card, over the feed, and a report that is sent only by
// the confirm's commit — whose snackbar never claims a report that did not go
// out.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { stanceHandlers } from "@/test/stance";
import { byNode } from "@/test/data-node";
import { FeedView } from "./feed-view";
import { forgetFeed } from "./feed-memory";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  useSearchParams: () => new URLSearchParams(),
}));

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function post(id: string, authorId = "u1") {
  return {
    __typename: "Post",
    id,
    comments: { __typename: "CommentConnection", totalCount: 0 },
    title: moderated(`Post ${id}`),
    description: moderated(null),
    content: moderated(`body of ${id}`),
    attachments: [] as unknown[],
    attachmentsStatus: "NORMAL",
    author: {
      __typename: "User",
      id: authorId,
      handle: "alice",
      displayName: { __typename: "ModeratedText", value: "Alice" },
      avatar: null,
    },
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
    landing: { __typename: "Landing", state: "LANDED" },
    moderationStatus: "NORMAL",
    // No removal: the node stands (api-spec.md `Post.removal`).
    removal: null,
    genesisRecordId: "rec-genesis",
    license: { __typename: "License", attribution: 0, provenance: 0 },
    topics: [],
    references: [],
  };
}

/** The ranked feed's two reads over `nodes`, ranked in the order given. */
function rankedFeed(nodes: ReturnType<typeof post>[]) {
  return [
    gqlLink.query("FeedRanking", () =>
      HttpResponse.json({
        data: {
          feedRanking: {
            __typename: "FeedRanking",
            asOfEpoch: 4,
            entries: nodes.map((node, index) => ({
              __typename: "FeedEntry",
              targetId: node.id,
              kind: "POST",
              score: 1 - index / 100,
              mark: null,
              newestIndex: index,
            })),
            settling: [],
          },
        },
      }),
    ),
    gqlLink.query("Feed", ({ variables }) => {
      const ids = variables.orderedIds as string[];
      return HttpResponse.json({
        data: {
          feed: {
            __typename: "FeedConnection",
            edges: nodes
              .filter((node) => ids.includes(node.id))
              .map((node) => ({ __typename: "FeedEdge", node })),
          },
        },
      });
    }),
  ];
}

const meHandler = gqlLink.query("Me", () =>
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

const borrowedViewHandler = gqlLink.query("BorrowedView", () =>
  HttpResponse.json({ data: { borrowedView: null } }),
);

const server = startMswServer(...stanceHandlers(), borrowedViewHandler, meHandler);

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/** How the server answers a report. */
type ReportAnswer = "sent" | "rate-limited" | "not-found" | "no-answer";

/** The report mutation, counting what it was asked; `answer` picks its reply. */
function reportHandler(answer: ReportAnswer) {
  const targets: string[] = [];
  return {
    targets,
    handler: gqlLink.mutation("SendReport", ({ variables }) => {
      targets.push(variables.target as string);
      if (answer === "no-answer") return HttpResponse.error();
      if (answer === "rate-limited") {
        // A spent budget rides the transport tier (api-spec `sendReport`).
        return HttpResponse.json({
          data: null,
          errors: [{ message: "rate limited; retry later", extensions: { code: "RATE_LIMITED" } }],
        });
      }
      return HttpResponse.json({
        data: {
          sendReport: {
            __typename: "SendReportPayload",
            reportedAt: answer === "sent" ? "2026-10-13T12:00:00Z" : null,
            userErrors:
              answer === "sent"
                ? []
                : [
                    {
                      __typename: "UserError",
                      code: "NOT_FOUND",
                      message: "no post, comment or profile has this id",
                      field: ["target"],
                    },
                  ],
          },
        },
      });
    }),
  };
}

const sent: ReportAnswer = "sent";

async function openMenu() {
  fireEvent.click(await screen.findByTestId(byNode("feed.card.menu", "p1")));
  return screen.getByTestId("feed.menuSheet") as HTMLDialogElement;
}

async function openReport() {
  await openMenu();
  fireEvent.click(screen.getByTestId("feed.menuSheet.report"));
  return screen.getByTestId("feed.reportSheet") as HTMLDialogElement;
}

function snackbar() {
  return screen.queryByTestId("feed.snackbar");
}

describe("the feed's post menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
    forgetFeed();
  });

  // FeedPostMenu.md:3
  it("a_cards_menu_rises_over_the_feed_which_stands_unchanged_beneath", async () => {
    server.use(...rankedFeed([post("p1"), post("p2")]));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openMenu();
    expect(sheet.open).toBe(true);
    expect(screen.getByTestId(byNode("feed.card.menu", "p1"))).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // One sheet for every card: the feed hosts it, and the cards stand.
    expect(screen.getAllByTestId("feed.menuSheet")).toHaveLength(1);
    expect(screen.getByTestId(byNode("feed.card", "p2"))).toBeInTheDocument();
  });

  // FeedPostMenu.md:5
  it("the_feed_menu_reads_save_cite_hide_license_then_report_at_the_tail", async () => {
    server.use(...rankedFeed([post("p1")]));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await openMenu();
    const order = Array.from(
      screen.getByTestId("feed-menu-sheet-body").querySelectorAll("[data-testid]"),
      (node) => node.getAttribute("data-testid"),
    );
    expect(order).toEqual([
      "feed.menuSheet.save",
      "feed.menuSheet.cite",
      "feed.menuSheet.hide",
      "feed.menuSheet.license",
      "feed.menuSheet.report",
    ]);
    // :7 — the post is not kept, so the row reads Save.
    expect(screen.getByTestId("feed.menuSheet.save")).toHaveTextContent("Save");
    expect(screen.getByTestId("feed.menuSheet.hide")).toHaveTextContent("Hide @alice");
    expect(screen.getByTestId("feed.menuSheet.report")).toHaveTextContent("Report");
  });

  // An author's own rows on the feed have no drawn board, so they keep their
  // own ids rather than wear a path the registry does not hold — and carry no
  // Report.
  it("the_authors_own_menu_on_the_feed_carries_no_report", async () => {
    server.use(...rankedFeed([post("p1", "acct-1")]));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await openMenu();
    expect(screen.getByTestId("feed-menu-edit")).toHaveTextContent("Edit");
    expect(screen.queryByTestId("feed.menuSheet.report")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed.menuSheet.hide")).not.toBeInTheDocument();
  });

  // FeedPostMenu.md:17
  it("cite_opens_the_wizard_fresh_with_the_post_riding_along", async () => {
    server.use(...rankedFeed([post("p1")]));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await openMenu();
    fireEvent.click(screen.getByTestId("feed.menuSheet.cite"));
    expect(push).toHaveBeenCalledWith("/compose?reference=p1");
  });

  // FeedPostMenu.md:21
  it("license_closes_the_menu_and_raises_the_terms_over_the_feed", async () => {
    server.use(...rankedFeed([post("p1")]));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const menu = await openMenu();
    fireEvent.click(screen.getByTestId("feed.menuSheet.license"));
    expect(screen.getByTestId("feed.licenseSheet.terms")).toHaveTextContent("Public domain");
    expect((screen.getByTestId("feed.licenseSheet") as HTMLDialogElement).open).toBe(true);
    expect(screen.getByTestId("feed.licenseSheet.dragHandle")).toBeInTheDocument();
    await waitFor(() => expect(menu.open).toBe(false));
    // Over the feed, never a state of the card (PostLicense.md:9).
    expect(screen.getByTestId(byNode("feed.card", "p1"))).not.toContainElement(
      screen.getByTestId("feed.licenseSheet.terms"),
    );
  });

  // The terms' two rows are the registered keyed `axis`.
  it("license_rows_are_the_registered_axes", async () => {
    server.use(...rankedFeed([post("p1")]));
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await openMenu();
    fireEvent.click(screen.getByTestId("feed.menuSheet.license"));
    for (const [key, label, value] of [
      ["credit", "Credit", "Not required"],
      ["public-record-of-use", "Public record of use", "Not logged"],
    ]) {
      const axis = screen.getByTestId(byNode("feed.licenseSheet.terms.axis", key));
      expect(axis).toContainElement(
        screen.getByTestId(byNode("feed.licenseSheet.terms.axis.label", key)),
      );
      expect(screen.getByTestId(byNode("feed.licenseSheet.terms.axis.label", key))).toHaveTextContent(
        label,
      );
      expect(screen.getByTestId(byNode("feed.licenseSheet.terms.axis.value", key))).toHaveTextContent(
        value,
      );
    }
  });

  // FeedPostMenu.md:23
  it("report_closes_the_menu_and_raises_the_confirm_over_the_feed_sending_nothing", async () => {
    const report = reportHandler(sent);
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openReport();
    expect(sheet.open).toBe(true);
    expect(sheet).toHaveAccessibleName("Report this post?");
    expect(sheet).toHaveTextContent("Report this post?");
    expect(screen.getByTestId("feed.reportSheet.body")).toHaveTextContent(
      "It goes to the people who run CoGra for a look.",
    );
    await waitFor(() =>
      expect((screen.getByTestId("feed.menuSheet") as HTMLDialogElement).open).toBe(false),
    );
    expect(report.targets).toEqual([]);
  });

  // ReportConfirm.md:17
  it("report_cancel_sends_nothing", async () => {
    const report = reportHandler(sent);
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openReport();
    fireEvent.click(screen.getByTestId("feed.reportSheet.cancel"));
    await waitFor(() => expect(sheet.open).toBe(false));
    expect(report.targets).toEqual([]);
    expect(snackbar()).not.toBeInTheDocument();
  });

  // ReportConfirm.md:11 — the commit sends the mail (ruling 75).
  it("report_confirm_sends_the_mail_and_snackbars_reported", async () => {
    const report = reportHandler(sent);
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openReport();
    fireEvent.click(screen.getByTestId("feed.reportSheet.report"));
    expect(await screen.findByTestId("feed.snackbar.message")).toHaveTextContent("Reported.");
    expect(report.targets).toEqual(["p1"]);
    await waitFor(() => expect(sheet.open).toBe(false));
  });

  // ReportConfirm.md:15 — the day's reports spent (FC-G15).
  it("a_rate_limited_report_answers_with_the_no_answer_snackbar", async () => {
    const report = reportHandler("rate-limited");
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openReport();
    fireEvent.click(screen.getByTestId("feed.reportSheet.report"));
    expect(await screen.findByTestId("feed.snackbar.message")).toHaveTextContent(
      "That didn't send. Try again.",
    );
    expect(sheet.open).toBe(true);
    expect(snackbar()).not.toHaveTextContent("Reported.");
  });

  // ReportConfirm.md:15 — the thing gone (FC-G15).
  it("a_refused_report_keeps_the_sheet_and_snackbars_that_didnt_send", async () => {
    const report = reportHandler("not-found");
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openReport();
    fireEvent.click(screen.getByTestId("feed.reportSheet.report"));
    expect(await screen.findByTestId("feed.snackbar.message")).toHaveTextContent(
      "That didn't send. Try again.",
    );
    expect(sheet.open).toBe(true);
  });

  // ReportConfirm.md:13 — no answer reaches the device.
  it("a_report_with_no_answer_keeps_the_sheet_and_snackbars_that_didnt_send", async () => {
    const report = reportHandler("no-answer");
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openReport();
    fireEvent.click(screen.getByTestId("feed.reportSheet.report"));
    expect(await screen.findByTestId("feed.snackbar.message")).toHaveTextContent(
      "That didn't send. Try again.",
    );
    expect(sheet.open).toBe(true);
  });

  // ReportConfirm.md:21
  it("a_guest_report_asks_to_join_and_never_raises_the_confirm", async () => {
    const report = reportHandler(sent);
    server.use(
      ...rankedFeed([post("p1")]),
      report.handler,
      // A guest reads the genesis vantage's feed.
      gqlLink.query("BorrowedView", () =>
        HttpResponse.json({
          data: {
            borrowedView: {
              __typename: "User",
              id: "genesis-id",
              handle: "genesis_mod",
              displayName: { __typename: "ModeratedText", value: "Genesis Moderator" },
              avatar: null,
            },
          },
        }),
      ),
    );
    renderWithProviders(<FeedView />);
    await openMenu();
    fireEvent.click(screen.getByTestId("feed.menuSheet.report"));
    expect(await screen.findByTestId("join-prompt")).toBeInTheDocument();
    expect((screen.getByTestId("feed.reportSheet") as HTMLDialogElement).open).toBe(false);
    expect(report.targets).toEqual([]);
  });

  // FeedPostMenu.md:25
  it("the_scrim_closes_the_menu_and_nothing_changes", async () => {
    const report = reportHandler(sent);
    server.use(...rankedFeed([post("p1")]), report.handler);
    renderWithProviders(<FeedView />, { store: signedInStore() });
    const sheet = await openMenu();
    // A press on the dialog itself is a press on its backdrop.
    fireEvent.click(sheet);
    await waitFor(() => expect(sheet.open).toBe(false));
    expect(push).not.toHaveBeenCalled();
    expect(report.targets).toEqual([]);
    expect(snackbar()).not.toBeInTheDocument();
  });

  // RM-G9's build word (the own menu off the detail is undrawn): Remove from
  // a feed card raises the same think-twice dialog over the feed, and a taken
  // removal leaves the card standing as its mark in place — RemoveConfirm.md:11,
  // "NEVER the post leaves without a mark".
  it("the_authors_remove_leaves_the_card_standing_as_its_mark_in_place", async () => {
    const at = new Date(Date.now() - 60_000).toISOString();
    const removals: string[] = [];
    server.use(
      ...rankedFeed([post("p1", "acct-1"), post("p2")]),
      gqlLink.mutation("RemoveContent", ({ variables }) => {
        removals.push(variables.record as string);
        return HttpResponse.json({
          data: {
            removeContent: { __typename: "RemoveContentPayload", records: [], userErrors: [] },
          },
        });
      }),
      gqlLink.query("PostRemoval", ({ variables }) =>
        HttpResponse.json({
          data: {
            post: { __typename: "Post", id: variables.id, removal: { __typename: "Removal", at, by: "AUTHOR" } },
          },
        }),
      ),
    );
    renderWithProviders(<FeedView />, { store: signedInStore() });
    await openMenu();
    fireEvent.click(screen.getByTestId("feed-menu-remove"));
    fireEvent.click(await screen.findByTestId("feed-menu-remove-confirm-remove"));
    const mark = await screen.findByTestId(byNode("feed.card.removed", "p1"));
    expect(mark).toHaveTextContent("Removed by its author");
    expect(screen.getByTestId(byNode("feed.card.removed.when", "p1"))).toHaveTextContent("1m");
    expect(removals).toEqual(["rec-genesis"]);
    // In place: the card stands where it stood, its neighbour untouched.
    const cards = screen.getAllByTestId(byNode("feed.card"));
    expect(cards[0]).toHaveAttribute("data-testid-key", "p1");
    expect(screen.getByTestId(byNode("feed.card", "p2"))).toHaveTextContent("body of p2");
    // A removed post has no menu left.
    expect(screen.queryByTestId(byNode("feed.card.menu", "p1"))).not.toBeInTheDocument();
  });
});
