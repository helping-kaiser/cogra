"use client";

// WALLET · NOT HERE YET — what the bar's Wallet slot opens in V1.0
// (WalletComingSoon.md; design/designs/canonical/screens/WalletComingSoon.jsx;
// readme §13, *The V1.0 scope cut*). The slot keeps its place so the bar
// never thins, and the tap needs somewhere to land: this.
//
// IT IS A TAB ROOT, DRAWN AS ONE (:9): the band above, the bar below with the
// Wallet slot lit, and no back arrow. The band carries chats and the bell for a
// signed-in reader (:11); a guest's is the bare view's, no bell, and its chats
// open the guest gate (:13-15).
//
// ONE FACE FOR EVERY READER STATE (:5) and NO ACTION, NO DATE (:7): the
// coming-soon card, `Wallet — coming soon` over `Your earnings will be here.`
//
// The board is not registered in nodes.json, so nothing here wears a design
// node id yet.

import { useRouter } from "next/navigation";
import { useState } from "react";

import { firstArrival, useBellLit, useFreshRootBell } from "@/lib/notifications/bell";
import { notificationsHref } from "@/lib/notifications/origin";
import { useActiveAccountId, useAuthPhase } from "@/lib/session/provider";
import { CograBand } from "@/lib/ui/cogra-band";
import { JoinPrompt } from "@/lib/ui/join-prompt";
import { ComingSoonCard } from "@/lib/ui2/coming-soon-card";

/** WalletComingSoon.md:3, the blessed line (copy-voice, the coming-soon surfaces). */
export const WALLET_LINE = "Your earnings will be here.";

export function WalletView() {
  const router = useRouter();
  const phase = useAuthPhase();
  const account = useActiveAccountId();
  const reader = phase === "signedIn" ? account : null;
  const [freshRoot] = useState(() => firstArrival(reader, "wallet"));
  useFreshRootBell(reader, freshRoot);
  const bellIsLit = useBellLit(reader);
  const [joinPrompt, setJoinPrompt] = useState(false);

  return (
    <main className="flex w-full flex-1 flex-col">
      <CograBand
        node={{ path: "wallet.band" }}
        onChats={
          phase === "signedOut"
            ? () => setJoinPrompt(true)
            : phase === "signedIn"
              ? () => router.push("/chats?from=wallet")
              : undefined
        }
        bell={
          phase === "signedIn" && reader !== null
            ? { lit: bellIsLit, onOpen: () => router.push(notificationsHref("wallet")) }
            : undefined
        }
      />
      <div className="flex flex-1 flex-col pt-2">
        <ComingSoonCard thing="Wallet" line={WALLET_LINE} node={{ path: "wallet.comingSoonCard" }} />
      </div>
      <JoinPrompt open={joinPrompt} onClose={() => setJoinPrompt(false)} />
    </main>
  );
}
