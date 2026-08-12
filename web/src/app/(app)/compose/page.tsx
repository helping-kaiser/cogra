import type { Metadata } from "next";

import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "New post — CoGra" };

export default function ComposePage() {
  return <ComposeForm />;
}
