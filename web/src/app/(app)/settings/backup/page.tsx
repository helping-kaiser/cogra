import type { Metadata } from "next";

import { BackupView } from "./backup-view";

export const metadata: Metadata = { title: "Recovery code — CoGra" };

export default function BackupPage() {
  return <BackupView />;
}
