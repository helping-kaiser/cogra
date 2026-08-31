import type { Metadata } from "next";
import { Suspense } from "react";

import { PostView } from "./post-view";
import { PublishedNotice } from "./published-notice";

export const metadata: Metadata = { title: "Post — CoGra" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PostView postId={id} />
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
