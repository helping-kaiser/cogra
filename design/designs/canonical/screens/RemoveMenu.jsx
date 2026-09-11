/* AN OWN POST'S MENU — the bottom sheet with the rare interactions.

   SAVE LEADS HERE TOO (jakob 2026-09-11). Saving is private, so whose post it
   is has nothing to do with whether a reader may keep it, and the Saved list is
   a shelf — exactly what a person reaches for on their own work. It takes the
   first row on every menu that has it, so the thumb learns one position; the
   one menu that also holds Remove is the last place to move rows around. The
   license closes this menu as it closes the others.

   THE ROWS ARE `OWN_POST_MENU`, not four written out by hand. The list is the
   same atom `DetailHeader` is handed above, so the sheet a reader sees and the
   menu the header mounts cannot disagree — which is how the other three menu
   boards have always been drawn. */
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard {...SOL_POST} variant="detail" bundle={mkBundle(0.1, 1)} />
      </DetailColumn>
      <BottomSheet open ariaLabel="Post actions">
        {OWN_POST_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
