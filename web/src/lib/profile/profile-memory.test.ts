// The posts view's held state: one reader's, one profile's, found only by a
// return (`profile-memory.ts`).

import { beforeEach, describe, expect, it } from "vitest";

import type { ProfileView } from "@/lib/api/profile-api";
import { reelPost } from "@/test/reel";

import {
  forgetAllProfilePosts,
  forgetProfilePosts,
  recallProfilePosts,
  rememberProfilePlace,
  rememberProfilePosts,
} from "./profile-memory";

const ada = { id: "u-ada", handle: "ada" } as unknown as ProfileView;

function leave(over: { reader?: string | null; route?: string | null; from?: string | null } = {}) {
  rememberProfilePosts({
    reader: "u1",
    route: "ada",
    from: "saved",
    profile: ada,
    figures: null,
    viewer: null,
    own: false,
    applicant: false,
    posts: [reelPost("p1")],
    endCursor: "c1",
    hasNextPage: true,
    ...over,
  });
}

beforeEach(() => forgetAllProfilePosts());

describe("the posts view's memory", () => {
  it("a return finds it: the same reader, the same profile, no `from` or the one it was opened with", () => {
    leave();
    expect(recallProfilePosts("u1", "ada", null)?.posts.map((post) => post.id)).toEqual(["p1"]);
    expect(recallProfilePosts("u1", "Ada", null)).not.toBeNull();
    expect(recallProfilePosts("u1", "ada", "saved")).not.toBeNull();
    // A new opening from another list, another reader, another profile: nothing.
    expect(recallProfilePosts("u1", "ada", "history")).toBeNull();
    expect(recallProfilePosts("u2", "ada", null)).toBeNull();
    expect(recallProfilePosts("u1", "mira", null)).toBeNull();
    expect(recallProfilePosts("u1", null, null)).toBeNull();
  });

  it("keeps the place for its own profile only, and across a re-remember", () => {
    leave();
    const place = { offset: 640, anchorId: "p1", anchorTop: -12 };
    rememberProfilePlace("u1", "mira", { offset: 9, anchorId: null, anchorTop: 0 });
    rememberProfilePlace("u1", "ada", place);
    leave({ from: "saved" });
    expect(recallProfilePosts("u1", "ada", null)?.place).toEqual(place);
    // Another profile's view starts at the top.
    leave({ route: "mira" });
    expect(recallProfilePosts("u1", "mira", null)?.place).toEqual({ offset: 0, anchorId: null, anchorTop: 0 });
  });

  it("is let go by its own profile alone", () => {
    leave();
    forgetProfilePosts("u1", "mira");
    expect(recallProfilePosts("u1", "ada", null)).not.toBeNull();
    forgetProfilePosts("u1", "ADA");
    expect(recallProfilePosts("u1", "ada", null)).toBeNull();
  });
});
