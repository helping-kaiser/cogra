# ReplySealComment · `spec:design:behavior-reply-seal-comment`

ALWAYS the reply's seal reads back Reply to @tobias and the act Reply to @tobias's comment GIVEN the reply answers @tobias's comment

ALWAYS the reply's seal aimed at a comment differs from the one aimed at a post only in the two lines that name the target

WHEN tap Adjust on the reply's seal aimed at a comment -> the same reply pad opens AND its Set returns to this seal

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND Sign comment stays AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the place of Sign comment AND Try again, Report a problem and Discard the reply stand with it AND everything above the foot stays as it was
