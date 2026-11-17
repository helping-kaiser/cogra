/* Your own profile — the tab (profile round, item 23). The compact shape:
   avatar left with its change badge (a standalone signed act → the crop-and-seal
   flow), name/handle/figures beside it, bio, then Edit profile + Invites sharing
   the row. The gear and the overflow hang off the band per design.md §6 — never
   down in the header — and the ⋮ opens the sheet holding Saved, History and
   Share your profile. The icon tab row reads Posts, Comments, Everything, and
   THE PROFILE LANDS ON POSTS (jakob 2026-11-13, the android hand test: "land
   on posts as the default (learned behavior from other socials)"): the `tab`
   chip draws `posts`, the landing, and `everything`, the chronicle the tab
   opens (`ProfileTabs`). Sol has no
   picture: the monogram is the designed fallback, and the badge on it reads as
   "add one".

   THE PAGE IS `ProfileOwnBody`, in `_shared.jsx`: the band's menu draws this
   same page under its sheet, and the chronicle's page-failure state draws it
   with one row added. Three boards, one drawing.

   THE `change` CHIP DRAWS A PROFILE OR PICTURE CHANGE AFTER CLOSE (round 41;
   jakob 2026-11-11, S3 (a)). `ProfileEditSeal` and `AvatarSeal` read `Close`
   from the press and the change goes on; the head stands as it was until the
   change is taken, and the line under it carries the wait — the row's bare
   `Signing…`, the edit form of `SigningAfterClose` — and then, if it did not
   sign, `That didn't sign.` with `Retry`, which asks the same signing again.
   Taken, the line goes, the head shows the change and the snackbar confirms,
   as each seal's landing does. The states are drawn copies; they carry no
   names (the Handle row's precedent, `Settings`).

   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061), the
   surface every profile board shares: the body names its parts, and `NODE`
   carries them onto the built board and into `nodes.json`. */
export const NODE = "profile";
export const PROPS = {
  change: { editor: "enum", options: ["none", "signing", "failed"], default: "none" },
  ...TAB_CHIP,
};
export const VALS = `changeSigningShown: this.props.change === "signing" ? "block" : "none", changeFailedShown: this.props.change === "failed" ? "block" : "none", ${TAB_VALS}`;
const HEAD_LINE = { padding: "var(--space-2) var(--space-4) var(--space-3)" };
export function Screen() {
  return (
    <ProfileOwnBody
      tab="chip"
      headLine={
        <>
          <div style={{ display: "{{changeSigningShown}}", ...HEAD_LINE }}>
            <PendingMarker label="Signing…" />
          </div>
          <div style={{ display: "{{changeFailedShown}}", ...HEAD_LINE }}>
            <SigningPending row onRetry={() => {}} />
          </div>
        </>
      }
    />
  );
}
