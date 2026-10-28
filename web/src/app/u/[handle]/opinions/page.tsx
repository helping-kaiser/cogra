import { directionOf } from "@/lib/profile/opinions-route";
import { OpinionsScreen } from "./opinions-view";

// Someone's opinions page (`ProfileStances`), a drill-in under their profile.
// The tab it stands on and the profile's own origin ride the address.
export default async function ProfileOpinionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { handle } = await params;
  const { from, tab } = await searchParams;
  return (
    <OpinionsScreen
      handle={handle}
      from={typeof from === "string" ? from : null}
      tab={directionOf(typeof tab === "string" ? tab : null)}
    />
  );
}
