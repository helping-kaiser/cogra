# CommentEdit · `spec:design:behavior-comment-edit`

ALWAYS the comment edit is one screen and one batch: words, pictures, tags, citations and the license

ALWAYS the comment edit's license row is locked

ALWAYS the comment edit holds at most four pictures, uncropped

ALWAYS the acts footer counts the signed actions the edit creates

WHEN tap the acts footer -> the acts sheet opens over the edit

WHEN tap a picture's remove control -> the picture leaves the batch

WHEN tap + Add pictures -> the platform's own picker opens AND NEVER a pick stage opens

WHEN tap a tag chip's remove control -> the tag leaves the edit

WHEN tap Sign the edit -> Sign the edit refuses a second press until the signing answers AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after the press -> Sign the edit reads Signing the edit… AND NEVER a spinner appears

WHEN the signing is taken -> the thread reopens AND the edit settles on its card wearing Still settling

WHEN the signing does not go through GIVEN no answer reached the edit -> the network error answers AND everything the reader chose stays as it was

WHEN the write rule refuses the edit -> nothing is staged or spent AND the draft is kept AND NEVER Retry appears

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the commit's place AND Try again, Report a problem and Discard the edit stand with it

WHEN tap Discard the edit under the notice This shouldn't have happened -> the discard dialog Discard the changes? opens over the edit with Nothing is kept. AND NEVER the changes are discarded unasked
