# SavedCommentMenu · `spec:design:behavior-saved-comment-menu`

WHEN tap the ⋮ on saved.commentCard GIVEN the comment is someone else's -> saved.menuSheet rises over Saved, unstacked, AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then saved.menuSheet.citedBy, then Opinions on this, then License terms, then saved.menuSheet.report at the sheet tail, the comment's menu's own rows with the comment kept

ALWAYS the comment's menu carries no Hide row

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo

WHEN tap saved.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over Saved

WHEN tap saved.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over Saved

WHEN tap saved.menuSheet.report -> the menu closes AND the report confirm rises over Saved, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
