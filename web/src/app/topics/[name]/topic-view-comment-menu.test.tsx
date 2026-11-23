// A TAGGED COMMENT'S ⋮ ON THE TAG PAGE RAISES THE COMMENT'S WHOLE MENU (design
// round 60; seam 392 point 1). The four boards' sidecars, line for line:
// TagPageCommentMenu.md, TagPageCommentMenuOwn.md, TagPageCommentRemovedMenu.md
// and TagPageCommentRemovedMenuOwn.md. Each test is named after its line and
// cites it. The sheet is `tagPage.menuSheet`; its rows are the comment menu
// every host shares (`comment-menu.ts`), worn under the tag page's nodes.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentEditDoor, type CommentEditRequest } from "@/lib/compose/comment-edit-door";
import { writeCommittedFeedFilter } from "@/lib/feed/committed-filter";
import { FEED_FILTER_DEFAULT } from "@/lib/feed/feed-filter";
import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { gqlLink, startMswServer } from "@/test/msw";
import { answersPost, profileComment, taggedCommentWire } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { bookmarkHandlers, bookmarkLog } from "@/test/saved";
import { stanceHandlers } from "@/test/stance";
import { tagPageHandlers } from "@/test/tag-page";
import { TopicView } from "./topic-view";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const server = startMswServer(...stanceHandlers());

const READER = "u-reader";
const ADA = { __typename: "User", id: "u-ada", handle: "ada", displayName: { __typename: "ModeratedText", value: "Ada Okonkwo" }, avatar: null };
const SOL = { __typename: "User", id: READER, handle: "sol", displayName: { __typename: "ModeratedText", value: "Sol Ferreira" }, avatar: null };

const moderated = (value: string | null, status = "NORMAL") => ({ __typename: "ModeratedText", value, status });

type Whose = "other" | "own";
type Removal = "author" | "proposal" | null;

/** The board's tagged comment: @ada's (someone else's) or @sol's (the reader's own). */
function taggedComment(whose: Whose, removed: Removal) {
  return taggedCommentWire("c1", {
    author: whose === "own" ? SOL : ADA,
    content: removed === null ? moderated("Low tide is kinder to the rubbings than noon ever was.") : moderated(null, "REDACTED"),
    removal:
      removed === null
        ? null
        : { __typename: "Removal", at: "2026-11-20T08:00:00Z", by: removed === "author" ? "AUTHOR" : "MODERATION" },
    target: answersPost("p1", "Salt maps of the coast road", "sol"),
    post: { __typename: "Post", id: "p1" },
  });
}

function serveTag(whose: Whose, removed: Removal = null) {
  server.use(
    ...tagPageHandlers({
      __typename: "Hashtag",
      id: "ht-1",
      name: moderated("saltmaps"),
      moderationStatus: "NORMAL",
      taggedContent: [{ relevance: 0.4, confidence: 0.9, pending: false, node: taggedComment(whose, removed) }],
    }),
  );
  // A removed comment stands on the page only while the feed's Removed is on
  // (TagPage.md:23-25), which is where these boards draw it.
  if (removed !== null) writeCommittedFeedFilter(READER, { ...FEED_FILTER_DEFAULT, also: ["settling", "removed"] });
}

function mount(editor?: (request: CommentEditRequest) => ReactNode) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: READER });
  const page = <TopicView name="saltmaps" />;
  return renderWithProviders(editor === undefined ? page : <CommentEditDoor editor={editor}>{page}</CommentEditDoor>, {
    store,
    writeSigner: fakeWriteSigner(),
  });
}

async function openMenu(): Promise<HTMLDialogElement> {
  fireEvent.click(await screen.findByTestId(byNode("tagPage.commentCard.menu", "c1")));
  return screen.getByTestId("tagPage.menuSheet") as HTMLDialogElement;
}

const rows = (sheet: HTMLElement) =>
  within(sheet)
    .getAllByRole("button")
    .map((row) => [row.getAttribute("data-testid"), row.textContent]);

/** The menu is closed: its sheet no longer wears the page's node, and the card's own sheet is shut. */
async function menuClosed() {
  await waitFor(() => expect(screen.queryByTestId("tagPage.menuSheet")).toBeNull());
  // The sheet's exit is drawn: the dialog closes once it has run.
  await waitFor(() => expect((screen.getByTestId("topic-comment-c1-menu-sheet") as HTMLDialogElement).open).toBe(false));
}

/** The page beneath: the comment's row, its claim above it. */
function pageStands() {
  expect(screen.getByTestId(byNode("tagPage.claim", "c1"))).toBeInTheDocument();
  expect(screen.getByTestId(byNode("tagPage.commentCard", "c1"))).toBeInTheDocument();
  expect(screen.getByTestId("tagPage.header")).toBeInTheDocument();
}

const openDialogs = () => [...document.querySelectorAll("dialog")].filter((dialog) => dialog.open);

beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
});

// The scrim, a swipe down, system Back and Escape all close a menu sheet the
// same way (`BottomSheet`: the drag's drop and the dialog's own cancel each
// report the reader's close, `bottom-sheet.test.tsx`); here the scrim and
// Escape stand for them on the tag page, and nothing changes.
async function closesAndNothingChanges(whose: Whose, removed: Removal) {
  const log = hiddenLog();
  const kept = bookmarkLog();
  server.use(...hiddenHandlers(log), ...bookmarkHandlers(kept));
  serveTag(whose, removed);
  mount();
  // The scrim: a press on the dialog itself is a press on its backdrop.
  fireEvent.click(await openMenu());
  await menuClosed();
  // Escape: the platform closes the dialog.
  const again = await openMenu();
  act(() => again.close());
  await menuClosed();
  pageStands();
  expect(push).not.toHaveBeenCalled();
  expect(log.hides).toEqual([]);
  expect(kept.sets).toEqual([]);
  expect(screen.queryByTestId("tagPage.snackbar.message")).toBeNull();
}

describe("TagPageCommentMenu — someone else's tagged comment", () => {
  it("TagPageCommentMenu_3_tap_the_menu_raises_tagPage_menuSheet_over_the_page_unstacked_the_page_unchanged_beneath", async () => {
    serveTag("other");
    mount();
    const sheet = await openMenu();
    expect(sheet.open).toBe(true);
    expect(openDialogs()).toEqual([sheet]);
    pageStands();
  });

  it("TagPageCommentMenu_5_reads_save_cite_hide_ada_citedBy_opinions_license_report_at_the_tail", async () => {
    serveTag("other");
    mount();
    expect(rows(await openMenu())).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.hide", "Hide @ada"],
      ["tagPage.menuSheet.citedBy", "Cited by"],
      ["tagPage.menuSheet.opinions", "Opinions on this"],
      ["tagPage.menuSheet.license", "License terms"],
      ["tagPage.menuSheet.report", "Report"],
    ]);
  });

  it("TagPageCommentMenu_7_hide_closes_the_sheet_the_page_stands_as_it_stood_and_the_snackbar_reads_ada_is_hidden_with_undo_no_confirm", async () => {
    const log = hiddenLog();
    server.use(...hiddenHandlers(log));
    serveTag("other");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.hide"));
    await menuClosed();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    pageStands();
    expect(screen.getByTestId("tagPage.snackbar.message")).toHaveTextContent("@ada is hidden.");
    expect(screen.getByTestId("tagPage.snackbar.action")).toHaveTextContent("Undo");
    await waitFor(() => expect(log.hides).toEqual([{ actor: "u-ada", at: null }]));
  });

  it("TagPageCommentMenu_9_opinions_closes_the_menu_and_the_comments_opinions_sheet_comes_up_over_the_page", async () => {
    serveTag("other");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.opinions"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-opinions-sheet")) as HTMLDialogElement).open).toBe(true);
    pageStands();
  });

  it("TagPageCommentMenu_11_citedBy_closes_the_menu_and_what_cites_the_comment_comes_up_over_the_page", async () => {
    serveTag("other");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.citedBy"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-cited-by-sheet")) as HTMLDialogElement).open).toBe(true);
    pageStands();
  });

  it("TagPageCommentMenu_13_license_closes_the_menu_and_the_comments_terms_come_up_in_a_sheet_over_the_page", async () => {
    serveTag("other");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.license"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-license-sheet")) as HTMLDialogElement).open).toBe(true);
    pageStands();
  });

  it("TagPageCommentMenu_15_report_closes_the_menu_and_the_confirm_rises_titled_report_this_comment_sending_nothing", async () => {
    const reports: unknown[] = [];
    server.use(
      gqlLink.mutation("SendReport", ({ variables }) => {
        reports.push(variables);
        return HttpResponse.json({ data: null });
      }),
    );
    serveTag("other");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.report"));
    await menuClosed();
    const confirm = await screen.findByTestId("topic-comment-c1-report-sheet");
    expect(confirm).toHaveAccessibleName("Report this comment?");
    expect((confirm as HTMLDialogElement).open).toBe(true);
    expect(reports).toEqual([]);
  });

  it("TagPageCommentMenu_17_the_scrim_a_swipe_back_or_escape_close_the_sheet_and_nothing_changes", async () => {
    await closesAndNothingChanges("other", null);
  });
});

describe("TagPageCommentMenuOwn — the reader's own tagged comment", () => {
  it("TagPageCommentMenuOwn_3_tap_the_menu_raises_tagPage_menuSheet_over_the_page_unstacked_the_page_unchanged_beneath", async () => {
    serveTag("own");
    mount(() => null);
    const sheet = await openMenu();
    expect(sheet.open).toBe(true);
    expect(openDialogs()).toEqual([sheet]);
    pageStands();
  });

  it("TagPageCommentMenuOwn_5_reads_save_cite_edit_remove_citedBy_opinions_license_and_no_hide_no_report", async () => {
    serveTag("own");
    mount(() => null);
    const sheet = await openMenu();
    expect(rows(sheet)).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.edit", "Edit"],
      ["tagPage.menuSheet.remove", "Remove"],
      ["tagPage.menuSheet.citedBy", "Cited by"],
      ["tagPage.menuSheet.opinions", "Opinions on this"],
      ["tagPage.menuSheet.license", "License terms"],
    ]);
    expect(within(sheet).queryByTestId("tagPage.menuSheet.hide")).toBeNull();
    expect(within(sheet).queryByTestId("tagPage.menuSheet.report")).toBeNull();
  });

  it("TagPageCommentMenuOwn_7_edit_closes_the_menu_and_the_comments_edit_opens_over_the_page", async () => {
    // The page reads the comment whole (`TaggedComments`), so the edit starts
    // from the card's own comment — its topics and citations — with no read
    // first.
    const asked: CommentEditRequest[] = [];
    let reads = 0;
    server.use(
      gqlLink.query("CommentCard", () => {
        reads += 1;
        return HttpResponse.json({ data: { comment: profileComment("c1", { author: SOL }) } });
      }),
    );
    serveTag("own");
    mount((request) => {
      asked.push(request);
      return <div data-testid="stub-editor" />;
    });
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.edit"));
    await menuClosed();
    expect(await screen.findByTestId("stub-editor")).toBeInTheDocument();
    expect(asked[0]).toMatchObject({ postId: "p1", parentId: null, targetLabel: "Salt maps of the coast road" });
    expect(asked[0]!.comment.id).toBe("c1");
    expect(asked[0]!.comment.topics).toEqual([]);
    expect(asked[0]!.comment.references).toEqual([]);
    expect(reads).toBe(0);
    pageStands();
  });

  it("TagPageCommentMenuOwn_9_remove_closes_the_menu_and_the_think_twice_dialog_comes_up_over_the_page", async () => {
    serveTag("own");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.remove"));
    await menuClosed();
    expect(await screen.findByTestId("topic-comment-c1-remove-confirm")).toHaveAccessibleName("Remove this comment?");
    pageStands();
  });

  it("TagPageCommentMenuOwn_11_opinions_closes_the_menu_and_the_comments_opinions_sheet_comes_up_over_the_page", async () => {
    serveTag("own");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.opinions"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-opinions-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentMenuOwn_13_citedBy_closes_the_menu_and_what_cites_the_comment_comes_up_over_the_page", async () => {
    serveTag("own");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.citedBy"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-cited-by-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentMenuOwn_15_license_closes_the_menu_and_the_comments_terms_come_up_in_a_sheet_over_the_page", async () => {
    serveTag("own");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.license"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-license-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentMenuOwn_17_the_scrim_a_swipe_back_or_escape_close_the_sheet_and_nothing_changes", async () => {
    await closesAndNothingChanges("own", null);
  });
});

describe("TagPageCommentRemovedMenu — someone else's removed tagged comment", () => {
  it("TagPageCommentRemovedMenu_3_tap_the_menu_raises_tagPage_menuSheet_over_the_page_unstacked_the_page_unchanged_beneath", async () => {
    serveTag("other", "author");
    mount();
    const sheet = await openMenu();
    expect(sheet.open).toBe(true);
    expect(openDialogs()).toEqual([sheet]);
    pageStands();
    expect(screen.getByTestId(byNode("tagPage.commentCard.removalMark", "c1"))).toBeInTheDocument();
  });

  it("TagPageCommentRemovedMenu_5_reads_the_readers_comment_menu_whole_save_cite_hide_citedBy_opinions_license_report", async () => {
    serveTag("other", "author");
    mount();
    expect(rows(await openMenu())).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.hide", "Hide @ada"],
      ["tagPage.menuSheet.citedBy", "Cited by"],
      ["tagPage.menuSheet.opinions", "Opinions on this"],
      ["tagPage.menuSheet.license", "License terms"],
      ["tagPage.menuSheet.report", "Report"],
    ]);
  });

  it("TagPageCommentRemovedMenu_7_the_rows_read_the_same_whichever_removed_it_its_author_or_a_passed_proposal", async () => {
    serveTag("other", "author");
    const byAuthor = mount();
    const authorRows = rows(await openMenu());
    byAuthor.unmount();
    window.localStorage.clear();
    serveTag("other", "proposal");
    mount();
    expect(rows(await openMenu())).toEqual(authorRows);
  });

  it("TagPageCommentRemovedMenu_9_save_keeps_the_removed_comment_as_any_comment_is_kept_and_the_sheet_closes", async () => {
    const kept = bookmarkLog();
    server.use(...bookmarkHandlers(kept));
    serveTag("other", "author");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.save"));
    await menuClosed();
    await waitFor(() => expect(kept.sets).toEqual([{ node: "c1", at: null }]));
  });

  it("TagPageCommentRemovedMenu_11_hide_closes_the_sheet_the_mark_stays_in_place_and_the_snackbar_reads_ada_is_hidden_with_undo_no_confirm", async () => {
    const log = hiddenLog();
    server.use(...hiddenHandlers(log));
    serveTag("other", "author");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.hide"));
    await menuClosed();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId(byNode("tagPage.commentCard.removalMark", "c1"))).toHaveTextContent("Removed by its author");
    expect(screen.getByTestId("tagPage.snackbar.message")).toHaveTextContent("@ada is hidden.");
    expect(screen.getByTestId("tagPage.snackbar.action")).toHaveTextContent("Undo");
    await waitFor(() => expect(log.hides).toEqual([{ actor: "u-ada", at: null }]));
  });

  it("TagPageCommentRemovedMenu_13_license_closes_the_menu_and_the_terms_it_was_published_under_come_up_over_the_page", async () => {
    serveTag("other", "author");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.license"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-license-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentRemovedMenu_15_report_closes_the_menu_and_the_confirm_rises_titled_report_this_comment_sending_nothing", async () => {
    const reports: unknown[] = [];
    server.use(
      gqlLink.mutation("SendReport", ({ variables }) => {
        reports.push(variables);
        return HttpResponse.json({ data: null });
      }),
    );
    serveTag("other", "author");
    mount();
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.report"));
    await menuClosed();
    expect(await screen.findByTestId("topic-comment-c1-report-sheet")).toHaveAccessibleName("Report this comment?");
    expect(reports).toEqual([]);
  });

  it("TagPageCommentRemovedMenu_17_the_scrim_a_swipe_back_or_escape_close_the_sheet_and_nothing_changes", async () => {
    await closesAndNothingChanges("other", "author");
  });
});

describe("TagPageCommentRemovedMenuOwn — the reader's own removed tagged comment", () => {
  it("TagPageCommentRemovedMenuOwn_3_tap_the_menu_raises_tagPage_menuSheet_over_the_page_unstacked_the_page_unchanged_beneath", async () => {
    serveTag("own", "author");
    mount(() => null);
    const sheet = await openMenu();
    expect(sheet.open).toBe(true);
    expect(openDialogs()).toEqual([sheet]);
    pageStands();
  });

  it("TagPageCommentRemovedMenuOwn_5_reads_save_cite_citedBy_opinions_license_the_own_menu_less_edit_and_remove", async () => {
    serveTag("own", "author");
    mount(() => null);
    expect(rows(await openMenu())).toEqual([
      ["tagPage.menuSheet.save", "Save"],
      ["tagPage.menuSheet.cite", "Cite in a new post"],
      ["tagPage.menuSheet.citedBy", "Cited by"],
      ["tagPage.menuSheet.opinions", "Opinions on this"],
      ["tagPage.menuSheet.license", "License terms"],
    ]);
  });

  it("TagPageCommentRemovedMenuOwn_7_license_closes_the_menu_and_the_terms_it_was_published_under_come_up_over_the_page", async () => {
    serveTag("own", "author");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.license"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-license-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentRemovedMenuOwn_9_opinions_closes_the_menu_and_the_comments_opinions_sheet_comes_up_over_the_page", async () => {
    serveTag("own", "author");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.opinions"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-opinions-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentRemovedMenuOwn_11_citedBy_closes_the_menu_and_what_cites_the_comment_comes_up_over_the_page", async () => {
    serveTag("own", "author");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.citedBy"));
    await menuClosed();
    expect(((await screen.findByTestId("topic-comment-c1-cited-by-sheet")) as HTMLDialogElement).open).toBe(true);
  });

  it("TagPageCommentRemovedMenuOwn_13_cite_opens_the_post_wizard_as_new_post_does_the_removed_comment_riding_along_unseen", async () => {
    // The wizard opens with the comment staged as its reference — the same
    // door every comment's Cite takes (`comment-menu.ts`); the draft card and
    // the details stage are the wizard's own (wizard-view tests).
    serveTag("own", "author");
    mount(() => null);
    fireEvent.click(within(await openMenu()).getByTestId("tagPage.menuSheet.cite"));
    await menuClosed();
    expect(push).toHaveBeenCalledWith("/compose?reference=c1");
  });

  it("TagPageCommentRemovedMenuOwn_15_the_scrim_a_swipe_back_or_escape_close_the_sheet_and_nothing_changes", async () => {
    await closesAndNothingChanges("own", "author");
  });
});
