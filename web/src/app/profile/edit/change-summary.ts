// What a profile change holds, in the seal's acts row (ProfileEditSeal.md:3:
// "one acts-card row, Profile, saying what the change holds").
//
// The row names the STAGED parts (ProfileEditSeal.md:5), never the parts
// whose bytes differ: "ALWAYS the edit signs only when a change is staged,
// never by comparing the fields' bytes" (ProfileEdit.md:39). A field the
// author typed in is staged, even when it was typed back to what it was —
// a byte comparison would refuse that author (design/readme.md, the
// unchanged-edit guard). With nothing staged the seal never opens
// (ProfileEdit.md:45), so the row has no empty reading.

import type { ProfileMediaChoice } from "./profile-media-field";

export type ProfileFields = {
  readonly displayName: string;
  readonly bio: string;
  readonly websiteUrl: string;
};

/** Which of the edit's fields hold a staged change. */
export type StagedFields = {
  readonly displayName: boolean;
  readonly bio: boolean;
  readonly websiteUrl: boolean;
};

export const NOTHING_STAGED: StagedFields = { displayName: false, bio: false, websiteUrl: false };

/** Whether the edit holds any staged change at all, the picture's included. */
export function anythingStaged(fields: StagedFields, picture: ProfileMediaChoice): boolean {
  return fields.displayName || fields.bio || fields.websiteUrl || picture.kind !== "unchanged";
}

function listed(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The Profile row's value: `A new` and the staged parts in the edit's order —
 * picture, display name, bio, website — then `the picture removed` after
 * them, or `The picture removed` alone (ProfileEditSeal.md:5, :7, :9).
 */
export function changeSummary(fields: StagedFields, picture: ProfileMediaChoice): string {
  const renewed: string[] = [];
  if (picture.kind === "picked") renewed.push("picture");
  if (fields.displayName) renewed.push("display name");
  if (fields.bio) renewed.push("bio");
  if (fields.websiteUrl) renewed.push("website");
  const said: string[] = [];
  if (renewed.length > 0) said.push(`A new ${listed(renewed)}`);
  if (picture.kind === "cleared") said.push(said.length === 0 ? "The picture removed" : "the picture removed");
  return said.join(", ");
}
