// What a profile change holds, in the seal's acts row (ProfileEditSeal.md:3:
// "one acts-card row, Profile, saying what the change holds").
//
// The board draws one sample, `A new picture, bio and website`, and
// copy-voice blesses it (*The profile's seal*). The rule read off it, and
// built: the parts that change are named in the edit's own order — picture,
// display name, bio, website — after `A new`, listed with commas and a final
// `and`. Two cases the sample does not draw are named in the PR as gaps for
// design: a picture REMOVED (`the picture removed`, after any new parts) and
// a Save that changes nothing (`Nothing changed`, the seal still signing
// the same version, as Save always did).

import type { ProfileMediaChoice } from "./profile-media-field";

export type ProfileFields = {
  readonly displayName: string;
  readonly bio: string;
  readonly websiteUrl: string;
};

function listed(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function changeSummary(
  before: ProfileFields,
  after: ProfileFields,
  picture: ProfileMediaChoice,
): string {
  const renewed: string[] = [];
  if (picture.kind === "picked") renewed.push("picture");
  if (after.displayName.trim() !== before.displayName.trim()) renewed.push("display name");
  if (after.bio.trim() !== before.bio.trim()) renewed.push("bio");
  if (after.websiteUrl.trim() !== before.websiteUrl.trim()) renewed.push("website");
  const said: string[] = [];
  if (renewed.length > 0) said.push(`A new ${listed(renewed)}`);
  if (picture.kind === "cleared") said.push(said.length === 0 ? "The picture removed" : "the picture removed");
  return said.length === 0 ? "Nothing changed" : said.join(", ");
}
