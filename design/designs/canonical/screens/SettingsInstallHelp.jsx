/* ADD COGRA TO YOUR HOME SCREEN, WHERE THE BROWSER CANNOT ASK (round 39,
   jakob 2026-11-11, seam 285). The install row's tap in a browser that can
   install the app by hand but never prompts — iOS Safari — raises this.

   IT IS `HelpDialog`'S SHAPE, one topic over: a heading naming the thing
   asked about — the row's own label — one short paragraph, and `Close`. No
   button that installs: the browser offers none to a page, so the dialog
   says the two taps and leaves.

   WHERE THE BROWSER CAN ASK — Android Chrome — the tap raises the browser's
   own install prompt instead, and nothing of ours is drawn.

   THE PAGE BENEATH is `SettingsBody` with the install row shown, scrolled to
   the row that was pressed under a pinned header, `EraseConfirm`'s
   construction. It is inactive under the scrim and wired on `Settings`.

   REGISTERED under the `settings` prefix, as `EraseConfirm` is: the dialog is
   `dialog`, its one answer `close`. */
export const NODE = "settings";

export function Screen() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: -1120, display: "flex", flexDirection: "column" }}>
          <SettingsBody install="block" />
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "var(--surface)" }}>
          <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
        </div>
      </div>
      <DialogSurface
        node="dialog"
        onScrimPress={() => {}}
        title="Add CoGra to your home screen"
        body="In Safari, tap Share, then Add to Home Screen."
        actions={<Button node="close">Close</Button>}
      />
    </>
  );
}
