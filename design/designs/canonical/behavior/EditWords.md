# EditWords · `spec:design:behavior-edit-words`

WHEN the edit opens GIVEN the post's body is words -> the words edit stands with the body in its field

WHEN the last picture or the clip leaves a media post's edit -> the words edit stands AND the words field arrives empty

ALWAYS the words edit carries a title field and no description field

ALWAYS the line A post's body is words or media, never both. stands under + Add pictures or a video

ALWAYS every change the edit makes signs together in one batch

ALWAYS the License row shows the license as signed, with the lock and no action

ALWAYS no count stands under the body GIVEN more than 500 of its 5,000 characters remain

WHEN typing passes the body's 5,000 characters -> the body takes the error outline AND the line A post's words are at most 5,000 characters. stands under it AND Sign the edit goes inert

WHEN press + Add pictures or a video -> the device's own picker opens AND NEVER a pick stage opens

WHEN pictures are picked from + Add pictures or a video -> they pass the crop AND the words they replace are gone from the body

WHEN a video is picked from + Add pictures or a video -> its face is chosen on the cover step before the edit takes it

WHEN tap the × of a tag the post already carries -> the withdrawal of that tag is staged in the batch AND the footer counts one more AND NEVER a dialog asks

WHEN tap the × of a tag picked in this same edit -> the pick is unstaged AND the chip leaves the row AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN press Sign the edit GIVEN the signing is taken -> the post opens with the edit settling AND its body is words

WHEN the signing has not answered 5s after the press -> the line Still signing — the network is slow right now. stands under the acts footer AND NEVER a progress indicator appears

WHEN the signing answers GIVEN the slow line stands under the acts footer -> the slow line goes

WHEN press the header back arrow -> the edit is left toward where it began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the edit is left AND the draft is kept AND NEVER a dialog asks

WHEN the words stage opens -> the body takes focus with its caret at the end AND the keyboard rises
