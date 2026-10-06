# EditCompose · `spec:design:behavior-edit-compose`

ALWAYS every change the edit makes signs together in one batch

ALWAYS the footer reads the live count of the batch, You're signing N things

WHEN tap the footer GIVEN the batch holds an act -> the acts sheet opens over the edit

ALWAYS the License row shows the license as signed, with the lock and no action

ALWAYS the Sensitive row stands beside the License row and opens the sensitive sheet

ALWAYS the line A post's body is words or media, never both. stands under the gallery

WHEN tap the picked row -> the Show all sheet opens over the edit itself

WHEN press + Add pictures · 2 of 10 -> the device's own picker opens AND NEVER a pick stage opens

WHEN pictures are picked from + Add pictures -> they pass the crop locked to the post's one shape AND the picked row grows by them

WHEN pictures picked from + Add pictures break the cap of ten or come in a format nothing here reads -> the refusal says why on the media row AND NEVER a dialog opens

WHEN tap the × of a tag the post already carries -> the withdrawal of that tag is staged in the batch AND the chip leaves the row for the line Withdrawn: under the tags AND the footer counts one more AND NEVER a dialog asks

WHEN tap the × of a citation the post already carries -> the withdrawal of that citation is staged in the batch AND the row leaves for the line Withdrawn: under the references AND the footer counts the withdrawal's counter-records, possibly more than one AND NEVER a dialog asks

WHEN tap the × of a tag picked in this same edit -> the pick is unstaged AND the chip leaves the row AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap the × of a citation picked in this same edit -> the pick is unstaged AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap Undo on a Withdrawn: line -> the withdrawal is unstaged AND the chip or the row returns as it stood AND the line goes AND the footer counts the withdrawal's records off

WHEN tap a staged tag chip -> the tag's pair opens in a sheet over the edit

WHEN tap a staged citation's row -> the citation's pair opens in a sheet over the edit

ALWAYS a standing citation whose target was removed keeps its row, wearing the removed-mark face in place of a live preview, with Removed by its author where the name stood

ALWAYS a standing citation whose target was removed keeps its pair, its sheet and its ×, and adds nothing to the batch by standing

ALWAYS the line Uploading N of M — signing waits for the picture. stands above the acts footer GIVEN pictures the edit took are uploading and M is 1

ALWAYS the line Uploading N of M — signing waits for the pictures. stands above the acts footer GIVEN pictures the edit took are uploading and M is 2 or more

ALWAYS Sign the edit is enabled GIVEN an upload is running

WHEN press Sign the edit GIVEN an upload is running -> Sign the edit refuses a second press AND NEVER anything is signed before the last upload lands AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after a press of Sign the edit, held at the upload gate or not -> Sign the edit reads Signing the edit… in its own place AND the header back arrow and the header X refuse a press AND NEVER a spinner appears

ALWAYS each picture the edit took that is still uploading wears its progress as a ring on its thumbnail

WHEN the signing has not answered 5s after the press -> the line Still signing — the network is slow right now. stands under the acts footer AND NEVER a progress indicator appears

WHEN the signing answers GIVEN the slow line stands under the acts footer -> the slow line goes

WHEN the last upload lands GIVEN Sign the edit was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN an upload fails GIVEN Sign the edit was pressed while the uploads ran -> the held press drops AND the gate line takes its fault reading AND Sign the edit reads Sign the edit again AND the header back arrow and the header X answer again AND NEVER anything is signed

ALWAYS Sign the edit is disabled GIVEN the gate line shows its fault reading

WHEN press Retry GIVEN the held press dropped -> the gate runs again AND NEVER signing proceeds until Sign the edit is pressed again

WHEN a picture the edit took fails to upload -> its thumbnail is marked AND the line One picture didn't upload. stands under the picked row with Retry and Remove it AND the gate line takes its fault reading

WHEN press Retry under the picked row -> the failed upload tries again AND the gate runs again

WHEN press Remove it under the picked row GIVEN nothing else the edit took is uploading -> the failed picture leaves the batch AND the gate line goes AND Sign the edit is enabled

WHEN the last upload lands GIVEN Sign the edit was not pressed -> the upload line goes AND Sign the edit stays as it was

WHEN press Sign the edit GIVEN the signing is taken -> the post opens with the edit settling

WHEN press Sign the edit GIVEN the signing key is not on this device -> the key-absent seal stands AND nothing is staged or signed

WHEN press Sign the edit GIVEN the signing is refused by the write rule -> the notice You can't sign right now takes the commit's place AND NEVER Retry appears

WHEN press the header back arrow -> the edit is left toward where it began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the edit is left AND the draft is kept AND NEVER a dialog asks

WHEN the stage opens -> focus lands on the stage's heading AND NEVER the keyboard rises before a field is tapped
