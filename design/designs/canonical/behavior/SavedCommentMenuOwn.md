# SavedCommentMenuOwn · `spec:design:behavior-saved-comment-menu-own`

WHEN tap the ⋮ on saved.commentCard GIVEN the comment is the reader's own -> saved.menuSheet rises over Saved, unstacked, AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then Edit, then Remove, then saved.menuSheet.citedBy, then Opinions on this, then License terms, the own comment menu's rows, and carries no Report row

WHEN tap saved.menuSheet.edit -> the menu closes AND the comment's edit opens over Saved

WHEN tap saved.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over Saved

WHEN tap saved.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over Saved

WHEN tap saved.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over Saved

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes

WHEN the comment's edit opened from saved.menuSheet.edit is signed -> Saved comes back as it was left AND the comment's card settles in place wearing Still settling AND NEVER the thread opens

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo
