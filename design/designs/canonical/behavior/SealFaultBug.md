# SealFaultBug · `spec:design:behavior-seal-fault-bug`

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the commit's place over That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it. AND Try again stands in the notice AND Report a problem and Discard the post stand under it

ALWAYS the notice wears the tertiary container, never the error colour and never the failure voice

ALWAYS Try again is the notice's filled button and Report a problem and Discard the post are text buttons under the notice

ALWAYS nothing is staged, signed or spent GIVEN the notice stands

ALWAYS every row of the acts card and every fact row reads back exactly as before GIVEN the notice stands

ALWAYS no row is marked GIVEN the notice stands

ALWAYS the header's ? is the only ? on the seal GIVEN the notice stands

WHEN press Try again GIVEN the signing goes through this time -> the post's own detail view opens wearing Still settling

WHEN press Try again GIVEN the same refusal answers -> the notice stays as it was

WHEN press Try again GIVEN no answer reaches the seal -> the fault line and Retry take the commit's place

WHEN press Try again GIVEN the write rule refuses -> the notice You can't sign right now takes the commit's place AND nothing is staged or spent AND the draft is kept

WHEN press Try again GIVEN the cited post turns out never to have landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it

WHEN press Report a problem -> the report page opens, the same page Settings opens AND NEVER anything about the seal is attached to the report

WHEN press Report a problem GIVEN words were kept there from a visit left with Back -> the report page opens with those words in it

WHEN press Discard the post -> the dialog Discard this post? opens over the seal AND NEVER the draft is discarded unasked

WHEN press Discard the reply GIVEN the notice stands on a reply's seal -> the dialog Discard this reply? opens over the seal with Nothing is kept. AND NEVER the reply is discarded unasked

WHEN press Discard the edit GIVEN the notice stands on a comment edit -> the dialog Discard the changes? opens over the edit with Nothing is kept. AND NEVER the changes are discarded unasked

ALWAYS the notice's discard names what is lost: Discard the post on the post's seal, Discard the reply on a reply's seal, Discard the edit on a comment edit and on a post edit

WHEN press Discard the edit GIVEN the notice stands on a post edit's seal -> the dialog Discard the changes? opens over the seal AND NEVER the changes are discarded unasked

ALWAYS the notice's third way out reads Not now GIVEN the seal keeps no draft to lose: the kept picks' seal, the profile's seal and the picture's seal

WHEN press Not now GIVEN the notice stands on the kept picks' seal -> the review returns with every pick still kept AND NEVER anything is signed AND NEVER a dialog asks

WHEN press Not now GIVEN the notice stands on the profile's seal -> the profile edit returns as it was left AND NEVER anything is signed

WHEN press Not now GIVEN the notice stands on the picture's seal -> the crop returns with the picture as it was AND NEVER anything is signed

ALWAYS the notice's discard asks first, at the post's scale and the comment's alike

WHEN tap a fact row's Change, Adjust or Mark GIVEN the notice stands -> that fact's sheet or pad opens as it does on the seal

WHEN tap the header's ? -> the signing text opens AND NEVER a dialog about the bug opens

WHEN press the header back arrow -> the details stage comes back, one stage behind

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks
