"use client";

// The picture's own flow route — the head's change badge's destination. The
// screen is `AvatarFlowScreen`, which takes its identity store as a test seam
// the route itself cannot (a page's props are the framework's).

import { AvatarFlowScreen } from "./avatar-flow-screen";

export default function ProfilePicturePage() {
  return <AvatarFlowScreen />;
}
