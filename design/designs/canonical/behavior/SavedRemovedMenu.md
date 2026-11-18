# SavedRemovedMenu · `spec:design:behavior-saved-removed-menu`

WHEN tap the ⋮ of a removed post's card in Saved GIVEN the post is another's -> saved.menuSheet rises over Saved AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then Hide with the author's handle, then saved.menuSheet.citedBy, then Opinions on this, then License terms, then saved.menuSheet.report at the sheet tail, the reader's post menu whole with the post kept GIVEN the post was removed, by its author or by a passed proposal

ALWAYS the rows read the same whichever removed the post, its author or a passed proposal

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo

WHEN tap saved.menuSheet.hide -> the sheet closes AND every card in Saved stays where it is AND the snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap saved.menuSheet.license -> the menu closes AND the terms the post was published under come up over Saved, as any post's do

WHEN tap saved.menuSheet.report -> the menu closes AND the report confirm rises over Saved, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
