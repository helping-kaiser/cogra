import type { Metadata } from "next";
import { Suspense } from "react";

import { PostView } from "./post-view";
import { PublishedNotice } from "./published-notice";

export const metadata: Metadata = { title: "Post — CoGra" };

/** A single search parameter's value, or null (an array is never one we wrote). */
function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <>
      <PostView
        postId={id}
        // WHERE THE READER CAME FROM names the back arrow (the origin-naming
        // table, design/readme.md "Back labels"): `Back to Saved` from a
        // Saved row, the feed otherwise.
        from={one(query.from)}
        // A COMMENT'S ROW LANDS ON THE COMMENT (jakob 2026-10-01; Saved.md):
        // the thread opens over the post, scrolled to that comment.
        landOn={one(query.comment)}
      />
      {/* `useSearchParams` opts its subtree into client rendering, so it is
          bounded to the notice rather than allowed to reach the post itself.
          (node_modules/next/dist/docs/.../use-search-params: a Suspense
          boundary is required for a page that is otherwise statically
          rendered.) */}
      <Suspense fallback={null}>
        <PublishedNotice postId={id} />
      </Suspense>
    </>
  );
}
