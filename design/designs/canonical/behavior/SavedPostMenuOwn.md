# SavedPostMenuOwn · `spec:design:behavior-saved-post-menu-own`

WHEN tap the ⋮ on saved.card GIVEN the post is the reader's own -> saved.menuSheet rises over Saved AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Cite in a new post, then Edit, then Mark as sensitive, then Remove, then saved.menuSheet.citedBy, then Opinions on this, then License terms, the own post menu's rows with the post kept, and carries no Hide and no Report row

WHEN tap saved.menuSheet.edit -> the post's edit opens

WHEN tap saved.menuSheet.markSensitive -> the post's edit opens AND NEVER the post is marked without the edit's signing

WHEN tap saved.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over Saved

WHEN tap saved.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over Saved

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo
