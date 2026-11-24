# RefsSheet · `spec:design:behavior-refs-sheet`

ALWAYS every signed tag and reference on the node stands as one row, its mark, its name and its signed pair

ALWAYS the References section's rows are as many as the card's reference count, whatever kind each row points at

ALWAYS a tag's pair reads its confidence unsigned and a reference's pair reads both values signed

ALWAYS Still settling stands at the edge of a row's pair GIVEN that act has not landed

ALWAYS a reference row reads Removed by its author in the name's place, its mark's tile empty, and opens nothing GIVEN the post or comment it points at was removed, a deleted account's swept one included

ALWAYS a reference row keeps the post's or comment's title or words GIVEN it is a deleted account's and still there

ALWAYS a person's reference row reads Deleted account in the name's place, the reserved disc in the avatar's place, and never a handle GIVEN the account is deleted

WHEN tap a person's reference row GIVEN the account is deleted -> the deleted account's page opens

WHEN tap a tag row GIVEN the sheet was not opened from that tag's own page -> the tag's page opens

WHEN tap a tag row GIVEN the sheet was opened from that tag's own page -> NEVER anything changes

WHEN tap a person's reference row -> their profile opens

WHEN tap a post's reference row -> the cited post opens

WHEN tap a comment's reference row -> the comment opens in its thread

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
