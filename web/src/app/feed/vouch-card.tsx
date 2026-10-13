"use client";

// THE VOUCH CARD (the `VouchBack` board; behavior/VouchBack.md) — the feed's
// first card, above the posts, for a landed member whose pair with the member
// who vouched them in is incomplete. Android's twin is `feature/home`'s
// `VouchCard`.
//
// IT STANDS ON SERVER STATE ALONE (VouchBack.md:3): landed, `hasReciprocated`
// false, `vouchBackDismissed` false. No key term — a vouch-back set with the
// key elsewhere waits as any pick does — and no device memory: the put-away
// is account state and holds on every device (:45).
//
// IT RIDES THE FEED ONLY. The own profile carries the banner stack but never
// this card (the board is the feed's; `_shared.jsx` "surfaces as its own card
// on the feed"), and the profile of the member who vouched the reader in keeps
// the way open from there instead (:51).
//
// `Got it` IS A READ-SIDE COMFORT, so it answers at once: the card steps aside
// the moment it is pressed, silently — no snackbar, no reminder, nothing in its
// place (:37). A put-away that did not go through brings the card back into its
// place with `That didn't go through.` and `Retry` in its row (:39, ruling 44);
// the NEVERs describe the successful outcome only.
//
// THE CARD'S ACT IS THE FACE (seam 157/165, VouchBack.md:11): the stance
// control's own anchor, never a button of its own. A tap blooms the vouch-back
// pad at the gentle default (:39), a hold signs that default (:43), and a
// signing taken either way opens the ceremony (VouchBackPad.md:33). Cancel
// closes back onto this card with nothing staged (:45). One line beside it,
// `feed.vouchCard.hint`, teaches the tap and claims nothing about first-ness.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client/react";

import { dismissVouchBack, fetchMe, type MeUser } from "@/lib/api/auth-api";
import { useAuthGuard } from "@/lib/session/runtime";
import { MonogramAvatar } from "@/lib/ui/actor-chip";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { StanceControl } from "@/lib/ui/stance-control";
import { PillButton } from "@/lib/ui2/pill-button";
import {
  GOT_IT,
  PUT_AWAY_FAILED,
  RETRY,
  VOUCH_CARD_HINT,
  VOUCHED_IN_PATH,
  vouchBackVariant,
  vouchCardBody,
  vouchCardStands,
  vouchCardTitle,
  voucherOf,
} from "@/lib/vouch/vouch-back";

const NODE: DataNode = { path: "feed.vouchCard" };

/** Where the put-away stands: never asked, in flight, refused, or kept. */
type PutAway = "standing" | "asking" | "failed" | "away";

export function VouchCard({
  refreshSignal = 0,
}: {
  /** Bumped by the feed's own refresh, so the card re-reads with the list. */
  refreshSignal?: number;
}) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [putAway, setPutAway] = useState<PutAway>("standing");

  // Read with the feed and again on each of its refreshes: a signed
  // vouch-back that expired brings the card back (:57), and the next fresh
  // read is where that shows.
  useEffect(() => {
    let cancelled = false;
    void guard.run(() => fetchMe(client)).then((outcome) => {
      if (cancelled || outcome.kind !== "success") return;
      setMe(outcome.value);
    });
    return () => {
      cancelled = true;
    };
  }, [client, guard, refreshSignal]);

  if (me === null || !vouchCardStands(me)) return null;
  const voucher = voucherOf(me);
  if (voucher === null || putAway === "asking" || putAway === "away") return null;

  const askPutAway = async () => {
    setPutAway("asking");
    const outcome = await guard.run(() => dismissVouchBack(client));
    setPutAway(outcome.kind === "success" ? "away" : "failed");
  };

  // A list item of the feed's own list: the card is its first child.
  return (
    <li>
    <section
      {...testAttributes(NODE)}
      // The olive register (`VouchBackCard`): a feed card that needs the
      // reader's action wears `tertiaryContainer`, its ink the pair's own.
      className="flex flex-none flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
    >
      <div className="flex items-center gap-3">
        <MonogramAvatar
          name={voucher.name}
          src={voucher.avatarUrl}
          size="lg"
          node={part(NODE, "avatar")}
        />
        <h2 {...testAttributes(part(NODE, "title"))} className="m-0 text-title-medium">
          {vouchCardTitle(voucher.handle)}
        </h2>
      </div>
      <p {...testAttributes(part(NODE, "body"))} className="m-0 text-body-medium">
        {vouchCardBody(voucher.handle)}
      </p>
      <div className="flex items-center justify-end gap-2">
        {putAway === "failed" ? (
          <>
            {/* The row's own line, then Retry in Got it's slot. */}
            <p
              role="alert"
              data-testid="feed-vouch-card-failed"
              className="m-0 flex-1 text-body-small"
            >
              {PUT_AWAY_FAILED}
            </p>
            <PillButton
              testId="feed-vouch-card-retry"
              variant="inverseText"
              onClick={() => void askPutAway()}
            >
              {RETRY}
            </PillButton>
          </>
        ) : (
          <PillButton
            testId="feed-vouch-card-dismiss"
            node={part(NODE, "dismiss")}
            variant="inverseText"
            onClick={() => void askPutAway()}
          >
            {GOT_IT}
          </PillButton>
        )}
        {/* The line sits right against the face, which keeps the row's
            trailing seat; Got it leads (VouchBack.md:11, :13, :15). */}
        <p
          {...testAttributes(part(NODE, "hint"))}
          className="m-0 min-w-0 flex-1 text-end text-body-small"
        >
          {VOUCH_CARD_HINT}
        </p>
        <StanceControl
          target={{ id: voucher.id, kind: "profile", label: `@${voucher.handle}` }}
          testIdPrefix="vouch-back"
          node={part(NODE, "stance")}
          variant={vouchBackVariant(
            () => router.push(VOUCHED_IN_PATH),
            part(NODE, "stance.pad"),
          )}
        />
      </div>
    </section>
    </li>
  );
}
