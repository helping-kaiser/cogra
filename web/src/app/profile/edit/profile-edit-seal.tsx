"use client";

// ProfileEditSeal — the profile change's "What you sign" moment
// (design/designs/canonical/screens/ProfileEditSeal.jsx, ProfileEditSeal.md).
// Every profile change is a signed act, so Save opens this seal and nothing
// is signed before its own commit (ProfileEdit.md:15).
//
// It reads back the profile's head row (the picture at 64 and `Your
// profile`) and one acts-card row `Profile` saying what the change holds,
// counted `1 profile change`; the "?" in the header is `Changing your
// profile`. The page and its commit are the profile seals' one drawing,
// `ChangeSeal`, which `AvatarSeal` shares.

import type { ReactNode } from "react";

import type { ProfileChangeOutcome } from "@/lib/profile/profile-change";
import type { SignedProfileChange } from "@/lib/profile/signed-profile";
import { ChangeSeal, type ChangeSealReading } from "../change-seal";

export {
  BUG_FACT,
  BUG_TITLE,
  OFFLINE_LINE,
  PUBLIC_RECORD_LINE,
  SEAL_LEAVE,
  SEAL_TITLE,
  SIGN_THE_CHANGE,
  SIGNING_THE_CHANGE,
  WRITE_RULE_FACT,
  WRITE_RULE_TITLE,
} from "../change-seal";

function reading(change: string): ChangeSealReading {
  return {
    testId: "profile-edit-seal",
    head: "Your profile",
    row: { label: "Profile", value: change, countNoun: "profile change" },
    help: { label: "Changing your profile", topic: "changingYourProfile" },
  };
}

export function ProfileEditSeal({
  avatar,
  change,
  ...commit
}: {
  /** The head row's picture, as the edit last left it. */
  avatar: ReactNode;
  /** What the change holds, the acts row's value. */
  change: string;
  hasKey: () => Promise<boolean>;
  sign: () => Promise<ProfileChangeOutcome>;
  /** What the change sets, for the profile's head once it is taken. */
  signed?: SignedProfileChange;
  onTaken: () => void;
  /** One stage back, to the edit as it was left. */
  onBack: () => void;
  onLeave: () => void;
  onClosed: () => void;
}) {
  return <ChangeSeal reading={reading(change)} avatar={avatar} {...commit} />;
}
