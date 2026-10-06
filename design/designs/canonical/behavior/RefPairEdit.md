# RefPairEdit · `spec:design:behavior-ref-pair-edit`

ALWAYS the pick opens at the origin

ALWAYS the line over the foot opens Signed with the post, as its own action. GIVEN the sheet was opened from the post edit

ALWAYS the line over the foot opens Signed with the comment, as its own action. GIVEN the sheet was opened from the comment edit

ALWAYS the sheet stands over the edit it was opened from, the post edit or the comment edit

ALWAYS the sheet opened from the comment edit differs from the sheet opened from the post edit only in the noun of the line over the foot

ALWAYS the sheet's title reads Post, Removed by its author GIVEN the cited post was removed

ALWAYS the non-drag route reads Set exact values for Post, Removed by its author GIVEN the cited post was removed

ALWAYS the sheet never says the removed post's name GIVEN the cited post was removed

ALWAYS the readouts, the pick, Remove citation and Done stand as they do for a live target GIVEN the cited post was removed

WHEN press Done GIVEN the pick moved off the origin -> the sheet closes AND the pick is staged as one record added to the citation

WHEN press Done GIVEN the pick never moved off the origin -> the sheet closes AND NEVER anything is staged

WHEN tap the scrim -> the sheet closes AND NEVER anything is staged

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND NEVER anything is staged
