# ReelMenu · `spec:design:behavior-reel-menu`

WHEN tap reel.rail.menu -> reel.menuSheet rises over the stream AND the stream stands beneath its wash, the clip, reel.rail and reel.caption in view

ALWAYS reel.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then reel.menuSheet.citedBy, then Opinions on this, then License terms, then reel.menuSheet.report at the sheet tail, the reader's post menu's own rows, GIVEN the clip is someone else's

ALWAYS reel.menuSheet reads Save or Unsave, then Cite in a new post, then Edit, then Mark as sensitive, then Remove, then reel.menuSheet.citedBy, then Opinions on this, then License terms, the own post menu's rows, and carries no Hide and no Report row, GIVEN the clip is the reader's own

ALWAYS the stream adds no row to the post's menu and takes none away

ALWAYS Opinions on this and reel.menuSheet.citedBy stand in reel.menuSheet whatever their counts

WHEN tap reel.menuSheet.save GIVEN the post is not kept -> the post is kept AND the sheet closes AND the snackbar reads Saved.

WHEN tap reel.menuSheet.save GIVEN the post is kept -> the sheet closes AND the snackbar reads Removed from Saved. with Undo

WHEN tap reel.menuSheet.cite -> the post wizard opens fresh at its first stage AND the post rides along unseen until the details stage

WHEN tap reel.menuSheet.citedBy -> the menu closes AND what cites the post comes up in its Cited by sheet over the stream

WHEN tap Opinions on this -> the menu closes AND the post's opinions sheet comes up over the stream

WHEN tap reel.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the stream

WHEN tap reel.menuSheet.report -> the menu closes AND the report confirm rises over the stream, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap reel.menuSheet.edit or Mark as sensitive -> the post's edit opens

WHEN tap reel.menuSheet.remove -> the think-twice dialog opens over the stream

WHEN a guest taps Save, Cite in a new post, Hide or Report on reel.menuSheet -> the guest gate opens AND NEVER reel.menuSheet.citedBy, Opinions on this or License terms raise it, a reading being open to a guest

WHEN an applicant taps Cite in a new post on reel.menuSheet -> the menu closes AND the snackbar reads You can post once you're in. AND NEVER the wizard opens

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND the stream stands as it was
