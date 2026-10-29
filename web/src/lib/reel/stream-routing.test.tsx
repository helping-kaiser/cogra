// THE TAP'S ROUTING (graph.json «post media», 23 origin boards: "pictures —
// the post opens", "a clip wider than tall — the post opens", "a portrait
// clip — the stream opens"; readme §13: square and wider open the post). One
// predicate decides the route and the narrowing (`stream-clip.ts`).

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PostCard } from "@/lib/ui/post-card";
import { renderWithProviders } from "@/test/providers";
import { reelPost } from "@/test/reel";

import { isStreamClip } from "./stream-clip";
import { forgetStream, heldStream, openStream } from "./stream-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function card(ratio: string | null | "photo", onOpen = vi.fn()) {
  const post = reelPost("p1", ratio);
  renderWithProviders(
    <PostCard
      post={post}
      href="/posts/p1"
      stream={{ href: "/reel/p1", onOpen }}
      testId="card"
      authorTestId="card-author"
      stanceTestId="card-stance"
      comments={0}
      onLinkCopied={() => {}}
    />,
  );
  return { post, onOpen };
}

describe("a media tap's route", () => {
  it("a_portrait_clip_tap_opens_the_stream_on_that_clip", () => {
    const { onOpen } = card("9:16");
    const door = screen.getByTestId("card-stream-link");
    expect(door).toHaveAttribute("href", "/reel/p1");
    // The clip is inside the stream's door, never the post's.
    expect(door.querySelector("video")).not.toBeNull();
    expect(screen.getByTestId("card-link")).not.toContainElement(door.querySelector("video"));
    // The words keep the card's door to the post.
    expect(screen.getByTestId("card-link")).toHaveAttribute("href", "/posts/p1");
    fireEvent.click(door);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a_square_clip_tap_opens_the_post", "1:1"],
    ["a_wide_clip_tap_opens_the_post", "16:9"],
    ["a_picture_tap_opens_the_post", "photo"],
    ["an_unprobed_clip_tap_opens_the_post", null],
  ] as const)("%s", (_name, ratio) => {
    card(ratio);
    expect(screen.queryByTestId("card-stream-link")).toBeNull();
    const link = screen.getByTestId("card-link");
    expect(link).toHaveAttribute("href", "/posts/p1");
    // The media is inside the post's door.
    expect(link.querySelector("video, img")).not.toBeNull();
  });

  it("a surface that draws no stream case opens the post for a portrait clip too (Saved, TagPage)", () => {
    renderWithProviders(
      <PostCard
        post={reelPost("p1", "9:16")}
        href="/posts/p1"
        testId="card"
        authorTestId="card-author"
        stanceTestId="card-stance"
        comments={0}
        onLinkCopied={() => {}}
      />,
    );
    expect(screen.queryByTestId("card-stream-link")).toBeNull();
  });

  it("the_router_and_the_narrowing_share_one_predicate", () => {
    const shapes = ["9:16", "3:4", "4:5", "1:1", "16:9", null, "photo"] as const;
    for (const ratio of shapes) {
      forgetStream();
      const post = reelPost(`p-${ratio}`, ratio);
      const { unmount } = renderWithProviders(
        <PostCard
          post={post}
          href={`/posts/${post.id}`}
          stream={{ href: `/reel/${post.id}`, onOpen: () => {} }}
          testId="card"
          authorTestId="card-author"
          stanceTestId="card-stance"
          comments={0}
          onLinkCopied={() => {}}
        />,
      );
      const routes = screen.queryByTestId("card-stream-link") !== null;
      openStream({ origin: { kind: "feed" }, rows: [post], startId: post.id });
      const narrows = (heldStream()?.snapshot.clips.length ?? 0) === 1;
      expect({ ratio, routes, narrows }).toEqual({ ratio, routes: isStreamClip(post), narrows: isStreamClip(post) });
      unmount();
    }
  });
});
