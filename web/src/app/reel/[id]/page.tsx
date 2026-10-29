import type { Metadata } from "next";

import { ReelView } from "./reel-view";

// NO TITLE NAMES THE STREAM ON SCREEN (Reel.md:5: "no header labels the
// stream") — the document's title is the browser's tab, not a header.
export const metadata: Metadata = { title: "CoGra" };

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReelView postId={id} />;
}
