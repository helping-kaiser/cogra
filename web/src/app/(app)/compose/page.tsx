import type { Metadata } from "next";
import { Suspense } from "react";

import { ComposeRoute } from "./compose-route";

export const metadata: Metadata = { title: "New post — CoGra" };

export default function ComposePage() {
  // Creation goes through the wizard; `?post=` is an edit, one screen and one
  // batch (`post-edit-route.tsx`). Which of the two is decided by a search
  // parameter, so the branch is a client boundary and needs its own Suspense.
  return (
    <Suspense>
      <ComposeRoute />
    </Suspense>
  );
}
