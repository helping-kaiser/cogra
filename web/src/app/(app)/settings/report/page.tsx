import type { Metadata } from "next";

import { ReportFromSettings } from "./report-from-settings";

export const metadata: Metadata = { title: "Report a problem — CoGra" };

export default function ReportProblemPage() {
  return <ReportFromSettings />;
}
