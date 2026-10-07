import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ChangeHandleView } from "./change-handle-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const server = startMswServer();

function account() {
  return graphql.query("SettingsAccount", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "sol",
          email: "sol@solferreira.art",
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
  );
}

function answer(body: Record<string, unknown> | "offline", wait = 0) {
  return graphql.mutation("ChangeHandle", async () => {
    if (wait > 0) await delay(wait);
    if (body === "offline") return HttpResponse.error();
    return HttpResponse.json({ data: { changeHandle: { __typename: "ChangeHandlePayload", ...body } } });
  });
}

const CHANGED = {
  user: { __typename: "User", id: "u1", handle: "solferreira" },
  userErrors: [],
};

function renderPage() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return renderWithProviders(<ChangeHandleView />, { store });
}

const field = () => screen.getByTestId("changeHandle.handle.input");
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const press = () => fireEvent.click(screen.getByTestId("changeHandle.commit.action"));

beforeEach(() => {
  push.mockReset();
  server.use(account());
});

describe("ChangeHandle", () => {
  it("names the handle being left, and asks for no password", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("changeHandle.body")).toHaveTextContent(
        "@sol is how people mention and find you.",
      ),
    );
    expect(screen.getByTestId("changeHandle.handle.support")).toHaveTextContent(
      "3 to 30 characters: letters, numbers and underscore. Handles are always lowercase.",
    );
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(field()).toHaveAttribute("autocomplete", "nickname");
    expect(field()).toHaveAttribute("enterkeyhint", "go");
  });

  it("change_handle_waits_for_a_character", () => {
    renderPage();
    expect(screen.getByTestId("changeHandle.commit.action")).toBeDisabled();
    expect(screen.getByTestId("changeHandle.commit.reason")).toHaveTextContent("Waiting for a new handle");
    type("s");
    expect(screen.getByTestId("changeHandle.commit.action")).toBeEnabled();
  });

  it("malformed_handle_reads_the_format_line_and_never_opens_the_dialog", () => {
    renderPage();
    type("ab");
    press();
    expect(screen.getByTestId("changeHandle.handle.support")).toHaveTextContent(
      "A handle is 3–30 characters: a–z, 0–9, _.",
    );
    expect(screen.queryByTestId("changeHandle.dialog")).not.toBeInTheDocument();
  });

  it("format_line_rechecks_live", () => {
    renderPage();
    type("a-b");
    press();
    expect(screen.getByTestId("changeHandle.handle.support")).toHaveTextContent("A handle is 3–30");
    type("solferreira");
    expect(screen.getByTestId("changeHandle.handle.support")).toHaveTextContent("Handles are always lowercase.");
  });

  it("well_formed_handle_opens_the_dialog_naming_it", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("changeHandle.body")).toHaveTextContent("@sol"));
    type("SolFerreira");
    press();
    const dialog = screen.getByTestId("changeHandle.dialog");
    expect(within(dialog).getByTestId("changeHandle.dialog.title")).toHaveTextContent(
      "Change your handle to @solferreira?",
    );
    expect(within(dialog).getByTestId("changeHandle.dialog.body")).toHaveTextContent(
      "Links to @sol stop working the moment it changes, and anyone can claim @sol afterwards.",
    );
    expect(within(dialog).getByTestId("changeHandle.dialog.change")).toHaveTextContent("Change it");
    expect(within(dialog).getByTestId("changeHandle.dialog.keep")).toHaveTextContent("Keep it");
  });

  it("dialog_focus_moves_to_title_and_stays_inside", () => {
    renderPage();
    type("solferreira");
    press();
    expect(document.activeElement).toBe(screen.getByTestId("changeHandle.dialog.title"));
  });

  it("change_it_locks_the_dialog_until_it_answers and keep_it_scrim_back_escape_are_locked_in_flight", async () => {
    let calls = 0;
    server.use(
      graphql.mutation("ChangeHandle", async () => {
        calls += 1;
        await delay(300);
        return HttpResponse.json({ data: { changeHandle: { __typename: "ChangeHandlePayload", ...CHANGED } } });
      }),
    );
    renderPage();
    type("solferreira");
    press();
    const change = screen.getByTestId("changeHandle.dialog.change");
    fireEvent.click(change);
    fireEvent.click(change);
    fireEvent.click(screen.getByTestId("changeHandle.dialog.keep"));
    const dialog = screen.getByTestId("changeHandle.dialog");
    fireEvent.click(dialog);
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(screen.getByTestId("changeHandle.dialog")).toBeInTheDocument();
    expect(change).toBeEnabled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=handle"));
    expect(calls).toBe(1);
  });

  it("changing_handle_label_only_after_200ms", async () => {
    server.use(answer(CHANGED, 400));
    renderPage();
    type("solferreira");
    press();
    fireEvent.click(screen.getByTestId("changeHandle.dialog.change"));
    expect(screen.getByTestId("changeHandle.dialog.change")).toHaveTextContent("Change it");
    await waitFor(() =>
      expect(screen.getByTestId("changeHandle.dialog.change")).toHaveTextContent("Changing handle…"),
    );
  });

  it("taken_handle_closes_the_dialog_onto_the_field_line", async () => {
    server.use(
      answer({
        user: null,
        userErrors: [{ __typename: "UserError", message: "x", code: "HANDLE_TAKEN", field: ["handle"] }],
      }),
    );
    renderPage();
    type("taken");
    press();
    fireEvent.click(screen.getByTestId("changeHandle.dialog.change"));
    await waitFor(() => expect(screen.queryByTestId("changeHandle.dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("changeHandle.handle.support")).toHaveTextContent("That handle is taken.");
    expect(field()).toHaveValue("taken");
    expect(push).not.toHaveBeenCalled();
  });

  it("offline_change_it_reads_retry_with_the_line_in_the_dialog", async () => {
    server.use(answer("offline"));
    renderPage();
    type("solferreira");
    press();
    fireEvent.click(screen.getByTestId("changeHandle.dialog.change"));
    expect(await screen.findByTestId("changeHandle-dialog-fault")).toHaveTextContent(
      "That didn't send. Try again.",
    );
    expect(screen.getByTestId("changeHandle.dialog.change")).toHaveTextContent("Retry");
    expect(screen.getByTestId("changeHandle.dialog")).toBeInTheDocument();
  });

  it("keep_it_closes_onto_the_form_with_the_handle_still_typed", async () => {
    renderPage();
    type("solferreira");
    press();
    fireEvent.click(screen.getByTestId("changeHandle.dialog.keep"));
    expect(screen.queryByTestId("changeHandle.dialog")).not.toBeInTheDocument();
    expect(field()).toHaveValue("solferreira");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("changeHandle.commit.action")));
  });

  it("success_returns_with_your_handle_is_now_snackbar", async () => {
    server.use(answer(CHANGED));
    renderPage();
    type("solferreira");
    press();
    fireEvent.click(screen.getByTestId("changeHandle.dialog.change"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=handle"));
  });
});
