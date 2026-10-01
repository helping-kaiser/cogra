# ReplyVideoFailed · `spec:design:behavior-reply-video-failed`

ALWAYS a clip whose upload failed wears the failed badge, dimmed, with the fault line, Retry and Remove it beside it

ALWAYS the failed clip's tile carries no remove control of its own

ALWAYS the footer's uploading line is gone GIVEN the clip's upload failed

WHEN tap Retry -> the upload starts again

WHEN tap Remove it -> the clip leaves AND the composer is words again

WHEN tap Describe the video GIVEN the clip's upload failed -> the describe sheet opens AND NEVER describing waits on the upload

WHEN tap Add a cover GIVEN the clip's upload failed -> the cover row opens where the door stood, offering the clip's frames or a picture of the reader's own
