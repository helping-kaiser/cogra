import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset your password — CoGra" };

// The form reads ?token= via useSearchParams, so it sits under a Suspense
// boundary (Next docs: functions/use-search-params).
export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
