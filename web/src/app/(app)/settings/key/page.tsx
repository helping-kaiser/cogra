import type { Metadata } from "next";

import { KeyExportView } from "./key-export-view";

export const metadata: Metadata = { title: "Your key — CoGra" };

export default function KeyExportPage() {
  return <KeyExportView />;
}
