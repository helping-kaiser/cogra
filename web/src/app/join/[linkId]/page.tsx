// The invite link route (auth.md "Link URLs"). Server-rendered so the
// link unfurls; the inviter's handle rides the OpenGraph description
// when the backend is reachable at render time.

import type { Metadata } from "next";

import { InviteLinkCheckDocument } from "@/__generated__/graphql";
import { query } from "@/lib/apollo-client";
import { extractInviteId } from "@/lib/onboarding/invite-input";
import { JoinView } from "./join-view";

type Props = { params: Promise<{ linkId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const base: Metadata = {
    title: "Join CoGra",
    description: "You've been invited to CoGra.",
  };
  const { linkId } = await params;
  const id = extractInviteId(linkId);
  if (id === null) return base;
  try {
    const { data } = await query({ query: InviteLinkCheckDocument, variables: { id } });
    const check = data?.inviteLinkCheck ?? null;
    if (check === null || !check.usable) return base;
    return {
      ...base,
      description: `@${check.inviterHandle} is vouching for you on CoGra.`,
    };
  } catch {
    // An unreachable backend must not break the page — the unfurl just
    // stays generic.
    return base;
  }
}

export default async function JoinPage({ params }: Props) {
  const { linkId } = await params;
  return <JoinView linkId={linkId} />;
}
