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

WHEN press the header back arrow -> the edit is left toward where it began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the edit is left AND the draft is kept AND NEVER a dialog asks
