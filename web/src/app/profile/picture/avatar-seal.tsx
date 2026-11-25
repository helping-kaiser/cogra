"use client";

// AvatarSeal — the picture's own "What you sign" moment, reached from the
// head's change badge through the crop (design/designs/canonical/screens/
// AvatarSeal.jsx, AvatarSeal.md). Changing the picture is a signed act of its
// own, so it gets the moment a profile change gets: the profile seals' one
// drawing (`ChangeSeal`), reading back `Your profile picture` beside the new
// picture and the one acts row `Picture`, `A new profile picture`, counted
// `1 picture`; its "?" is `Changing your picture` (copy-voice, blessed jakob
// 2026-10-20). Its bug notice's `Not now` returns to the crop with the
// picture as it was (AvatarSeal.md:35) — the seal's one stage back.

import type { ReactNode } from "react";

import type { ProfileChangeOutcome } from "@/lib/profile/profile-change";
import type { SignedProfileChange } from "@/lib/profile/signed-profile";
import { ChangeSeal, type ChangeSealReading } from "../change-seal";

export const AVATAR_SEAL_HEAD = "Your profile picture";
export const AVATAR_SEAL_ROW = { label: "Picture", value: "A new profile picture", countNoun: "picture" } as const;

const READING: ChangeSealReading = {
  testId: "avatar-seal",
  head: AVATAR_SEAL_HEAD,
  row: AVATAR_SEAL_ROW,
  help: { label: "Changing your picture", topic: "changingYourPicture" },
};

export function AvatarSeal(props: {
  /** The new picture in its framing, at the head row's 64. */
  avatar: ReactNode;
  hasKey: () => Promise<boolean>;
  sign: () => Promise<ProfileChangeOutcome>;
  /** The new picture, for the profile's head once the change is taken. */
  signed?: SignedProfileChange;
  onTaken: () => void;
  /** One stage back: the crop, the picture as it was framed. */
  onBack: () => void;
  onLeave: () => void;
  onClosed: () => void;
}) {
  return <ChangeSeal reading={READING} {...props} />;
}
