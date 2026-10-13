import type { Metadata } from "next";

import { WhatsNewView } from "./whats-new-view";

export const metadata: Metadata = { title: "What's new — CoGra" };

export default function WhatsNewPage() {
  return <WhatsNewView />;
}
