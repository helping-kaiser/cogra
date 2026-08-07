import type { Metadata } from "next";

import { RestoreForm } from "./restore-form";

export const metadata: Metadata = {
  title: "Restore your key — CoGra",
};

export default function RestorePage() {
  return <RestoreForm />;
}
