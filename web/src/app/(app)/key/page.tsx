import type { Metadata } from "next";

import { KeyCeremonyView } from "./key-ceremony-view";

export const metadata: Metadata = {
  title: "Your key — CoGra",
};

export default function KeyPage() {
  return <KeyCeremonyView />;
}
