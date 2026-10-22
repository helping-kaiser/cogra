import type { Metadata } from "next";

import { ChatsView } from "./chats-view";

export const metadata: Metadata = { title: "Chats — CoGra" };

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { from } = await searchParams;
  // The back arrow names the root, or the profile, the chats were opened from
  // (ChatsComingSoon.md:15-17).
  return <ChatsView from={typeof from === "string" ? from : null} />;
}
