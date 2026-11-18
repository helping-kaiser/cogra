# SavedProfileMenu · `spec:design:behavior-saved-profile-menu`

WHEN tap the ⋮ on saved.profileCard -> saved.menuSheet rises over Saved, unstacked, AND Saved stands unchanged beneath its wash

ALWAYS saved.menuSheet reads Unsave, then Mention in a new post, then Hide with the person's handle, then saved.menuSheet.report at the sheet tail, the menu of saved.profileCard with the person kept

ALWAYS saved.menuSheet.hide reads Unhide with the person's handle GIVEN the person is hidden, a hidden account's profile staying in Saved, and keeps its one name whatever it reads

WHEN tap saved.menuSheet.save -> the sheet closes AND the card leaves Saved AND the cards behind it move up AND saved.snackbar reads Removed from Saved. with Undo

WHEN tap saved.menuSheet.hide -> the sheet closes AND every card in Saved stays where it is AND the snackbar reads @mira is hidden. with Undo AND NEVER a confirm step appears

WHEN tap saved.menuSheet.report -> the menu closes AND the confirm sheet rises over Saved, naming the person

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
