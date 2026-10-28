import type { Metadata } from "next";

import { YourTopicsGate } from "./your-topics-gate";

export const metadata: Metadata = { title: "Your topics — CoGra" };

// Your topics, a subpage of Explore (design readme, the topic round: "a
// subpage off Explore, not a section in it"), so it lives under its route.
export default async function YourTopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { from } = await searchParams;
  // The arrow names the origin (`Back to feed` from the feed filter's door).
  return <YourTopicsGate from={typeof from === "string" ? from : null} />;
}
