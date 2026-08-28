import type { Metadata } from "next";
import { Suspense } from "react";

import { FeedView } from "./feed-view";

export const metadata: Metadata = { title: "Feed — CoGra" };

export default function FeedPage() {
  // The view reads `?compose=` to say whether the last post landed, and a
  // search parameter is a client boundary that needs its own Suspense.
  return (
    <Suspense>
      <FeedView />
    </Suspense>
  );
}
