import type { Metadata } from "next";

import { HashtagDetailDocument } from "@/__generated__/graphql";
import { query } from "@/lib/apollo-client";
import { TopicView } from "./topic-view";

// A topic URL is a shareable surface (web.md "Links unfurl"), so its
// unfurl metadata renders on the server; the page body stays a client
// view like every other read surface.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  try {
    const { data } = await query({ query: HashtagDetailDocument, variables: { name } });
    const hashtag = data?.hashtag;
    if (!hashtag) return { title: "Topic — CoGra" };
    return { title: `#${hashtag.name.value} — CoGra` };
  } catch {
    // An unreachable backend must not break the page render; the
    // client view carries its own error surface.
    return { title: "Topic — CoGra" };
  }
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return <TopicView name={name} />;
}
