// THE THINK-TWICE DIALOG, compiled 1:1 from its sidecars:
// design/designs/canonical/behavior/RemoveConfirm.md:3-17 and
// CommentRemoveConfirm.md:3-17. The removal runs against MSW — taken, refused,
// lost, answered `records: []` for a node still settling, and slow.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { RemoveConfirm, type RemoveKind } from "./remove-confirm";

const REMOVED_AT = "2026-10-28T09:00:00Z";

/** What the server's mutation log holds: one entry per removal sent. */
let sent: { record: string }[] = [];

function taken(records: { id: string; redactedAt: string }[] = [{ id: "rec-p1", redactedAt: REMOVED_AT }]) {
  return gqlLink.mutation("RemoveContent", ({ variables }) => {
    sent.push({ record: variables.record as string });
    return HttpResponse.json({
      data: {
        removeContent: {
          __typename: "RemoveContentPayload",
          records: records.map((record) => ({
            __typename: "Record",
            id: record.id,
            payloadState: "REDUCED",
            redactedAt: record.redactedAt,
          })),
          userErrors: [],
        },
      },
    });
  });
}

/** The node's own re-read, answering its mark. */
function reread(kind: "post" | "comment", at = REMOVED_AT, by = "AUTHOR") {
  const typename = kind === "post" ? "Post" : "Comment";
  return gqlLink.query(kind === "post" ? "PostRemoval" : "CommentRemoval", ({ variables }) =>
    HttpResponse.json({
      data: {
        [kind]: { __typename: typename, id: variables.id, removal: { __typename: "Removal", at, by } },
      },
    }),
  );
}

const server = startMswServer(reread("post"), reread("comment"));

function storeFor(accountId: string) {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId });
  return store;
}

function mount(kind: RemoveKind = "post") {
  sent = [];
  const onClose = vi.fn();
  const onRemoved = vi.fn();
  renderWithProviders(
    <RemoveConfirm
      kind={kind}
      nodeId={kind === "post" ? "p1" : "c1"}
      record={kind === "post" ? "rec-p1" : "rec-c1"}
      onClose={onClose}
      onRemoved={onRemoved}
      testId="remove"
    />,
    { store: storeFor("u1") },
  );
  return { onClose, onRemoved };
}

const removeButton = () => screen.getByTestId("remove-remove");
const keepButton = () => screen.getByTestId("remove-keep");

describe("RemoveConfirm (RemoveConfirm.md)", () => {
  // :3 ALWAYS Keep it is the filled answer and Remove the quiet one
  it("fills Keep it and draws Remove as a text button", () => {
    mount();
    expect(keepButton()).toHaveTextContent("Keep it");
    expect(keepButton().className).toContain("bg-primary");
    expect(removeButton()).toHaveTextContent("Remove");
    expect(removeButton().className).not.toContain("bg-primary");
    // The pair's order: the quiet answer first, the filled one where the thumb lands.
    expect(removeButton().compareDocumentPosition(keepButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // :5 ALWAYS Remove carries no error colour
  it("gives Remove no error colour", () => {
    mount();
    expect(removeButton().className).not.toMatch(/error/);
    expect(removeButton().innerHTML).not.toMatch(/error/);
  });

  it("says the board's words, verbatim", () => {
    mount();
    const dialog = screen.getByTestId("remove");
    expect(dialog).toHaveAccessibleName("Remove this post?");
    expect(dialog).toHaveTextContent(
      `The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the post's spot in threads stays with it.`,
    );
    expect(dialog).toHaveTextContent("This is immediate and permanent.");
  });

  // :7 WHEN press Remove -> the dialog stays up on Remove until the removal
  // answers AND Remove refuses a second press AND NEVER Remove dims
  it("stays up while the removal is out, refuses a second press and never dims", async () => {
    let answer: () => void = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    server.use(
      gqlLink.mutation("RemoveContent", async ({ variables }) => {
        sent.push({ record: variables.record as string });
        await answered;
        return HttpResponse.json({
          data: { removeContent: { __typename: "RemoveContentPayload", records: [], userErrors: [] } },
        });
      }),
    );
    const { onClose } = mount();
    const atRest = removeButton().className;
    fireEvent.click(removeButton());
    fireEvent.click(removeButton());
    fireEvent.click(removeButton());
    await waitFor(() => expect(sent).toHaveLength(1));
    expect((screen.getByTestId("remove") as HTMLDialogElement).open).toBe(true);
    expect(removeButton()).not.toBeDisabled();
    expect(removeButton()).toHaveAttribute("aria-disabled", "true");
    // Inert, never dimmed: the button wears exactly what it wore at rest.
    expect(removeButton().className).toBe(atRest);
    expect(onClose).not.toHaveBeenCalled();
    answer();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toHaveLength(1);
  });

  // :9 WHEN the removal has not answered 200ms after the press -> Remove
  // reads Removing… AND NEVER a spinner appears
  it("reads Removing… once the removal has waited 200ms, and draws no spinner", async () => {
    server.use(
      gqlLink.mutation("RemoveContent", async () => {
        await delay(600);
        return HttpResponse.json({
          data: { removeContent: { __typename: "RemoveContentPayload", records: [], userErrors: [] } },
        });
      }),
    );
    mount();
    fireEvent.click(removeButton());
    // Within 200ms the label has not moved.
    expect(removeButton()).toHaveTextContent("Remove");
    await waitFor(() => expect(removeButton()).toHaveTextContent("Removing…"), { timeout: 550 });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(document.querySelector("[class*='animate-spin']")).toBeNull();
  });

  // :11 WHEN the removal is taken -> the post stands as its mark AND NEVER
  // the post leaves without a mark
  it("hands the host the node's re-read mark before it closes", async () => {
    server.use(taken());
    const { onClose, onRemoved } = mount();
    fireEvent.click(removeButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toEqual([{ record: "rec-p1" }]);
    expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ at: REMOVED_AT, by: "AUTHOR" }));
    // The mark reached the host BEFORE the dialog let go of the surface.
    expect(onRemoved.mock.invocationCallOrder[0]!).toBeLessThan(onClose.mock.invocationCallOrder[0]!);
  });

  // A still-settling post answers `records: []` with no error (api-spec.md):
  // the removal is taken, and the node's own re-read carries its mark.
  it("takes a removal answered with no landed records", async () => {
    server.use(taken([]), reread("post", "2026-10-28T09:05:00Z"));
    const { onRemoved, onClose } = mount();
    fireEvent.click(removeButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ at: "2026-10-28T09:05:00Z" }));
    expect(screen.queryByTestId("remove-failed")).not.toBeInTheDocument();
  });

  // The re-read lost: the mark is stamped from the removal's own answer —
  // never no mark at all.
  it("stamps the mark from the removal's answer when the re-read is lost", async () => {
    server.use(taken(), gqlLink.query("PostRemoval", () => HttpResponse.error()));
    const { onRemoved } = mount();
    fireEvent.click(removeButton());
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
    expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ at: REMOVED_AT, by: "AUTHOR" }));
  });

  // :13 WHEN the removal does not go through -> the dialog stays up with its
  // pair AND the line That didn't send. Try again. stands in it AND Remove
  // reads Retry AND the post is not removed
  const refusal = () =>
    HttpResponse.json({
      data: {
        removeContent: {
          __typename: "RemoveContentPayload",
          records: [],
          userErrors: [{ __typename: "UserError", code: "FORBIDDEN", message: "not the author", field: null }],
        },
      },
    });
  it.each([
    ["the answer is lost", "lost"],
    ["the server refuses", "refused"],
  ] as const)("keeps the dialog up with the line and Retry when %s", async (_, how) => {
    server.use(
      gqlLink.mutation("RemoveContent", () => (how === "lost" ? HttpResponse.error() : refusal())),
    );
    const { onClose, onRemoved } = mount();
    fireEvent.click(removeButton());
    expect(await screen.findByTestId("remove-failed")).toHaveTextContent("That didn't send. Try again.");
    expect(removeButton()).toHaveTextContent("Retry");
    expect(keepButton()).toHaveTextContent("Keep it");
    expect((screen.getByTestId("remove") as HTMLDialogElement).open).toBe(true);
    expect(onRemoved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // The line stands above the pair (SeveranceConfirm's placement).
    expect(
      screen.getByTestId("remove-failed").compareDocumentPosition(removeButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("asks the same removal again from Retry", async () => {
    server.use(gqlLink.mutation("RemoveContent", () => HttpResponse.error()));
    const { onRemoved } = mount();
    fireEvent.click(removeButton());
    await screen.findByTestId("remove-failed");
    server.use(taken());
    fireEvent.click(removeButton());
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
    expect(sent).toEqual([{ record: "rec-p1" }]);
  });

  // :15 WHEN press Keep it -> the dialog closes AND nothing is removed
  it("closes on Keep it and removes nothing", async () => {
    server.use(taken());
    const { onClose, onRemoved } = mount();
    fireEvent.click(keepButton());
    expect(onClose).toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  // :17 WHEN tap the scrim -> the dialog closes AND nothing is removed
  it("closes on the scrim and removes nothing", () => {
    server.use(taken());
    const { onClose, onRemoved } = mount();
    // A press on the dialog element itself, outside its content, is the scrim.
    fireEvent.click(screen.getByTestId("remove"));
    expect(onClose).toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});

describe("CommentRemoveConfirm (CommentRemoveConfirm.md)", () => {
  // :3 ALWAYS the dialog is titled Remove this comment?
  it("is titled Remove this comment? and says the comment's nouns", () => {
    mount("comment");
    const dialog = screen.getByTestId("remove");
    expect(dialog).toHaveAccessibleName("Remove this comment?");
    expect(dialog).toHaveTextContent(
      `The words and pictures leave every reader's view, along with every earlier version's. A visible mark stays in their place — "Removed by its author" — and the comment's spot in its thread stays with it.`,
    );
  });

  // :5 ALWAYS Keep it is the filled answer and Remove a text button in no colour
  it("fills Keep it and leaves Remove a text button in no colour", () => {
    mount("comment");
    expect(keepButton().className).toContain("bg-primary");
    expect(removeButton().className).not.toMatch(/error|bg-primary/);
  });

  // :11 WHEN the removal is taken -> the dialog closes AND the mark takes the
  // comment's place
  it("removes the comment's chain and hands back its mark", async () => {
    server.use(taken([{ id: "rec-c1", redactedAt: REMOVED_AT }]));
    const { onClose, onRemoved } = mount("comment");
    fireEvent.click(removeButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(sent).toEqual([{ record: "rec-c1" }]);
    expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ by: "AUTHOR" }));
  });

  // :13 WHEN the removal does not go through -> the dialog stays up with its
  // pair AND its commitment reads Retry AND NEVER the comment is marked
  // removed — and the post's fault line stands in it too (RM-G7's build word).
  it("keeps the dialog up with Retry, and the line, when the removal does not go through", async () => {
    server.use(gqlLink.mutation("RemoveContent", () => HttpResponse.error()));
    const { onRemoved } = mount("comment");
    fireEvent.click(removeButton());
    expect(await screen.findByTestId("remove-failed")).toHaveTextContent("That didn't send. Try again.");
    expect(removeButton()).toHaveTextContent("Retry");
    expect(onRemoved).not.toHaveBeenCalled();
  });

  // :15/:17 Keep it and the scrim close it and nothing is removed.
  it("closes on Keep it and on the scrim without removing", () => {
    const { onClose } = mount("comment");
    fireEvent.click(keepButton());
    fireEvent.click(screen.getByTestId("remove"));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(sent).toEqual([]);
  });
});
