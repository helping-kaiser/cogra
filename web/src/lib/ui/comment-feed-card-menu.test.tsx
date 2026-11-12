// THE COMMENT CARD'S ⋮ OFF THE THREAD (round 41): History, Saved and the
// profile's Comments tab each raise the comment's menu over themselves,
// unstacked, wearing their own `menuSheet` paths. The sidecars' lines, per
// host: HistoryCommentMenu(Own).md, SavedCommentMenu.md,
// ProfileCommentsMenu(Own).md, with CommentMenu(Own).md, ReportConfirm.md and
// GuestGate.md for what every host shares.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMMENT_SETTLING, CommentEditDoor, type CommentEditRequest } from "@/lib/compose/comment-edit-door";
import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { gqlLink, startMswServer } from "@/test/msw";
import { answersComment, profileComment } from "@/test/profile-comment";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import { stanceHandlers } from "@/test/stance";
import { CommentFeedCard, type CommentFeedView } from "./comment-feed-card";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/history",
}));

const server = startMswServer(...stanceHandlers());

const moderated = (value: string) => ({ __typename: "ModeratedText", value, status: "NORMAL" });

/** The reader, signed in; `u-ada` is the comment's author. */
function signedIn(account: string) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: account });
  return store;
}

type Host = "history" | "saved" | "profile";

const CARD: Record<Host, string> = {
  history: "history.commentCard",
  saved: "saved.commentCard",
  profile: "profile.comments.commentCard",
};

function mount({
  host = "history",
  reader = "u-reader",
  over = {},
  notify = () => {},
  editor,
}: {
  host?: Host;
  /** The reader's account; null is a guest. */
  reader?: string | null;
  over?: Record<string, unknown>;
  notify?: (message: string) => void;
  /** A stand-in for the shell's editor, to drive its two exits. */
  editor?: (request: CommentEditRequest) => ReactNode;
}) {
  const comment = profileComment("c1", over) as unknown as CommentFeedView;
  const card = (
    <CommentFeedCard
      comment={comment}
      from={host}
      testId="card"
      node={{ path: CARD[host], key: "c1" }}
      shape={host === "profile" ? "line" : "thread"}
      onNotify={notify}
      onLinkCopied={() => {}}
    />
  );
  return renderWithProviders(
    editor === undefined ? card : <CommentEditDoor editor={editor}>{card}</CommentEditDoor>,
    {
      store: reader === null ? createTokenStore() : signedIn(reader),
      writeSigner: fakeWriteSigner(),
    },
  );
}

async function openMenu(host: Host = "history"): Promise<HTMLElement> {
  fireEvent.click(await screen.findByTestId(byNode(`${CARD[host]}.menu`, "c1")));
  return screen.getByTestId(`${host}.menuSheet`);
}

const rowIds = (sheet: HTMLElement) =>
  within(sheet)
    .getAllByRole("button")
    .map((row) => row.getAttribute("data-testid"));

function reportHandler(answer: "sent" | "refused") {
  const targets: string[] = [];
  return {
    targets,
    handler: gqlLink.mutation("SendReport", ({ variables }) => {
      targets.push(variables.target as string);
      return HttpResponse.json({
        data: {
          sendReport: {
            __typename: "SendReportPayload",
            reportedAt: answer === "sent" ? "2026-11-12T12:00:00Z" : null,
            userErrors:
              answer === "sent"
                ? []
                : [{ __typename: "UserError", code: "NOT_FOUND", message: "gone", field: ["target"] }],
          },
        },
      });
    }),
  };
}

beforeEach(() => {
  routerPush.mockClear();
  window.localStorage.clear();
});

describe("the comment card's menu reads its host's rows", () => {
  // HistoryCommentMenu.md:5, SavedCommentMenu.md:5, ProfileCommentsMenu.md:5 —
  // Save or Unsave, Cite, Cited by, Opinions on this, License terms, Report.
  it.each<Host>(["history", "saved", "profile"])(
    "someone_elses_comment_on_%s_reads_save_cite_citedBy_opinions_license_report_as_its_menuSheet_rows",
    async (host) => {
      mount({ host });
      const sheet = await openMenu(host);
      expect(rowIds(sheet)).toEqual([
        `${host}.menuSheet.save`,
        `${host}.menuSheet.cite`,
        `${host}.menuSheet.citedBy`,
        `${host}.menuSheet.opinions`,
        `${host}.menuSheet.license`,
        `${host}.menuSheet.report`,
      ]);
      expect(within(sheet).getAllByRole("button").map((row) => row.textContent)).toEqual([
        "Save",
        "Cite in a new post",
        "Cited by",
        "Opinions on this",
        "License terms",
        "Report",
      ]);
      // CommentMenu.md:9 — no Hide row.
      expect(within(sheet).queryByText(/^Hide/)).toBeNull();
      expect(sheet).toHaveAccessibleName("Comment actions");
    },
  );

  // HistoryCommentMenuOwn.md:5, ProfileCommentsMenuOwn.md:5 — Edit, then
  // Remove, after Cite; no Report row.
  it.each<Host>(["history", "profile"])(
    "your_own_comment_on_%s_reads_save_cite_edit_remove_citedBy_opinions_license_and_no_report",
    async (host) => {
      mount({ host, reader: "u-ada" });
      const sheet = await openMenu(host);
      expect(rowIds(sheet)).toEqual([
        `${host}.menuSheet.save`,
        `${host}.menuSheet.cite`,
        `${host}.menuSheet.edit`,
        `${host}.menuSheet.remove`,
        `${host}.menuSheet.citedBy`,
        `${host}.menuSheet.opinions`,
        `${host}.menuSheet.license`,
      ]);
      expect(within(sheet).queryByText("Report")).toBeNull();
    },
  );

  // SavedCommentMenu.md:5 — the comment kept, its first row reads Unsave.
  it("a_kept_comment_on_saved_leads_with_unsave", async () => {
    mount({ host: "saved", over: { viewerBookmarkedAt: "2026-11-01T00:00:00Z" } });
    const sheet = await openMenu("saved");
    expect(within(sheet).getByTestId("saved.menuSheet.save")).toHaveTextContent("Unsave");
  });

  // Every card mounts its own sheet, and one registered node names one open
  // sheet: the nodes are worn only while the sheet is up.
  it("the_closed_sheet_wears_no_registered_node", async () => {
    mount({});
    await screen.findByTestId(byNode("history.commentCard.menu", "c1"));
    expect(screen.queryByTestId("history.menuSheet")).toBeNull();
    expect(screen.getByTestId("card-menu-sheet")).toBeInTheDocument();
  });

  // CommentMenuOwn.md:11 — no comment's card carries an Edit button.
  it("no_comment_card_carries_an_edit_button", async () => {
    mount({ reader: "u-ada" });
    await screen.findByTestId(byNode("history.commentCard.menu", "c1"));
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });
});

describe("Report on a comment off the thread", () => {
  // HistoryCommentMenu.md:17, SavedCommentMenu.md:17, ProfileCommentsMenu.md:17
  // — the menu closes, the confirm rises over the host titled Report this
  // comment?, and NEVER anything is sent yet.
  it.each<Host>(["history", "saved", "profile"])(
    "report_on_%s_closes_the_menu_and_raises_the_confirm_sending_nothing",
    async (host) => {
      const report = reportHandler("sent");
      server.use(report.handler);
      mount({ host });
      const sheet = await openMenu(host);
      fireEvent.click(within(sheet).getByTestId(`${host}.menuSheet.report`));
      const confirm = await screen.findByTestId("card-report-sheet");
      expect(confirm).toHaveAccessibleName("Report this comment?");
      expect((confirm as HTMLDialogElement).open).toBe(true);
      expect(screen.queryAllByTestId(`${host}.menuSheet`).some((d) => (d as HTMLDialogElement).open)).toBe(false);
      expect(screen.getByTestId("card-report-sheet-text")).toHaveTextContent(
        "It goes to the people who run CoGra for a look.",
      );
      expect(report.targets).toEqual([]);
    },
  );

  // ReportConfirm.md:11 — the sheet closes, the report goes out, Reported.
  it("the_confirms_report_sends_once_and_the_hosts_snackbar_reads_reported", async () => {
    const report = reportHandler("sent");
    server.use(report.handler);
    const notify = vi.fn();
    mount({ notify });
    fireEvent.click(within(await openMenu()).getByTestId("history.menuSheet.report"));
    fireEvent.click(await screen.findByTestId("card-report-sheet-report"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Reported."));
    expect(report.targets).toEqual(["c1"]);
    expect((screen.getByTestId("card-report-sheet") as HTMLDialogElement).open).toBe(false);
  });

  // ReportConfirm.md:15 — refused: the sheet stays, NEVER Reported.
  it("a_refused_report_keeps_the_sheet_and_never_reads_reported", async () => {
    server.use(reportHandler("refused").handler);
    const notify = vi.fn();
    mount({ notify });
    fireEvent.click(within(await openMenu()).getByTestId("history.menuSheet.report"));
    fireEvent.click(await screen.findByTestId("card-report-sheet-report"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("That didn't send. Try again."));
    expect(notify).not.toHaveBeenCalledWith("Reported.");
    expect((screen.getByTestId("card-report-sheet") as HTMLDialogElement).open).toBe(true);
  });

  // ReportConfirm.md:19 — Cancel: the sheet closes, NEVER anything sent.
  it("cancel_closes_the_confirm_and_sends_nothing", async () => {
    const report = reportHandler("sent");
    server.use(report.handler);
    mount({});
    fireEvent.click(within(await openMenu()).getByTestId("history.menuSheet.report"));
    fireEvent.click(await screen.findByTestId("card-report-sheet-cancel"));
    expect((screen.getByTestId("card-report-sheet") as HTMLDialogElement).open).toBe(false);
    expect(report.targets).toEqual([]);
  });
});

describe("Edit on your own comment off the thread", () => {
  // HistoryCommentMenuOwn.md:7, ProfileCommentsMenuOwn.md:7, CommentMenuOwn.md:13
  // — the menu closes and the comment's edit opens over the host.
  it.each<Host>(["history", "profile"])("edit_on_%s_opens_the_comments_edit_over_the_host", async (host) => {
    mount({ host, reader: "u-ada", over: { content: moderated("old words") } });
    fireEvent.click(within(await openMenu(host)).getByTestId(`${host}.menuSheet.edit`));
    const edit = await screen.findByTestId("comment-edit");
    expect(edit).toHaveAccessibleName("Edit comment");
    expect(screen.getByTestId("commentEdit.words.input")).toHaveValue("old words");
    expect(screen.queryAllByTestId(`${host}.menuSheet`).some((d) => (d as HTMLDialogElement).open)).toBe(false);
    // The host stands beneath: the card is still there.
    expect(screen.getByTestId(byNode(CARD[host], "c1"))).toBeInTheDocument();
  });

  // The editor needs what the comment answers and its thread: a reply names
  // its parent comment, a top-level comment the post.
  it("the_edit_is_handed_the_comment_its_parent_and_its_thread", async () => {
    const asked: CommentEditRequest[] = [];
    mount({
      reader: "u-ada",
      over: { target: answersComment("c0", "mira") },
      editor: (request) => {
        asked.push(request);
        return <div data-testid="stub-editor" />;
      },
    });
    fireEvent.click(within(await openMenu()).getByTestId("history.menuSheet.edit"));
    await screen.findByTestId("stub-editor");
    expect(asked[0]).toMatchObject({ parentId: "c0", postId: "p1", targetLabel: "@mira's comment" });
    expect(asked[0]!.comment.id).toBe("c1");
  });

  // Leaving the edit returns to the host as it was, nothing kept.
  it("leaving_the_edit_returns_to_the_host_and_says_nothing", async () => {
    const notify = vi.fn();
    mount({
      reader: "u-ada",
      notify,
      editor: ({ onLeave }) => (
        <button type="button" data-testid="stub-leave" onClick={onLeave}>
          leave
        </button>
      ),
    });
    fireEvent.click(within(await openMenu()).getByTestId("history.menuSheet.edit"));
    fireEvent.click(await screen.findByTestId("stub-leave"));
    expect(screen.queryByTestId("stub-leave")).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  // Seam 316 item 7, design's lean (a) at jakob as question 21: the edit
  // returns to the host it was opened from, the card settling in place with
  // the thread's settling snackbar — NEVER a trip into the thread.
  it("a_signed_edit_settles_the_card_in_place_with_the_settling_snackbar", async () => {
    server.use(
      gqlLink.query("CommentCard", () =>
        HttpResponse.json({
          data: {
            comment: profileComment("c1", {
              content: moderated("better words"),
              landing: { __typename: "Landing", state: "PENDING" },
            }),
          },
        }),
      ),
    );
    const notify = vi.fn();
    mount({
      reader: "u-ada",
      notify,
      over: { content: moderated("old words") },
      editor: ({ onSigned }) => (
        <button type="button" data-testid="stub-sign" onClick={onSigned}>
          sign
        </button>
      ),
    });
    fireEvent.click(within(await openMenu()).getByTestId("history.menuSheet.edit"));
    fireEvent.click(await screen.findByTestId("stub-sign"));
    expect(notify).toHaveBeenCalledWith(COMMENT_SETTLING);
    const card = screen.getByTestId(byNode("history.commentCard", "c1"));
    await waitFor(() => expect(card).toHaveTextContent("better words"));
    expect(card).not.toHaveTextContent("old words");
    expect(screen.getByTestId("card-pending")).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe("a guest at the comment card's menu", () => {
  // GuestGate.md:5 — Save, Cite in a new post (and Report, ReportConfirm.md:21)
  // close the menu and raise the ask; NEVER the act happens.
  it.each(["save", "cite", "report"])("a_guests_%s_raises_the_join_ask", async (row) => {
    const report = reportHandler("sent");
    server.use(report.handler);
    mount({ host: "profile", reader: null });
    fireEvent.click(within(await openMenu("profile")).getByTestId(`profile.menuSheet.${row}`));
    expect(await screen.findByTestId("join-prompt")).toHaveTextContent("Join the conversation");
    expect(screen.queryByTestId("card-report-sheet")).toBeNull();
    expect(routerPush).not.toHaveBeenCalled();
    expect(report.targets).toEqual([]);
  });

  // GuestGate.md:7 — License terms opens without the ask; seam 316 item 8,
  // design's lean (b) at jakob as question 22 — the two read-only rows too.
  it.each(["citedBy", "opinions", "license"])("a_guests_%s_opens_without_the_ask", async (row) => {
    mount({ host: "profile", reader: null });
    fireEvent.click(within(await openMenu("profile")).getByTestId(`profile.menuSheet.${row}`));
    expect(screen.queryByTestId("join-prompt")).toBeNull();
  });
});
