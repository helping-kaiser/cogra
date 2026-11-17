"use client";

// The head's change badge opening the picker (Profile.md:47). On the web the
// picker is the browser's own file dialog, which opens only from the reader's
// own gesture, so the badge's tap clicks a hidden file input here and the
// pick is handed to the picture's flow (`held-picture.ts`, `/profile/picture`).
// The input takes what the edit's `Change picture` takes: any picture.

import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { holdPicture } from "@/lib/profile/held-picture";

export const PICTURE_FLOW = "/profile/picture";

export function usePicturePick(): { open: () => void; input: ReactNode } {
  const router = useRouter();
  const ref = useRef<HTMLInputElement | null>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      tabIndex={-1}
      aria-hidden="true"
      data-testid="profile-change-badge-input"
      onChange={(event) => {
        const picked = event.target.files?.[0];
        event.target.value = "";
        if (picked === undefined) return;
        holdPicture(picked);
        router.push(PICTURE_FLOW);
      }}
      className="sr-only"
    />
  );
  return { open: () => ref.current?.click(), input };
}
