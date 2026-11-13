"use client";

// The profile edit route — the screen is `ProfileEditScreen`, which takes its
// identity store as a test seam the route itself cannot (a page's props are
// the framework's).

import { ProfileEditScreen } from "./profile-edit-screen";

export default function ProfileEditPage() {
  return <ProfileEditScreen />;
}
