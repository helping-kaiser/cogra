// A profile's held card view: one reader's, one profile's, one view's, found
// only by a return (`profile-memory.ts`).

import { beforeEach, describe, expect, it } from "vitest";

import type { ProfileCommentView, ProfileView } from "@/lib/api/profile-api";
import { reelPost } from "@/test/reel";

import {
  forgetAllProfileViews,
  forgetProfileView,
  recallProfileView,
  rememberProfilePlace,
  rememberProfileView,
  type HeldProfileList,
} from "./profile-memory";

const ada = { id: "u-ada", handle: "ada" } as unknown as ProfileView;

function leave(
  over: { reader?: string | null; route?: string | null; from?: string | null; list?: HeldProfileList } = {},
) {
  rememberProfileView({
    reader: "u1",
    route: "ada",
    from: "saved",
    profile: ada,
    figures: null,
    viewer: null,
    own: false,
    applicant: false,
    list: { tab: "posts", posts: [reelPost("p1")] },
    endCursor: "c1",
    hasNextPage: true,
    ...over,
  });
}

const heldIds = (list: HeldProfileList | undefined) =>
  list === undefined ? [] : list.tab === "posts" ? list.posts.map((post) => post.id) : list.comments.map((comment) => comment.id);

beforeEach(() => forgetAllProfileViews());

describe("a profile's held card view", () => {
  it("a return finds it: the same reader, the same profile, no `from` or the one it was opened with", () => {
    leave();
    expect(heldIds(recallProfileView("u1", "ada", null)?.list)).toEqual(["p1"]);
    expect(recallProfileView("u1", "Ada", null)).not.toBeNull();
    expect(recallProfileView("u1", "ada", "saved")).not.toBeNull();
    // A new opening from another list, another reader, another profile: nothing.
    expect(recallProfileView("u1", "ada", "history")).toBeNull();
    expect(recallProfileView("u2", "ada", null)).toBeNull();
    expect(recallProfileView("u1", "mira", null)).toBeNull();
    expect(recallProfileView("u1", null, null)).toBeNull();
  });

  it("holds the comments view the same way, naming its tab", () => {
    const comment = { id: "c1" } as unknown as ProfileCommentView;
    leave({ list: { tab: "comments", comments: [comment] } });
    const held = recallProfileView("u1", "ada", null);
    expect(held?.list.tab).toBe("comments");
    expect(heldIds(held?.list)).toEqual(["c1"]);
  });

  it("keeps the place for its own profile's own view only, and across a re-remember", () => {
    leave();
    const place = { offset: 640, anchorId: "p1", anchorTop: -12 };
    rememberProfilePlace("u1", "mira", { offset: 9, anchorId: null, anchorTop: 0 });
    rememberProfilePlace("u1", "ada", place);
    leave({ from: "saved" });
    expect(recallProfileView("u1", "ada", null)?.place).toEqual(place);
    // The same profile's other view starts at the top.
    leave({ list: { tab: "comments", comments: [] } });
    expect(recallProfileView("u1", "ada", null)?.place).toEqual({ offset: 0, anchorId: null, anchorTop: 0 });
    // Another profile's view starts at the top.
    leave({ route: "mira" });
    expect(recallProfileView("u1", "mira", null)?.place).toEqual({ offset: 0, anchorId: null, anchorTop: 0 });
  });

  it("is let go by its own profile alone", () => {
    leave();
    forgetProfileView("u1", "mira");
    expect(recallProfileView("u1", "ada", null)).not.toBeNull();
    forgetProfileView("u1", "ADA");
    expect(recallProfileView("u1", "ada", null)).toBeNull();
  });
});
