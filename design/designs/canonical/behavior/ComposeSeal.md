# ComposeSeal · `spec:design:behavior-compose-seal`

WHEN Sign and publish is pressed -> Sign and publish refuses a second press until the signing answers AND NEVER Sign and publish dims

WHEN the signing has not answered 200ms after the press -> Sign and publish reads Signing and publishing… AND NEVER a spinner appears

WHEN the signing answers within 200ms of the press -> NEVER Sign and publish reads Signing and publishing…

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the place of Sign and publish AND everything above the foot stays as it was

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it AND Sign and publish stays AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the place of Sign and publish AND Try again, Report a problem and Discard the post stand with it AND everything above the foot stays as it was AND NEVER a line in the failure voice appears
