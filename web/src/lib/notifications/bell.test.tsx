// The bell's dot and the silent marks (FeedUnread.md; packet
// notifications-list §6.1, §6.4 K4.1).

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { afterEach, describe, expect, it } from "vitest";

import { useAuthGuard } from "@/lib/session/runtime";
import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { clearBell, firstArrival, resetBell, setBell, useBellLit, useFreshRootBell } from "./bell";
import { markSeenThrough, pendingMarks, resetMarks, flushMarks } from "./marks";

const server = startMswServer();

afterEach(() => {
  resetBell();
  resetMarks();
});

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "me" });
  return store;
}

/** A root: reads the bell when its load is fresh, and shows the dot. */
function Root({ fresh, signal = 0 }: { fresh: boolean; signal?: number }) {
  useFreshRootBell("me", fresh, signal);
  const lit = useBellLit("me");
  return <span data-testid="dot">{lit ? "lit" : "quiet"}</span>;
}

/** A root that can re-render in place or be pulled, inside the providers. */
function Harness() {
  const [pulls, setPulls] = useState(0);
  const [, setRenders] = useState(0);
  return (
    <>
      <Root fresh signal={pulls} />
      <button type="button" data-testid="rerender" onClick={() => setRenders((n) => n + 1)} />
      <button type="button" data-testid="pull" onClick={() => setPulls((n) => n + 1)} />
    </>
  );
}

function serveBell(answers: boolean[]) {
  let asked = 0;
  server.use(
    gqlLink.query("NotificationBell", () => {
      const lit = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      return HttpResponse.json({ data: { me: { __typename: "User", id: "me", hasUnreadNotifications: lit } } });
    }),
  );
  return () => asked;
}

describe("the bell", () => {
  it("a_fresh_root_load_lights_the_bell_when_something_arrived", async () => {
    serveBell([true]);
    renderWithProviders(<Root fresh />, { store: signedIn() });
    await waitFor(() => expect(screen.getByTestId("dot")).toHaveTextContent("lit"));
  });

  it("an_arrival_while_on_a_root_never_lights_the_bell_live", async () => {
    const asked = serveBell([false, true]);
    renderWithProviders(<Harness />, { store: signedIn() });
    await waitFor(() => expect(asked()).toBe(1));
    // Something arrives on the server; the root re-renders but does not load
    // fresh, so nothing asks and nothing lights.
    fireEvent.click(screen.getByTestId("rerender"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked()).toBe(1);
    expect(screen.getByTestId("dot")).toHaveTextContent("quiet");
  });

  it("returning_by_back_or_the_bar_never_lights_the_bell", async () => {
    const asked = serveBell([false, true]);
    expect(firstArrival("me", "profile")).toBe(true);
    const first = renderWithProviders(<Root fresh />, { store: signedIn() });
    await waitFor(() => expect(asked()).toBe(1));
    first.unmount();
    // The return: the same root again in the same page load.
    const fresh = firstArrival("me", "profile");
    expect(fresh).toBe(false);
    renderWithProviders(<Root fresh={fresh} />, { store: signedIn() });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked()).toBe(1);
    expect(screen.getByTestId("dot")).toHaveTextContent("quiet");
  });

  it("a_pull_on_a_root_is_a_fresh_load", async () => {
    const asked = serveBell([false, true]);
    renderWithProviders(<Harness />, { store: signedIn() });
    await waitFor(() => expect(asked()).toBe(1));
    fireEvent.click(screen.getByTestId("pull"));
    await waitFor(() => expect(screen.getByTestId("dot")).toHaveTextContent("lit"));
  });

  it("opening_the_list_clears_the_bell", () => {
    setBell("me", true);
    clearBell();
    serveBell([false]);
    renderWithProviders(<Root fresh={false} />, { store: signedIn() });
    expect(screen.getByTestId("dot")).toHaveTextContent("quiet");
  });

  it("is_one_readers_dot", () => {
    setBell("me", true);
    serveBell([false]);
    function Other() {
      return <span data-testid="other">{useBellLit("someone-else") ? "lit" : "quiet"}</span>;
    }
    renderWithProviders(<Other />, { store: signedIn() });
    expect(screen.getByTestId("other")).toHaveTextContent("quiet");
  });
});

describe("the marks", () => {
  it("a_failed_mark_is_retried_silently", async () => {
    let calls = 0;
    server.use(
      gqlLink.mutation("MarkNotificationsSeen", () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error();
        return HttpResponse.json({
          data: { markNotificationsSeen: { hasUnreadNotifications: false, userErrors: [] } },
        });
      }),
    );
    function Marker() {
      const client = useApolloClient();
      const guard = useAuthGuard();
      return (
        <>
          <button
            type="button"
            data-testid="send"
            onClick={() => void markSeenThrough(client, guard, "2026-10-14T10:00:00Z")}
          />
          <button type="button" data-testid="flush" onClick={() => void flushMarks(client, guard)} />
        </>
      );
    }
    renderWithProviders(<Marker />, { store: signedIn() });
    fireEvent.click(screen.getByTestId("send"));
    await waitFor(() => expect(calls).toBe(1));
    // Not gone through: still owed, and nothing on screen says so.
    await waitFor(() => expect(pendingMarks().through).toBe("2026-10-14T10:00:00Z"));
    fireEvent.click(screen.getByTestId("flush"));
    await waitFor(() => expect(pendingMarks().through).toBe(null));
    expect(calls).toBe(2);
  });
});
