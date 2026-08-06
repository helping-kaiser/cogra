import { RootView } from "./root-view";

// "/" branches in place on the auth phase (web.md § Routes): the invite
// front door signed out, the member shell signed in.
export default function RootPage() {
  return <RootView />;
}
