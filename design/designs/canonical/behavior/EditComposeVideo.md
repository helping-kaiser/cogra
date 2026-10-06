# EditComposeVideo · `spec:design:behavior-edit-compose-video`

ALWAYS the clip itself never changes at an edit and is never swapped for another

ALWAYS the cover field reads Add a cover GIVEN no cover was ever chosen, even when a taken still exists

ALWAYS the cover field shows the chosen cover and Change the cover GIVEN a cover was chosen

ALWAYS the line A video is the whole post. stands where an add control would

ALWAYS every change the edit makes signs together in one batch

ALWAYS the License row shows the license as signed, with the lock and no action

WHEN tap Add a cover -> the device's own picker opens AND NEVER the clip's frames are offered

WHEN a picture is picked for the cover -> it passes the crop locked to the clip's shape AND the new cover joins the edit's batch

WHEN tap the clip's remove control -> the clip leaves whole AND the words edit stands with its field empty

WHEN tap Describe the video -> the describe sheet opens on one description for the clip, none for its cover

WHEN tap the × of a tag the post already carries -> the withdrawal of that tag is staged in the batch AND the footer counts one more AND NEVER a dialog asks

WHEN tap the × of a tag picked in this same edit -> the pick is unstaged AND the chip leaves the row AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN press Sign the edit GIVEN the signing is taken -> the post opens with the edit settling AND the clip points at the cover the edit set, if it set one

ALWAYS the line Uploading N of M — signing waits for the cover. stands above the acts footer GIVEN the cover the edit set is uploading

ALWAYS Sign the edit is enabled GIVEN an upload is running

WHEN press Sign the edit GIVEN an upload is running -> Sign the edit refuses a second press AND NEVER anything is signed before the last upload lands AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after a press of Sign the edit, held at the upload gate or not -> Sign the edit reads Signing the edit… in its own place AND the header back arrow and the header X refuse a press AND NEVER a spinner appears

ALWAYS the cover the edit set wears its upload's progress as a ring on its thumbnail, the ring drawn once on EditCompose's board at its uploading state GIVEN it is still uploading

ALWAYS a failed cover's line reads One picture didn't upload., the cover being one picture

WHEN the signing has not answered 5s after the press -> the line Still signing — the network is slow right now. stands under the acts footer AND NEVER a progress indicator appears

WHEN the signing answers GIVEN the slow line stands under the acts footer -> the slow line goes

WHEN the last upload lands GIVEN Sign the edit was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN an upload fails GIVEN Sign the edit was pressed while the uploads ran -> the held press drops AND the gate line takes its fault reading AND Sign the edit reads Sign the edit again AND the header back arrow and the header X answer again AND NEVER anything is signed

ALWAYS Sign the edit is disabled GIVEN the gate line shows its fault reading

WHEN press Retry GIVEN the held press dropped -> the gate runs again AND NEVER signing proceeds until Sign the edit is pressed again

WHEN the cover the edit set fails to upload -> the cover's thumbnail is marked AND the line One picture didn't upload. stands under the cover row with Retry and Remove it AND the gate line takes its fault reading

WHEN press Retry under the cover row -> the cover's upload tries again AND the gate runs again

WHEN press Remove it under the cover row -> the new cover leaves the batch AND the cover field reads as it stood before the edit, the chosen cover or Add a cover AND the gate line goes AND Sign the edit is enabled

WHEN the last upload lands GIVEN Sign the edit was not pressed -> the upload line goes AND Sign the edit stays as it was

WHEN press the header back arrow -> the edit is left toward where it began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the edit is left AND the draft is kept AND NEVER a dialog asks
