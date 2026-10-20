# VouchBack · `spec:design:behavior-vouch-back`

ALWAYS feed.vouchCard stands GIVEN the account has landed, the pair with the member who vouched it in is incomplete, and the card was never put away

ALWAYS feed.vouchCard names the member whose approval landed the account

ALWAYS feed.vouchCard reads Vouch back to open the way from your side — your opinion toward @mira, and your feed grows from it. Vouching opens the opinion control, set to a gentle default.

ALWAYS feed.vouchCard reads Vouch back to open the way from your side — your opinion toward a deleted account, and your feed grows from it. Vouching opens the opinion control, set to a gentle default. GIVEN the member who vouched the account in deleted their account

ALWAYS feed.vouchCard's act is feed.vouchCard.stance.anchor, the stance control's own face, at the end of its row of controls, with Got it leading the row

ALWAYS feed.vouchCard.hint stands beside feed.vouchCard.stance.anchor and reads Tap the face to vouch back.

ALWAYS feed.vouchCard.hint reads Tap the face to vouch back. GIVEN the member who vouched the account in deleted their account

ALWAYS feed.vouchCard.stance.anchor.face is the empty face, the account holding no opinion of the member who vouched it in

ALWAYS feed.vouchCard.stance.anchor.face is the line face drawn in the card's own ink, never the 🫥 emoji and never the muted resting treatment, the empty face alone saying no opinion yet GIVEN the account holds no opinion of the member who vouched it in
ALWAYS feed.vouchCard and its band claim no order between the vouch-back and any other opinion

ALWAYS the band reads Browsing from @mira's view — your first opinion starts your own. GIVEN the member has signed no live opinion yet, one with neither number at zero

ALWAYS the band reads Browsing from a deleted account's view — your first opinion starts your own. GIVEN the member has signed no live opinion yet and the issuer's account was deleted

ALWAYS the band carries no Vouch back and asks for nothing

ALWAYS the band stands on the Feed root only, and never on Explore or the reader's own profile

WHEN the member's first live opinion is signed, toward any target -> the borrowed view ends AND the band leaves at once AND the feed reads the member's own view from its next refresh AND NEVER the feed reloads at the signing

WHEN the member's first live opinion, toward any target, expires instead of landing GIVEN no other live opinion of theirs has landed -> the borrowed view returns AND the ordinary did-not-land notice answers alongside it

WHEN the member signs an Affinity GIVEN no live opinion of theirs is signed -> NEVER the borrowed view ends

WHEN the member signs an opinion with a number at zero GIVEN no live opinion of theirs is signed -> NEVER the borrowed view ends

WHEN tap feed.vouchCard.stance.anchor GIVEN no vouch-back is kept -> the vouch-back pad blooms at the gentle default +0.10 / +0.10

WHEN tap feed.vouchCard.stance.anchor GIVEN a vouch-back is kept on this device -> the vouch-back pad blooms holding the kept pick

WHEN press and hold feed.vouchCard.stance.anchor -> the gentle default +0.10 / +0.10 signs as the vouch-back AND the ceremony opens, as it does from the pad AND NEVER the pad blooms

ALWAYS feed.vouchCard reads as it does with nothing kept GIVEN a vouch-back is kept on this device

WHEN tap Got it GIVEN the put-away goes through -> feed.vouchCard is put away for good AND NEVER a snackbar appears AND NEVER a reminder appears AND NEVER anything stands in its place

WHEN tap Got it GIVEN the put-away does not go through -> feed.vouchCard comes back into its place AND the line That didn't go through. with Retry stands in its row of controls

WHEN tap Retry on feed.vouchCard -> feed.vouchCard steps aside AND the put-away is asked again

WHEN tap Got it GIVEN a vouch-back is kept on this device -> the kept pick is dropped, as Cancel drops one, AND feed.vouchCard is put away

ALWAYS feed.vouchCard stays away on every device the account signs in on GIVEN it was put away and that device keeps no vouch-back

WHEN a vouch-back is kept from the profile of the member who vouched the account in GIVEN feed.vouchCard was put away -> feed.vouchCard returns on the device that kept it AND NEVER it returns on another device

ALWAYS the security notice stands first, then the key card, then feed.vouchCard GIVEN two or more of them stand at the feed's head

ALWAYS vouching back stays open from the profile of the member who vouched the account in GIVEN the pair is incomplete, the card put away or not

WHEN any opinion on the member who vouched the account in is signed GIVEN the pair is incomplete -> the ceremony opens, wherever the opinion was signed

WHEN the account lands, its registration and the approving vouch both confirmed, while the reader is on the landing card -> this card stands in its place where the reader stands AND NEVER the feed reloads

WHEN a signed vouch-back expires instead of landing GIVEN the card was never put away -> feed.vouchCard returns AND the ordinary did-not-land notice answers

WHEN a signed vouch-back expires instead of landing GIVEN the card was put away -> NEVER feed.vouchCard returns
