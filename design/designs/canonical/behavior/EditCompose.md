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

WHEN tap the × of a citation the post already carries -> the withdrawal of that citation is staged in the batch AND the footer counts one more AND NEVER a dialog asks

WHEN tap the × of a tag picked in this same edit -> the pick is unstaged AND the chip leaves the row AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap the × of a citation picked in this same edit -> the pick is unstaged AND the footer counts one fewer AND NEVER a withdrawal is staged AND NEVER a dialog asks

WHEN tap a staged tag chip -> the tag's pair opens in a sheet over the edit

WHEN tap a staged citation's row -> the citation's pair opens in a sheet over the edit

WHEN press Sign the edit GIVEN the signing is taken -> the post opens with the edit settling

WHEN press Sign the edit GIVEN the signing key is not on this device -> the key-absent seal stands AND nothing is staged or signed

WHEN press Sign the edit GIVEN the signing is refused by the write rule -> the notice You can't sign right now takes the commit's place AND NEVER Retry appears

WHEN press the header back arrow -> the edit is left toward where it began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the edit is left AND the draft is kept AND NEVER a dialog asks
