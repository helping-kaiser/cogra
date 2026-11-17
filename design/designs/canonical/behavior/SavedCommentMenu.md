# SavedCommentMenu · `spec:design:behavior-saved-comment-menu`

WHEN tap the ⋮ on saved.commentCard GIVEN the comment is someone else's -> saved.menuSheet rises over Saved, unstacked, AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then Hide with the comment's author's handle, then saved.menuSheet.citedBy, then Opinions on this, then License terms, then saved.menuSheet.report at the sheet tail, the comment's menu's own rows with the comment kept

WHEN tap saved.menuSheet.hide -> the sheet closes AND every card in Saved stays where it is AND the snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

ALWAYS saved.menuSheet.hide reads Unhide with the comment's author's handle GIVEN the author is already hidden, the hidden author's comment still standing here, and keeps its one name whatever it reads, as the reader's comment menu reads it

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo

WHEN tap saved.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over Saved

WHEN tap saved.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over Saved

WHEN tap saved.menuSheet.report -> the menu closes AND the report confirm rises over Saved, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
