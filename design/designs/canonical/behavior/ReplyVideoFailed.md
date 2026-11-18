# ReplyVideoFailed · `spec:design:behavior-reply-video-failed`

ALWAYS a clip whose upload failed wears the failed badge, dimmed, with the fault line, Retry and Remove it beside it

ALWAYS the failed clip's tile carries no remove control of its own

ALWAYS the failed clip's tile and the cover's tile stand side by side at 167 × 167 each, the cover's tile the dashed Add a cover door GIVEN no cover was chosen

WHEN tap the dashed Add a cover tile GIVEN the clip is tall and its cover row has not been opened -> the cover row opens under the clip, offering the clip's frames or a picture of the reader's own AND NEVER the picker opens from this tap

ALWAYS no Add a cover text door stands under a Cover label, the dashed tile being the one way to a cover GIVEN the clip is tall and its cover row has not been opened

ALWAYS the footer's uploading line is gone GIVEN the clip's upload failed

ALWAYS Next is disabled GIVEN the clip's upload failed

WHEN tap Retry -> the upload starts again AND Next answers again

WHEN the server refuses the clip at its upload -> the line That video didn't upload. stands under the clip with Remove it alone AND NEVER Retry stands, retrying being unable to change the answer

WHEN tap Remove it -> the clip leaves AND the composer is words again AND Next answers again

WHEN press Next GIVEN the clip's upload failed -> NEVER the seal opens

WHEN tap Describe the video GIVEN the clip's upload failed -> the describe sheet opens AND NEVER describing waits on the upload

WHEN tap the dashed Add a cover tile GIVEN the clip's upload failed -> the cover row opens as on a clip that uploaded AND NEVER choosing a cover waits on the clip's upload

WHEN tap the dashed Add a cover tile GIVEN the cover row stands -> the platform's own picker opens AND the picture comes back through the cover's crop, locked to the comment's square, as ReplyVideo's cover tile
