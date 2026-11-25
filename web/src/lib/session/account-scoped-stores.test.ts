// THE TAB'S MODULE STORES BELONG TO THE ACCOUNT THAT FILLED THEM. Several
// accounts share one tab (auth.md "Multi-account device custody"), and every
// way the active account ends or changes passes through the token store, so
// each walk here fills a store as account A, moves the token store to B, and
// reads what B is handed — then moves back to A, whose state is kept, since a
// remembered account's sign-out clears nothing (auth.md "Sign-out").

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApolloClient } from "@apollo/client";

import type { PostView } from "@/lib/api/content-api";
import { failed, success, type Outcome } from "@/lib/api/outcome";
import type { HeldAnswer } from "@/lib/feed/derive";
import { carryToInvites, peekInvitesNotice, takeInvitesNotice } from "@/lib/invites/invites-notice";
import { flushMarks, markRead, markSeenThrough, pendingMarks, resetMarks } from "@/lib/notifications/marks";
import { heldPicture, holdPicture, releaseHeldPicture } from "@/lib/profile/held-picture";
import {
  closeProfileChangeSeal,
  readProfileChange,
  resetProfileChangeForTests,
  signProfileChange,
} from "@/lib/profile/profile-change";
import { forgetStream, openStream, streamFor } from "@/lib/reel/stream-session";
import { adoptTrace, forgetStandings, holdRanking, standingOf } from "@/lib/score/standing";
import { beginTrace, forgetTrace, holdTraceRead, openTrace } from "@/lib/score/trace-session";
import { resetCarriedSnackbarForTests } from "@/lib/ui/carried-snackbar";
import { tokenStore } from "./token-store";

// Every mark sent, with the account the tab was signed in as at that moment.
const sent = vi.hoisted(() => ({ marks: [] as { mark: string; as: string | null }[] }));

vi.mock("@/lib/api/notifications-api", async (importOriginal) => {
  const { tokenStore: store } = await import("./token-store");
  return {
    ...(await importOriginal<typeof import("@/lib/api/notifications-api")>()),
    markNotificationsSeen: async (_client: unknown, through: string) => {
      sent.marks.push({ mark: `seen:${through}`, as: store.activeAccountId() });
      return success(true);
    },
    markNotificationRead: async (_client: unknown, id: string) => {
      sent.marks.push({ mark: `read:${id}`, as: store.activeAccountId() });
      return success(true);
    },
  };
});

function signInAs(account: string): void {
  tokenStore.save({ accessToken: `access-${account}`, refreshToken: `refresh-${account}`, accountId: account });
}

const client = {} as ApolloClient;

/** A guard that answers like the network: nothing goes through while offline. */
function network() {
  let online = true;
  const guard = {
    run: async <T>(block: () => Promise<Outcome<T>>): Promise<Outcome<T>> =>
      online ? block() : failed(new TypeError("Failed to fetch")),
  };
  return {
    guard,
    offline: () => (online = false),
    online: () => (online = true),
  };
}

beforeEach(() => {
  sent.marks = [];
});

afterEach(() => {
  resetMarks();
  releaseHeldPicture();
  takeInvitesNotice();
  resetProfileChangeForTests();
  resetCarriedSnackbarForTests();
  forgetStandings();
  forgetTrace();
  forgetStream();
});

describe("the read marks are sent only as the account that made them", () => {
  it("never sends A's queued marks once the tab is B's, and sends them as A again", async () => {
    const net = network();
    signInAs("acct-a");
    net.offline();
    await markSeenThrough(client, net.guard, "2026-11-25T10:00:00Z");
    await markRead(client, net.guard, "note-of-a");
    expect(sent.marks).toEqual([]);

    signInAs("acct-b");
    net.online();
    // B's own list opening: the checkpoint that flushes what is owed.
    await flushMarks(client, net.guard);
    expect(sent.marks.filter((mark) => mark.as === "acct-b")).toEqual([]);

    signInAs("acct-a");
    await flushMarks(client, net.guard);
    expect(sent.marks).toEqual([
      { mark: "seen:2026-11-25T10:00:00Z", as: "acct-a" },
      { mark: "read:note-of-a", as: "acct-a" },
    ]);
    expect(pendingMarks()).toEqual({ through: null, reads: [] });
  });

  it("sends B's own marks under B beside A's kept ones", async () => {
    const net = network();
    signInAs("acct-a");
    net.offline();
    await markRead(client, net.guard, "note-of-a");

    signInAs("acct-b");
    net.online();
    await markRead(client, net.guard, "note-of-b");
    expect(sent.marks).toEqual([{ mark: "read:note-of-b", as: "acct-b" }]);
  });

  it("stops a flush the moment the account changes under it", async () => {
    signInAs("acct-a");
    let first = true;
    const guard = {
      run: async <T>(block: () => Promise<Outcome<T>>): Promise<Outcome<T>> => {
        const outcome = await block();
        // The first mark lands; then another tab switches the account.
        if (first) {
          first = false;
          signInAs("acct-b");
        }
        return outcome;
      },
    };
    const net = network();
    net.offline();
    await markRead(client, net.guard, "note-1");
    await markRead(client, net.guard, "note-2");

    await flushMarks(client, guard);
    expect(sent.marks.filter((mark) => mark.as === "acct-b")).toEqual([]);
  });

  it("sends nothing after a sign-out, and keeps A's marks for A", async () => {
    const net = network();
    signInAs("acct-a");
    net.offline();
    await markRead(client, net.guard, "note-of-a");

    tokenStore.clear();
    net.online();
    window.dispatchEvent(new Event("online"));
    await flushMarks(client, net.guard);
    expect(sent.marks).toEqual([]);
  });
});

describe("the held picture is the picking account's", () => {
  it("hands B nothing for A's pick, and A its own pick again", () => {
    signInAs("acct-a");
    const picture = new File(["a's face"], "a.jpg", { type: "image/jpeg" });
    holdPicture(picture);

    signInAs("acct-b");
    expect(heldPicture()).toBeNull();

    signInAs("acct-a");
    expect(heldPicture()).toBe(picture);
  });

  it("hands nothing to a signed-out tab", () => {
    signInAs("acct-a");
    holdPicture(new File(["a's face"], "a.jpg"));
    tokenStore.clear();
    expect(heldPicture()).toBeNull();
  });
});

describe("the notice carried to Invites is the vouching account's", () => {
  it("never reaches B's Invites", () => {
    signInAs("acct-a");
    carryToInvites({ kind: "alreadyWaiting", handle: "asker-of-a" });

    signInAs("acct-b");
    expect(peekInvitesNotice()).toBeNull();
    expect(takeInvitesNotice()).toBeNull();
  });
});

describe("a profile change still signing is the changing account's", () => {
  it("never stands under B's head, and stands under A's again", async () => {
    signInAs("acct-a");
    let answer!: (outcome: { kind: "offline" }) => void;
    const signing = signProfileChange(() => new Promise((resolve) => (answer = resolve)));
    closeProfileChangeSeal();
    expect(readProfileChange()).toEqual({ kind: "signing" });

    signInAs("acct-b");
    expect(readProfileChange()).toBeNull();

    answer({ kind: "offline" });
    await signing;
    expect(readProfileChange()).toBeNull();

    signInAs("acct-a");
    expect(readProfileChange()?.kind).toBe("failed");
  });
});

const ranked = (entries: [string, number][]): HeldAnswer => ({
  asOfEpoch: 7,
  entries: entries.map(([targetId, score], newestIndex) => ({ targetId, kind: "POST", score, mark: null, newestIndex })),
  settling: [],
});

describe("a trace's figure is the tracing reader's (FeedKinds.md:7)", () => {
  it("never wears A's traced figure on B's slot", () => {
    holdRanking("acct-a", ranked([["post-1", 1]]), "acct-a");
    adoptTrace("post-1", 0.42, "acct-a");
    expect(standingOf("acct-a", "post-1", false)).toEqual({ kind: "figure", score: 0.42 });

    expect(standingOf("acct-b", "post-1", false)).toEqual({ kind: "dash" });
  });
});

describe("an open trace is the opening reader's (FeedEntry.md:5)", () => {
  it("never hands A's held paths to B arriving on the same trace", () => {
    signInAs("acct-a");
    beginTrace("post-1", null, "acct-a");
    holdTraceRead("post-1", { kind: "failed", offline: true });
    expect(openTrace("post-1").read.kind).toBe("failed");

    signInAs("acct-b");
    expect(openTrace("post-1")).toMatchObject({ viewer: null, read: { kind: "idle" } });
  });
});

function clip(id: string): PostView {
  const attachment = { id: `${id}-m`, mimeType: "video/mp4", status: "NORMAL", options: { aspectRatio: "9:16" } };
  return { __typename: "Post", id, attachments: [attachment], attachmentsStatus: "NORMAL" } as unknown as PostView;
}

describe("a held stream is the opening reader's", () => {
  it("never hands B the list A's feed handed the stream", () => {
    signInAs("acct-a");
    openStream({ origin: { kind: "feed" }, rows: [clip("a-feed-1"), clip("a-feed-2")], startId: "a-feed-1" });

    signInAs("acct-b");
    const stream = streamFor("a-feed-1", clip("a-feed-1"));
    expect(stream?.snapshot.clips.map((row) => row.id)).toEqual(["a-feed-1"]);
  });
});
