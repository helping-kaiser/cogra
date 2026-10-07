import type { Metadata } from "next";

import { ChangeHandleView } from "./change-handle-view";

export const metadata: Metadata = { title: "Change your handle — CoGra" };

export default function ChangeHandlePage() {
  return <ChangeHandleView />;
}
