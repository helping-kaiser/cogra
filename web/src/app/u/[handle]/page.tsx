import type { Metadata } from "next";

import { UserProfileDocument } from "@/__generated__/graphql";
import { query } from "@/lib/apollo-client";
import { ProfileScreen } from "./profile-view";

// A profile URL is a shareable surface, so its unfurl metadata renders
// on the server (web.md "Links unfurl"). The page body stays a client
// view like every other read surface.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  try {
    const { data } = await query({
      query: UserProfileDocument,
      variables: { handle },
    });
    const user = data?.user;
    if (!user) return { title: "Profile — CoGra" };
    const name = user.displayName.value?.trim() ? user.displayName.value : user.handle;
    return {
      title: `${name} (@${user.handle}) — CoGra`,
      description: user.bio.value ?? undefined,
    };
  } catch {
    // An unreachable backend must not break the page render; the
    // client view carries its own error surface.
    return { title: "Profile — CoGra" };
  }
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <ProfileScreen handle={handle} />;
}
