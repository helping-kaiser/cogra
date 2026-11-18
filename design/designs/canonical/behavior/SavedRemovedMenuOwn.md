# SavedRemovedMenuOwn · `spec:design:behavior-saved-removed-menu-own`

WHEN tap saved.card.menu GIVEN the card is the reader's own removed post -> saved.menuSheet rises over Saved AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then saved.menuSheet.citedBy, then Opinions on this, then License terms, your own post's menu less Edit, Mark as sensitive and Remove, with the post kept

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo

WHEN tap saved.menuSheet.license -> the menu closes AND the terms the post was published under come up over Saved, as any post's do

WHEN tap saved.menuSheet.cite -> the post wizard opens as New post opens it, fresh at its first stage or, with a draft kept on this device, under the draft card, whose Continue takes what rides along into the draft AND the removed post rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
