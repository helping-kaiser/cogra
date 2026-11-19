import type { Metadata } from "next";

import { KeyCustodyGate, RESTORE_BACK_HREF } from "@/lib/identity/key-custody-gate";
import { RestoreForm } from "./restore-form";

export const metadata: Metadata = {
  title: "Restore your key — CoGra",
};

export default function RestorePage() {
  return (
    <KeyCustodyGate backHref={RESTORE_BACK_HREF}>
      <RestoreForm />
    </KeyCustodyGate>
  );
}
