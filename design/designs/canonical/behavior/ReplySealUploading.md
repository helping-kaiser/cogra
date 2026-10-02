# ReplySealUploading · `spec:design:behavior-reply-seal-uploading`

ALWAYS the line Uploading N of M — signing waits for the pictures. stands above Sign comment GIVEN the reply's pictures are uploading

ALWAYS the line Uploading N of M — signing waits for the video. stands above Sign comment GIVEN the reply's clip is uploading

ALWAYS Sign comment is enabled GIVEN an upload is running

WHEN press Sign comment GIVEN an upload is running -> Sign comment refuses a second press AND NEVER anything is signed before the last upload lands AND NEVER Sign comment dims

WHEN the signing has not answered 200ms after the press GIVEN Sign comment was pressed while the uploads ran -> Sign comment reads Signing comment… in its own place AND the header back arrow, Back and the header X refuse a press AND NEVER a spinner appears

WHEN the last upload lands GIVEN Sign comment was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN the last upload lands GIVEN Sign comment was not pressed -> the upload line goes AND Sign comment stays as it was
