# EditWords · `spec:design:behavior-edit-words`

WHEN the edit opens GIVEN the post's body is words -> the words edit stands with the body in its field

WHEN the last picture or the clip leaves a media post's edit -> the words edit stands AND the words field arrives empty

WHEN the last picture leaves a media post's edit GIVEN the post carries a description -> the media-to-words flip drops the standing description with the last picture AND NEVER the signed edit carries a description

ALWAYS the words edit carries a title field and no description field

ALWAYS the line A post's body is words or media, never both. stands under + Add pictures or a video

ALWAYS every change the edit makes signs together in one batch

ALWAYS the License row shows the license as signed, with the lock and no action

ALWAYS the Your opinion row stands under the License row and reads where the post's own records stand with the edit, its face and one number

ALWAYS the Your opinion row reads where the post's own records stand GIVEN the edit's pick was never moved

ALWAYS the edit's record carries the pick less the raw sum of the post's own records, 0.00 GIVEN the author never moved it

ALWAYS an edit whose pick was never moved changes where the post's own records stand by exactly nothing

WHEN tap Adjust on the Your opinion row -> the one-axis pad opens over the edit at the row's value AND NEVER anything is staged

ALWAYS the pick rides the edit's own record and adds nothing to the footer's count

ALWAYS no count stands under the body GIVEN more than 500 of its 5,000 characters remain

WHEN typing passes the body's 5,000 characters -> the body takes the error outline AND the line A post's words are at most 5,000 characters. stands under it AND Sign the edit goes inert

WHEN press + Add pictures or a video -> the device's own picker opens AND NEVER a pick stage opens

WHEN pictures are picked from + Add pictures or a video -> they pass the crop AND the words they replace are gone from the body

WHEN pictures picked from + Add pictures or a video break the cap of ten or come in a format nothing here reads -> the refusal says why on the media row AND NEVER a dialog opens AND NEVER a pick stage opens

WHEN a video is picked from + Add pictures or a video -> its face is chosen on the cover step before the edit takes it

WHEN tap the × of a tag the post already carries -> the withdrawal of that tag is staged in the batch AND the chip leaves the row for the line Withdrawn: under the tags AND the footer counts one more AND NEVER a dialog asks

WHEN tap the × of a tag picked in this same edit -> the pick is unstaged AND the chip leaves the row AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap Undo on a Withdrawn: line -> the withdrawal is unstaged AND the chip returns to the row as it stood AND the line goes AND the footer counts one fewer

WHEN press Sign the edit GIVEN the signing is taken -> the post opens with the edit settling AND its body is words

WHEN the signing has not answered 5s after the press -> the line Still signing — the network is slow right now. stands under the acts footer AND NEVER a progress indicator appears

WHEN the signing answers GIVEN the slow line stands under the acts footer -> the slow line goes

WHEN press the header back arrow or the header X GIVEN the batch holds an act -> the dialog Discard the changes? opens over the edit with Nothing is kept. AND NEVER the changes are discarded unasked

WHEN press the header back arrow GIVEN the batch is empty -> the edit is left toward where it began AND NEVER a dialog asks

WHEN press the header X GIVEN the batch is empty -> the edit is left AND nothing is kept or discarded AND NEVER a dialog asks

WHEN tap Discard in the dialog Discard the changes? -> the changes are discarded AND the edit is left toward where it began with the post as it was AND NEVER a draft is kept

WHEN the words stage opens -> the body takes focus with its caret at the end AND the keyboard rises

WHEN the signing has not answered 200ms after a press of Sign the edit, held at the upload gate or not -> Sign the edit reads Signing the edit… in its own place AND the header back arrow and the header X refuse a press AND NEVER a spinner appears
