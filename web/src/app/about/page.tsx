import { Suspense } from "react";
import type { Metadata } from "next";

import { AboutView } from "./about-view";

export const metadata: Metadata = { title: "About CoGra" };

export default function AboutPage() {
  // The back arrow reads the door it came through (`?from=`).
  return (
    <Suspense>
      <AboutView />
    </Suspense>
  );
}
