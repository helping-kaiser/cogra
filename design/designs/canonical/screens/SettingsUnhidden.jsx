/* HIDDEN ACCOUNTS, JUST AFTER AN UNHIDE (jakob 2026-10-07, ruling 65; the
   private-viewer-state round's "Unhide rides the row, no confirm"). The
   sheet `SettingsHidden` draws, a moment after `Unhide` on its first row.

   THE ROW HAS GONE AND THE LIST HAS CLOSED OVER IT. @juno led the list a
   moment ago; the two still hidden have moved up, and nothing marks the
   space — `FeedHidden`'s rule for the rows a hide takes out of the feed,
   met here from the other side. The sheet stays open because people are
   still in it; the last one unhidden closes it onto settings instead, its
   row reading `None`, and the same line answers there.

   THE SNACKBAR SAYS HOW FAR IT REACHES. `@juno is unhidden — their posts can
   reach your feed again.` with `Undo` — the hide's own construction turned
   round, the second clause again the one that matters: unhiding brings a
   person's posts back to where the ranker can place them, it does not put
   them anywhere. `Undo` hides them again.

   THE LINE RIDES ABOVE THE SHEET. The tap was made in the sheet and the
   sheet is still up, so the message is raised over it — at the screen's
   foot, where a surface with no bar keeps it (`Snackbar`'s 16px), and above
   the sheet's own layer, since a line drawn under the scrim would answer
   nobody. Beneath the scrim the settings row already counts the two left.

   IT IS `SettingsHidden` WITH ONE ROW GONE, not a second sheet.

   REGISTERED under the `settings` prefix (design ⇄ impl seam 059/061, the
   Hide packet's registration ask), named as `SettingsHidden` names the
   page and the sheet; the snackbar is `snackbar`, its `message` and its
   `action`. */
export const NODE = "settings";
export function Screen() {
  return (
    <>
      <SettingsBody hidden="2" />

      <BottomSheet open ariaLabel="Hidden accounts" maxHeight="88%" node="hiddenSheet">
        <SheetTitle node="title">Hidden accounts</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 var(--space-6)" }} data-node="list">
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            image="comment-camera.jpg"
            title="Ada Okonkwo"
            titleAside="@ada"
            second="Hidden 14d"
            trailing={
              <InlineAction onClick={() => {}} node="unhide">
                Unhide
              </InlineAction>
            }
            node="account"
            nodeKey="ada"
          />
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            name="Tobias Lindqvist"
            title="Tobias Lindqvist"
            titleAside="@tobias"
            second="Hidden 12.08.2026"
            trailing={
              <InlineAction onClick={() => {}} node="unhide">
                Unhide
              </InlineAction>
            }
            node="account"
            nodeKey="tobias"
          />
        </div>
      </BottomSheet>

      <div style={{ position: "relative", zIndex: 50 }}>
        <Snackbar message="@juno is unhidden — their posts can reach your feed again." action="Undo" offset={16} node="snackbar" />
      </div>
    </>
  );
}
