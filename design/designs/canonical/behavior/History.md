# History · `spec:design:behavior-history`

ALWAYS History lists posts only, the posts the reader has seen, and no profile, comment or other kind

ALWAYS History stands ordered by the latest time the reader saw each post, newest first

WHEN the reader sees a post already in History -> the post moves to where the latest seeing puts it AND NEVER the post stands twice

ALWAYS a row names the post and its author's handle, with the post's description as its second line

ALWAYS a words post's row carries the post's words as its first line and no second line

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS the bottom bar rides with no slot lit

WHEN tap a row -> the post's detail opens AND its back arrow reads Back to History

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile
