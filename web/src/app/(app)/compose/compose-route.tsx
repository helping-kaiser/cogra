"use client";

import { useSearchParams } from "next/navigation";

import { ComposeForm } from "./compose-form";
import { ComposeWizard } from "./wizard/wizard-view";

export function ComposeRoute() {
  const params = useSearchParams();
  // `?reference=` prefills a citation on a NEW post, so it stays with the
  // wizard; only `?post=` names an existing post to edit.
  return params.get("post") === null ? <ComposeWizard /> : <ComposeForm />;
}
