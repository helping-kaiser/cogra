// Notifications (Notifications.md, NotificationsEmpty.md; packet
// notifications-list §12.2): one flat list newest first, ten sentences, the
// row dots, the two read marks, the empty state, the faults and the back
// arrow by origin.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bellLit, resetBell, setBell } from "@/lib/notifications/bell";
import { resetMarks } from "@/lib/notifications/marks";
import { notificationsHref, resetNotificationsOrigin } from "@/lib/notifications/origin";
import { NOTIFICATIONS_EMPTY } from "@/lib/notifications/row-content";
import { createTokenStore } from "@/lib/session/token-store";
import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { intersect } from "@/test/media-env";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { NotificationsScreen } from "./notifications-view";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const server = startMswServer();

afterEach(() => {
  resetBell();
  resetMarks();
  resetNotificationsOrigin();
});

const moderated = (value: string | null, status = "NORMAL") => ({ __typename: "ModeratedText", value, status });

const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

function actor(handle: string, name: string) {
  return { __typename: "User", id: `u-${handle}`, handle, displayName: moderated(name), avatar: null };
}

function commentSubject(id: string, words: string) {
  return {
    __typename: "Comment",
    id,
    content: moderated(words),
    attachments: [],
    moderationStatus: "NORMAL",
    sensitiveReason: null,
    author: { __typename: "User", id: "u-ada", handle: "ada" },
    post: {
      __typename: "Post",
      id: "p1",
      title: moderated("The long way home"),
      content: moderated("words"),
      attachments: [],
      author: { __typename: "User", id: "u-me", handle: "me" },
    },
  };
}

type Row = Record<string, unknown> & { id: string };

function row(id: string, kind: string, hoursAgo: number, extra: Record<string, unknown> = {}): Row {
  return {
    __typename: "Notification",
    id,
    kind,
    createdAt: at(hoursAgo),
    readAt: null,
    actor: actor("ada", "Ada Okonkwo"),
    subject: null,
    context: null,
    record: null,
    application: null,
    ...extra,
  };
}

const THREE: Row[] = [
  row("n1", "COMMENT", 1, { subject: commentSubject("c1", "The third headland light is real") }),
  row("n2", "PROFILE_OPINION", 6, {
    actor: actor("sol", "Sol"),
    subject: { __typename: "User", id: "u-sol", handle: "sol" },
    record: { __typename: "Record", id: "act:sol:1:opinion", pDirected: 0.4, pInterest: 0.5 },
  }),
  row("n3", "APPLICATION_APPROVED", 48, { readAt: at(40), actor: actor("mira", "Mira Voss") }),
];

function page(rows: Row[], next = { hasNextPage: false, endCursor: null as string | null }) {
  return {
    me: {
      __typename: "User",
      id: "me",
      notifications: {
        __typename: "NotificationConnection",
        edges: rows.map((node, index) => ({ __typename: "NotificationEdge", cursor: `c${index}`, node })),
        pageInfo: { __typename: "PageInfo", ...next },
      },
    },
  };
}

type Marks = { seen: string[]; read: string[] };

function serve(rows: Row[], marks: Marks = { seen: [], read: [] }) {
  server.use(
    gqlLink.query("Notifications", () => HttpResponse.json({ data: page(rows) })),
    gqlLink.mutation("MarkNotificationsSeen", ({ variables }) => {
      marks.seen.push(variables.through as string);
      return HttpResponse.json({ data: { markNotificationsSeen: { hasUnreadNotifications: false, userErrors: [] } } });
    }),
    gqlLink.mutation("MarkNotificationRead", ({ variables }) => {
      marks.read.push(variables.notification as string);
      return HttpResponse.json({
        data: {
          markNotificationRead: {
            notification: { __typename: "Notification", id: variables.notification, readAt: at(0) },
            userErrors: [],
          },
        },
      });
    }),
  );
  return marks;
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

function rows() {
  return within(screen.getByTestId("notifications.list")).getAllByTestId("notifications.list.notification");
}

describe("NotificationsScreen", () => {
  it("the_list_is_flat_and_newest_first", async () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    expect(rows().map((r) => r.getAttribute("data-testid-key"))).toEqual(["1", "2", "3"]);
    expect(rows().map((r) => within(r).getByTestId("notifications.list.notification.title").textContent)).toEqual([
      "@ada commented on your post",
      "@sol gave an opinion on you",
      "@mira approved your application",
    ]);
    // No grouping, no kind heading, no filter.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("comment_and_reply_rows_carry_the_words_that_arrived", async () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    expect(within(rows()[0]!).getByTestId("notifications.list.notification.second")).toHaveTextContent(
      "The third headland light is real",
    );
    // The opinion row has no second line and no digits.
    expect(within(rows()[1]!).queryByTestId("notifications.list.notification.second")).not.toBeInTheDocument();
    expect(within(rows()[1]!).getByRole("img", { name: /0\.40/ })).toBeInTheDocument();
    expect(rows()[1]!.textContent).not.toMatch(/\d\.\d/);
  });

  it("an_unopened_row_wears_the_dot_spoken_new", async () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    expect(within(rows()[0]!).getByRole("img", { name: "New" })).toBeInTheDocument();
    expect(within(rows()[2]!).queryByRole("img", { name: "New" })).not.toBeInTheDocument();
  });

  it("there_is_no_mark_all_control", async () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    expect(screen.queryByRole("button", { name: /mark/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/mark all/i)).not.toBeInTheDocument();
  });

  it("opening_the_list_clears_the_bell", async () => {
    const marks = serve(THREE);
    setBell("me", true);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    expect(bellLit("me")).toBe(false);
    await screen.findAllByTestId("notifications.list.notification");
    // The server's pointer moves to the newest row this read holds.
    await waitFor(() => expect(marks.seen).toEqual([THREE[0]!.createdAt]));
  });

  it("opening_keeps_row_dots_and_a_tap_clears_one", async () => {
    const marks = serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    expect(within(rows()[0]!).getByRole("img", { name: "New" })).toBeInTheDocument();
    expect(within(rows()[1]!).getByRole("img", { name: "New" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("notification-n1-open"));
    expect(within(rows()[0]!).queryByRole("img", { name: "New" })).not.toBeInTheDocument();
    expect(within(rows()[1]!).getByRole("img", { name: "New" })).toBeInTheDocument();
    await waitFor(() => expect(marks.read).toEqual(["n1"]));
  });

  it("a_comment_row_lands_on_its_comment_in_the_thread", async () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    expect(screen.getByTestId("notification-n1-open")).toHaveAttribute(
      "href",
      "/posts/p1?comment=c1&from=notifications",
    );
    expect(screen.getByTestId("notification-n2-open")).toHaveAttribute("href", "/u/sol?from=notifications");
  });

  // Notifications.md:13, :21, :43 — the tenth kind, the opinion row's sibling.
  it("the_withdrawal_row_wears_the_walked_back_face_and_opens_the_withdrawers_profile", async () => {
    serve([
      row("n4", "PROFILE_OPINION_WITHDRAWN", 2, {
        actor: actor("sol", "Sol"),
        subject: { __typename: "User", id: "u-sol", handle: "sol" },
        record: { __typename: "Record", id: "act:sol:2:opinion", pDirected: -0.4, pInterest: -0.5 },
      }),
    ]);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findAllByTestId("notifications.list.notification");
    const [withdrawn] = rows();
    expect(within(withdrawn!).getByTestId("notifications.list.notification.title")).toHaveTextContent(
      "@sol walked back their opinion on you",
    );
    // 🤷 where a picture would go, decorative: the sentence says what happened.
    const face = within(withdrawn!).getByText("🤷");
    expect(face.closest("[aria-hidden='true']")).not.toBeNull();
    expect(within(withdrawn!).queryByRole("img", { name: /Sol|0\.40/ })).not.toBeInTheDocument();
    expect(within(withdrawn!).queryByTestId("notifications.list.notification.second")).not.toBeInTheDocument();
    expect(withdrawn!.textContent).not.toMatch(/\d\.\d/);
    expect(screen.getByTestId("notification-n4-open")).toHaveAttribute("href", "/u/sol?from=notifications");
  });

  it("the_list_sits_directly_under_the_header_and_draws_its_own_8px_top_padding", async () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    const list = await screen.findByTestId("notifications.list");
    // ChronicleList (_shared.jsx) carries the 8px; a band 8px under the header would double it.
    expect(list).toHaveClass("pt-2");
    expect(screen.getByTestId("notifications.header").closest(".sticky")).not.toHaveClass("pb-2");
  });

  // Notifications.md:57 WHEN the list is first read GIVEN nothing has loaded
  // yet -> notifications.list.loading reads Loading… in the list's place AND
  // NEVER a skeleton or a spinner appears.
  it(":57 the_first_read_in_flight_reads_loading_in_the_lists_place", () => {
    serve(THREE);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    const loading = screen.getByTestId("notifications.list.loading");
    expect(screen.getByTestId("notifications.list")).toContainElement(loading);
    expect(loading).toHaveTextContent("Loading…");
    const line = within(loading).getByRole("status");
    expect(line).toHaveClass("text-body-medium", "text-on-surface-variant");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("the_empty_list_names_the_kinds_with_no_action_and_no_error_colour", async () => {
    const marks = serve([]);
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    const empty = await screen.findByTestId("notifications.empty.title");
    expect(empty).toHaveTextContent(NOTIFICATIONS_EMPTY);
    expect(empty.className).not.toContain("error");
    expect(within(screen.getByTestId("notifications.empty")).queryByRole("button")).not.toBeInTheDocument();
    // An empty first page sends no mark.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(marks.seen).toEqual([]);
  });

  // Notifications.md:59 WHEN the first read gets no answer ->
  // notifications.list.fault reads Can't reach the server — notifications
  // can't load right now. over notifications.list.fault.retry, outlined, in the
  // list's place AND NEVER the error dialog is raised.
  it(":59 a_list_that_cannot_load_says_the_noun_line_over_an_outlined_retry", async () => {
    server.use(gqlLink.query("Notifications", () => HttpResponse.error()));
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    const fault = await screen.findByTestId("notifications.list.fault");
    expect(screen.getByTestId("notifications.list")).toContainElement(fault);
    expect(fault).toHaveTextContent("Can't reach the server — notifications can't load right now.");
    expect(fault.textContent).not.toMatch(/try again/i);
    const retry = within(fault).getByTestId("notifications.list.fault.retry");
    expect(retry).toHaveTextContent("Retry");
    expect(retry.className).toContain("border-outline");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notifications.list.loading")).not.toBeInTheDocument();
  });

  // Notifications.md:61 WHEN tap notifications.list.fault.retry -> the list is
  // read again AND notifications.list.loading stands until it arrives.
  it(":61 retry_reads_the_list_again_with_loading_standing_until_it_arrives", async () => {
    let reads = 0;
    let answer: (() => void) | null = null;
    server.use(
      gqlLink.query("Notifications", async () => {
        reads += 1;
        if (reads === 1) return HttpResponse.error();
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return HttpResponse.json({ data: page(THREE) });
      }),
      gqlLink.mutation("MarkNotificationsSeen", () =>
        HttpResponse.json({ data: { markNotificationsSeen: { hasUnreadNotifications: false, userErrors: [] } } }),
      ),
    );
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    fireEvent.click(await screen.findByTestId("notifications.list.fault.retry"));
    expect(screen.getByTestId("notifications.list.loading")).toHaveTextContent("Loading…");
    expect(screen.queryByTestId("notifications.list.fault")).not.toBeInTheDocument();
    await waitFor(() => expect(answer).not.toBeNull());
    answer!();
    await screen.findAllByTestId("notifications.list.notification");
    expect(rows()).toHaveLength(3);
    expect(screen.queryByTestId("notifications.list.loading")).not.toBeInTheDocument();
    expect(reads).toBe(2);
  });

  // Notifications.md:63 WHEN the next page does not arrive GIVEN rows stand ->
  // the rows on screen stay AND notifications.list.moreFault reads Couldn't
  // load more with notifications.list.moreFault.retry at its end, ending the
  // list, in the list's quiet register AND NEVER the error colour.
  // :65 WHEN tap notifications.list.moreFault.retry -> the next page is asked
  // again AND the rows on screen stay.
  it(":63 :65 a_failed_next_page_ends_the_list_with_couldnt_load_more_and_retry", async () => {
    let reads = 0;
    server.use(
      gqlLink.query("Notifications", ({ variables }) => {
        reads += 1;
        if (variables.after === null) {
          return HttpResponse.json({ data: page(THREE, { hasNextPage: true, endCursor: "c2" }) });
        }
        return HttpResponse.json({ data: null, errors: [{ message: "down", extensions: { code: "INTERNAL" } }] });
      }),
      gqlLink.mutation("MarkNotificationsSeen", () =>
        HttpResponse.json({ data: { markNotificationsSeen: { hasUnreadNotifications: false, userErrors: [] } } }),
      ),
    );
    const scroller = document.createElement("div");
    document.body.append(scroller);
    renderWithProviders(
      <ScrollHostProvider value={{ current: scroller }}>
        <NotificationsScreen from="feed" />
      </ScrollHostProvider>,
      { store: signedIn() },
    );
    await screen.findAllByTestId("notifications.list.notification");
    intersect(true);
    const more = await screen.findByTestId("notifications.list.moreFault");
    expect(more).toHaveTextContent("Couldn't load more — Retry");
    expect(more).toHaveClass("text-on-surface-variant");
    expect(more.className).not.toContain("error");
    // It ends the list: the last thing inside notifications.list.
    expect(screen.getByTestId("notifications.list").lastElementChild).toBe(more);
    const retry = within(more).getByTestId("notifications.list.moreFault.retry");
    expect(retry).toHaveTextContent("Retry");
    expect(rows()).toHaveLength(3);
    fireEvent.click(retry);
    await waitFor(() => expect(reads).toBe(3));
    expect(rows()).toHaveLength(3);
    scroller.remove();
  });

  it("the_tail_watch_survives_a_render_that_landed_no_page", async () => {
    // The watch is rebuilt only when a page lands (`infinite-list.ts`): a
    // render that changed nothing — here, a tap marking a row opened — keeps
    // the observer that watches the approaching tail.
    server.use(
      gqlLink.query("Notifications", () =>
        HttpResponse.json({ data: page(THREE, { hasNextPage: true, endCursor: "c2" }) }),
      ),
      gqlLink.mutation("MarkNotificationsSeen", () =>
        HttpResponse.json({ data: { markNotificationsSeen: { hasUnreadNotifications: false, userErrors: [] } } }),
      ),
    );
    const Base = globalThis.IntersectionObserver;
    const made: IntersectionObserver[] = [];
    globalThis.IntersectionObserver = class extends Base {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        made.push(this);
      }
    };
    const scroller = document.createElement("div");
    document.body.append(scroller);
    try {
      renderWithProviders(
        <ScrollHostProvider value={{ current: scroller }}>
          <NotificationsScreen from="feed" />
        </ScrollHostProvider>,
        { store: signedIn() },
      );
      await screen.findAllByTestId("notifications.list.notification");
      const items = Array.from(screen.getByTestId("notifications.list").querySelectorAll("li"));
      const watching = () =>
        made.filter((observer) =>
          items.some((item) => (observer as unknown as { targets: Set<Element> }).targets.has(item)),
        );
      expect(watching()).toHaveLength(1);
      const observer = watching()[0];
      // n3 is already read: the tap changes only what the row wears.
      fireEvent.click(screen.getByTestId("notification-n3-open"));
      expect(watching()).toEqual([observer]);
    } finally {
      globalThis.IntersectionObserver = Base;
      scroller.remove();
    }
  });

  it("back_returns_to_the_bell_s_root_with_its_label", async () => {
    serve(THREE);
    const cases: [string, string, string][] = [
      ["feed", "/feed", "Back to feed"],
      ["profile", "/profile", "Back to your profile"],
      ["explore", "/explore", "Back to Explore"],
      ["wallet", "/wallet", "Back to Wallet"],
    ];
    for (const [from, href, label] of cases) {
      const { unmount } = renderWithProviders(<NotificationsScreen from={from} />, { store: signedIn() });
      const back = await screen.findByTestId("notifications.header.back");
      expect(back).toHaveAttribute("href", href);
      expect(back).toHaveAccessibleName(label);
      unmount();
    }
    // A page opened from a row and come back from keeps the bell's root.
    notificationsHref("profile");
    renderWithProviders(<NotificationsScreen from={null} />, { store: signedIn() });
    expect(await screen.findByTestId("notifications.header.back")).toHaveAccessibleName("Back to your profile");
  });

  // PR-11's client half: the rows the list holds are laid under the reader's
  // own hidden set, the one the feed filters by — a hide made anywhere takes
  // that person's rows out of the held list.
  it("hiding_someone_elsewhere_drops_their_rows_from_the_held_list", async () => {
    serve(THREE);
    server.use(
      ...hiddenHandlers(hiddenLog(), {
        entries: [{ id: "u-sol", handle: "sol", displayName: "Sol", hiddenAt: at(1) }],
      }),
    );
    renderWithProviders(<NotificationsScreen from="feed" />, { store: signedIn() });
    await screen.findByText("@ada commented on your post");
    await waitFor(() => expect(screen.queryByText("@sol gave an opinion on you")).not.toBeInTheDocument());
    expect(rows()).toHaveLength(2);
  });
});
