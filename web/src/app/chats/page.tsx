import type { Metadata } from "next";

import { ChatsView } from "./chats-view";

export const metadata: Metadata = { title: "Chats — CoGra" };

export default function ChatsPage() {
  return <ChatsView />;
}
