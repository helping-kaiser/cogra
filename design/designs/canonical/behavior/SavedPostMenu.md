# SavedPostMenu · `spec:design:behavior-saved-post-menu`

WHEN tap a post card's ⋮ in Saved GIVEN the post is someone else's -> saved.menuSheet rises over Saved AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then Hide with the author's handle, then saved.menuSheet.citedBy, then Opinions on this, then License terms, then saved.menuSheet.report at the sheet tail, the reader's post menu's own rows with the post kept

ALWAYS saved.menuSheet carries no row of Saved's own, Unsave being how a thing leaves Saved

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo

WHEN tap saved.menuSheet.hide -> the sheet closes AND every card in Saved stays where it is AND the snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap saved.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over Saved

WHEN tap saved.menuSheet.report -> the menu closes AND the report confirm rises over Saved, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes

ALWAYS saved.menuSheet.hide reads Unhide with the author's handle GIVEN the author is already hidden, the hidden author's post still standing here, and keeps its one name whatever it reads, as the reader's post menu reads it
