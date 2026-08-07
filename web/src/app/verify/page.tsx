// Email verification (auth.md "Link URLs": /verify?token= on the web
// origin, public and sessionless — the link may open in a browser that
// never saw the registration).

import { Suspense } from "react";
import type { Metadata } from "next";

import { VerifyView } from "./verify-view";

export const metadata: Metadata = {
  title: "Verify your email — CoGra",
};

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyView />
    </Suspense>
  );
}
