"use client";

// Settings' `Report a problem` row opens the report as its own page; the back
// arrow returns to Settings (ReportProblem.md:31), as What's new's does.

import { useRouter } from "next/navigation";

import { ReportProblemView } from "@/lib/report/report-problem-view";

export function ReportFromSettings() {
  const router = useRouter();
  return <ReportProblemView onBack={() => router.push("/settings")} />;
}
