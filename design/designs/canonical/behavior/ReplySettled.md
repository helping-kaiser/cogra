# ReplySettled · `spec:design:behavior-reply-settled`

WHEN a signed reply returns the reader -> the comments sheet reopens AND the new reply stands on its parent comment wearing Still settling

WHEN a signed reply returns the reader GIVEN its parent's replies stood collapsed behind a count -> the parent's branch expands

WHEN a signed comment edit returns the reader -> the comments sheet reopens AND the edited comment shows its new words wearing Still settling

ALWAYS the return is a property of the comments sheet, the same whether it was raised from the feed or from the post's detail

ALWAYS the reader's just-signed reply wears Edit beside Reply
