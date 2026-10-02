# CommentEdit · `spec:design:behavior-comment-edit`

ALWAYS the comment edit is one screen and one batch: words, pictures, tags, citations and the license

ALWAYS the comment edit's license row is locked

ALWAYS the comment edit holds at most four pictures, uncropped

ALWAYS the footer reads the live count of the batch, You're signing N things

WHEN tap the acts footer -> the acts sheet opens over the edit

WHEN tap a picture's remove control -> the picture leaves the batch

WHEN tap + Add pictures -> the platform's own picker opens AND NEVER a pick stage opens

WHEN tap the × of a tag the comment already carries -> the withdrawal of that tag is staged in the batch AND the chip leaves the row for the line Withdrawn: under the tags AND the footer counts one more AND NEVER a dialog asks

WHEN tap the × of a citation the comment already carries -> the withdrawal of that citation is staged in the batch AND the row leaves for the line Withdrawn: under the references AND the footer counts the withdrawal's counter-records, possibly more than one AND NEVER a dialog asks

WHEN tap the × of a tag picked in this same edit -> the pick is unstaged AND the chip leaves the row AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap the × of a citation picked in this same edit -> the pick is unstaged AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap Undo on a Withdrawn: line -> the withdrawal is unstaged AND the chip or the row returns as it stood AND the line goes AND the footer counts the withdrawal's records off

WHEN tap a staged tag chip -> the tag's pair opens in a sheet over the edit

WHEN tap a staged citation's row -> the citation's pair opens in a sheet over the edit

WHEN tap Sign the edit -> Sign the edit refuses a second press until the signing answers AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after the press -> Sign the edit reads Signing the edit… AND NEVER a spinner appears

WHEN the signing is taken -> the thread reopens AND the edit settles on its card wearing Still settling

WHEN the signing does not go through GIVEN no answer reached the edit -> the network error answers AND everything the reader chose stays as it was

WHEN the write rule refuses the edit -> nothing is staged or spent AND the draft is kept AND NEVER Retry appears

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the commit's place AND Try again, Report a problem and Discard the edit stand with it

WHEN tap Discard the edit under the notice This shouldn't have happened -> the discard dialog Discard the changes? opens over the edit with Nothing is kept. AND NEVER the changes are discarded unasked
