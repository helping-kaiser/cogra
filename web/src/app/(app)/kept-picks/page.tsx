import { Suspense } from "react";
import type { Metadata } from "next";

import { KeptPicksView } from "./kept-picks-view";

export const metadata: Metadata = { title: "Kept picks — CoGra" };

export default function KeptPicksPage() {
  // The page reads the `?from=` it returns to.
  return (
    <Suspense>
      <KeptPicksView />
    </Suspense>
  );
}
