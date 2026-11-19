import type { Metadata } from "next";

import { KeyCustodyGate } from "@/lib/identity/key-custody-gate";
import { ceremonyBackHref } from "@/lib/identity/key-custody-routes";
import { KeyCeremonyView } from "./key-ceremony-view";

export const metadata: Metadata = {
  title: "Your key — CoGra",
};

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function KeyPage({ searchParams }: Props) {
  const { from } = await searchParams;
  return (
    <KeyCustodyGate backHref={ceremonyBackHref(typeof from === "string" ? from : null)}>
      <KeyCeremonyView />
    </KeyCustodyGate>
  );
}
