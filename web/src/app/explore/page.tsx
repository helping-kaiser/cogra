import type { Metadata } from "next";

import { ExploreView } from "./explore-view";

export const metadata: Metadata = { title: "Explore — CoGra" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q } = await searchParams;
  // A reload restores the half-typed query from the URL (readme §13, *A
  // process the OS ended in the background restores*).
  return <ExploreView initialQuery={typeof q === "string" ? q : null} />;
}
