# RefsSheet · `spec:design:behavior-refs-sheet`

ALWAYS every signed tag and reference on the node stands as one row, its mark, its name and its signed pair

ALWAYS the References section's rows are as many as the card's reference count, whatever kind each row points at

ALWAYS a tag's pair reads its confidence unsigned and a reference's pair reads both values signed

ALWAYS Still settling stands at the edge of a row's pair GIVEN that act has not landed

WHEN tap a tag row -> the tag's page opens

WHEN tap a person's reference row -> their profile opens

WHEN tap a post's reference row -> the cited post opens

WHEN tap a comment's reference row -> the comment opens in its thread

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
