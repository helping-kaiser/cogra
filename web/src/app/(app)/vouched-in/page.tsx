import type { Metadata } from "next";

import { VouchedInView } from "./vouched-in-view";

export const metadata: Metadata = {
  title: "You're part of the sky now — CoGra",
};

export default function VouchedInPage() {
  return <VouchedInView />;
}
