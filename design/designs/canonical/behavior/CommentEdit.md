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

ALWAYS a standing citation whose target was removed keeps its row, wearing the removed-mark face in place of a live preview, with Removed by its author where the name stood

ALWAYS a standing citation whose target was removed keeps its pair, its sheet and its ×, and adds nothing to the batch by standing

ALWAYS the line Uploading N of M — signing waits for the pictures. stands above the acts footer GIVEN pictures the edit took are uploading

ALWAYS Sign the edit is enabled GIVEN an upload is running

WHEN press Sign the edit GIVEN an upload is running -> Sign the edit refuses a second press AND NEVER anything is signed before the last upload lands AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after the press GIVEN Sign the edit was pressed while the uploads ran -> Sign the edit reads Signing the edit… in its own place AND the header back arrow and the header X refuse a press AND NEVER a spinner appears

WHEN the signing has not answered 5s after the press -> the line Still signing — the network is slow right now. stands under the acts footer AND NEVER a progress indicator appears

WHEN the signing answers GIVEN the slow line stands under the acts footer -> the slow line goes

WHEN the last upload lands GIVEN Sign the edit was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN an upload fails GIVEN Sign the edit was pressed while the uploads ran -> the held press drops AND the gate line takes its fault reading AND Sign the edit reads Sign the edit again AND the header back arrow and the header X answer again AND NEVER anything is signed

ALWAYS Sign the edit is disabled GIVEN the gate line shows its fault reading

WHEN press Retry GIVEN the held press dropped -> the gate runs again AND NEVER signing proceeds until Sign the edit is pressed again

WHEN a picture the edit took fails to upload -> its thumbnail is marked AND the line One picture didn't upload. stands under the pictures with Retry and Remove it AND the gate line takes its fault reading

WHEN press Retry under the pictures -> the failed upload tries again AND the gate runs again

WHEN press Remove it under the pictures GIVEN nothing else the edit took is uploading -> the failed picture leaves the batch AND the gate line goes AND Sign the edit is enabled

WHEN the last upload lands GIVEN Sign the edit was not pressed -> the upload line goes AND Sign the edit stays as it was

WHEN tap Sign the edit -> Sign the edit refuses a second press until the signing answers AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after the press -> Sign the edit reads Signing the edit… AND NEVER a spinner appears

WHEN the signing is taken -> the thread reopens AND the edit settles on its card wearing Still settling

WHEN the signing does not go through GIVEN no answer reached the edit -> the network error answers AND everything the reader chose stays as it was

WHEN the write rule refuses the edit -> nothing is staged or spent AND the draft is kept AND NEVER Retry appears

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the commit's place AND Try again, Report a problem and Discard the edit stand with it

WHEN tap Discard the edit under the notice This shouldn't have happened -> the discard dialog Discard the changes? opens over the edit with Nothing is kept. AND NEVER the changes are discarded unasked
