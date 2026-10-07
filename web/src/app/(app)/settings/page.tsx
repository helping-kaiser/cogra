import { Suspense } from "react";
import type { Metadata } from "next";

import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings — CoGra" };

export default function SettingsPage() {
  // The page reads the `?done=` a returning subpage hands it.
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
