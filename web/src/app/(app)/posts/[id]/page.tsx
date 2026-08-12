import type { Metadata } from "next";

import { PostView } from "./post-view";

export const metadata: Metadata = { title: "Post — CoGra" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostView postId={id} />;
}
