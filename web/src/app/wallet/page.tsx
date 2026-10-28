import type { Metadata } from "next";

import { WalletView } from "./wallet-view";

export const metadata: Metadata = { title: "Wallet — CoGra" };

export default function WalletPage() {
  return <WalletView />;
}
