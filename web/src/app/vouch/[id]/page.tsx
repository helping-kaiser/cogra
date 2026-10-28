// The ask link route (auth.md "Link URLs": `/vouch/<link-id>`). The id is
// the capability, so the page renders nothing about the asker until the
// client's own check reads it — no server-side unfurl names a person.

import type { Metadata } from "next";

import { VouchAskView } from "./vouch-ask-view";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "A vouch, asked for — CoGra" };

export default async function VouchAskPage({ params }: Props) {
  const { id } = await params;
  return <VouchAskView id={id} />;
}
