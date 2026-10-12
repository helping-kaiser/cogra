import { readFileSync } from "node:fs";
import { join } from "node:path";

import { screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import {
  intersectEach,
  isObserved,
  setsPageVisibility,
  whenObserved,
} from "@/test/media-env";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import {
  SCROLL_IDLE_MS,
  SEEN_ATTRIBUTE,
  SEEN_BATCH_MAX,
  SeenQueue,
  useSeenTracker,
} from "./seen-tracker";

// What the server was sent, call by call; what it answers is per test.
let sent: string[][] = [];
let refuseNext = 0;
const server = startMswServer(
  graphql.mutation("MarkSeen", ({ variables }) => {
    sent.push(variables.nodes as string[]);
    if (refuseNext > 0) {
      refuseNext -= 1;
      return HttpResponse.json({
        data: null,
        errors: [{ message: "rate limited; retry later", extensions: { code: "RATE_LIMITED" } }],
      });
    }
    return HttpResponse.json({
      data: { markSeen: { __typename: "MarkSeenPayload", ok: true, userErrors: [] } },
    });
  }),
);

function reset() {
  sent = [];
  refuseNext = 0;
  server.resetHandlers();
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

/** A list the way a surface hosts it: the tracker at the list, ids on the items. */
function List({ ids }: { ids: readonly string[] }) {
  const list = useRef<HTMLUListElement>(null);
  useSeenTracker({ root: null, list, ids });
  return (
    <ul ref={list}>
      {ids.map((id) => (
        <li key={id} data-testid={`card-${id}`} {...{ [SEEN_ATTRIBUTE]: id }}>
          {id}
        </li>
      ))}
    </ul>
  );
}

async function cards(...ids: string[]): Promise<HTMLElement[]> {
  const found = await Promise.all(ids.map((id) => screen.findByTestId(`card-${id}`)));
  await whenObserved(...found);
  return found;
}

describe("the seen queue", () => {
  it("carries the page budget the server refuses past", () => {
    const constants = JSON.parse(
      readFileSync(join(process.cwd(), "..", "client-constants.json"), "utf-8"),
    ) as { paging: { maxPageSize: number } };
    expect(SEEN_BATCH_MAX).toBe(constants.paging.maxPageSize);
  });

  it("a flush carries at most a page of ids, in seen order", async () => {
    const queue = new SeenQueue();
    queue.belongTo("acct-1");
    const ids = Array.from({ length: 250 }, (_, n) => `n${n}`);
    for (const id of ids) queue.see(id);
    const batches: string[][] = [];
    await queue.flush(async (batch) => {
      batches.push([...batch]);
      return true;
    });
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(ids);
    expect(queue.queued).toEqual([]);
  });

  it("a tripped batch is retried, not lost", async () => {
    const queue = new SeenQueue();
    queue.belongTo("acct-1");
    queue.see("a");
    queue.see("b");
    await queue.flush(async () => false);
    expect(queue.queued).toEqual(["a", "b"]);
    await queue.flush(async () => {
      throw new Error("offline");
    });
    expect(queue.queued).toEqual(["a", "b"]);
    queue.see("c");
    const batches: string[][] = [];
    await queue.flush(async (batch) => {
      batches.push([...batch]);
      return true;
    });
    expect(batches).toEqual([["a", "b", "c"]]);
  });

  it("nothing is tracked without a session, and another account starts empty", async () => {
    const queue = new SeenQueue();
    expect(queue.see("a")).toBe(false);
    queue.belongTo("acct-1");
    expect(queue.see("a")).toBe(true);
    expect(queue.see("a")).toBe(false);
    queue.belongTo("acct-2");
    expect(queue.queued).toEqual([]);
    expect(queue.see("a")).toBe(true);
  });

  it("a batch in flight across an account change never touches the next account's queue", async () => {
    const queue = new SeenQueue();
    queue.belongTo("acct-1");
    queue.see("a");
    let release: (taken: boolean) => void = () => {};
    const flight = queue.flush(() => new Promise((resolve) => (release = resolve)));
    queue.belongTo("acct-2");
    queue.see("b");
    release(true);
    await flight;
    expect(queue.queued).toEqual(["b"]);
  });
});

describe("the seen tracker on a list", () => {
  it("a card wholly in the viewport is seen; a partly visible one is not", async () => {
    reset();
    const { unmount } = renderWithProviders(<List ids={["a", "b", "c"]} />, { store: signedIn() });
    const [a, b, c] = await cards("a", "b", "c");
    // `isIntersecting` is true for a sliver; the gate reads the ratio.
    intersectEach([
      { target: a, ratio: 1 },
      { target: b, ratio: 0.99, isIntersecting: true },
      { target: c, ratio: 0 },
    ]);
    unmount();
    await waitFor(() => expect(sent).toEqual([["a"]]));
  });

  it("a card taller than the viewport never reaches a whole view, so it never fires in H1", async () => {
    reset();
    const { unmount } = renderWithProviders(<List ids={["tall"]} />, { store: signedIn() });
    const [tall] = await cards("tall");
    // A card taller than the scroller tops out below ratio 1 however it is
    // scrolled: the ruled both-edges rule (History.md:13) is its own slice.
    intersectEach([{ target: tall, ratio: 0.8, isIntersecting: true }]);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
  });

  it("a seen card is queued once per session, and a remounted list stops watching it", async () => {
    reset();
    const store = signedIn();
    const first = renderWithProviders(<List ids={["a", "b"]} />, { store });
    const [a] = await cards("a", "b");
    intersectEach([{ target: a, ratio: 1 }]);
    intersectEach([{ target: a, ratio: 1 }]);
    first.unmount();
    await waitFor(() => expect(sent).toEqual([["a"]]));

    renderWithProviders(<List ids={["a", "b"]} />, { store });
    const b = await screen.findByTestId("card-b");
    await whenObserved(b);
    expect(isObserved(screen.getByTestId("card-a"))).toBe(false);
  });

  it("a batch flushes once the scroller comes to rest", async () => {
    reset();
    renderWithProviders(<List ids={["a", "b"]} />, { store: signedIn() });
    const [a, b] = await cards("a", "b");
    intersectEach([
      { target: b, ratio: 1 },
      { target: a, ratio: 1 },
    ]);
    window.dispatchEvent(new Event("scroll"));
    expect(sent).toEqual([]);
    await waitFor(() => expect(sent).toEqual([["b", "a"]]), { timeout: SCROLL_IDLE_MS * 4 });
  });

  it("a batch flushes when the page is hidden", async () => {
    reset();
    renderWithProviders(<List ids={["a"]} />, { store: signedIn() });
    const [a] = await cards("a");
    intersectEach([{ target: a, ratio: 1 }]);
    setsPageVisibility("hidden");
    await waitFor(() => expect(sent).toEqual([["a"]]));
  });

  it("a tripped batch is retried at the next checkpoint, nothing dropped", async () => {
    reset();
    refuseNext = 1;
    renderWithProviders(<List ids={["a", "b"]} />, { store: signedIn() });
    const [a, b] = await cards("a", "b");
    intersectEach([{ target: a, ratio: 1 }]);
    setsPageVisibility("hidden");
    await waitFor(() => expect(sent).toEqual([["a"]]));
    setsPageVisibility("visible");
    intersectEach([{ target: b, ratio: 1 }]);
    setsPageVisibility("hidden");
    await waitFor(() => expect(sent).toEqual([["a"], ["a", "b"]]));
  });

  it("nothing is tracked without a session", async () => {
    reset();
    const store = createTokenStore();
    store.clear();
    const { unmount } = renderWithProviders(<List ids={["a"]} />, { store });
    const a = await screen.findByTestId("card-a");
    expect(isObserved(a)).toBe(false);
    intersectEach([{ target: a, ratio: 1 }]);
    setsPageVisibility("hidden");
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
  });
});
