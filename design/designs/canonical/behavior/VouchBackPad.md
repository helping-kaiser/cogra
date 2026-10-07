# VouchBackPad · `spec:design:behavior-vouch-back-pad`

ALWAYS the pad parks open, resting 16px above feed.bottomBar

ALWAYS the shell beneath the wash stays inert while the pad is up, the band, the bar and feed.vouchCard's own controls included

ALWAYS the pad opens at the gentle default +0.10 / +0.10 GIVEN no opinion stands toward its target

ALWAYS the pad is titled Your vouch back and its ? is named Your vouch back GIVEN the pad opened as the vouch-back

ALWAYS the pad carries no Walk it back GIVEN the pad opened as the vouch-back

ALWAYS the line Your vouch back. The pad is how you shape what reaches you — for or against, and how much. stands above the field GIVEN the pad opened as the vouch-back

ALWAYS the two coaching lines, the press-and-hold shortcut and Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings., stand under it only on the account's first-ever pad open, wherever that pad opens

WHEN the pad closes GIVEN it carried the two coaching lines -> NEVER the two coaching lines show on a later open

ALWAYS the coaching's exact pair shows only when the reader has asked for exact values, and its spoken twin says the face and the pair either way

WHEN tap the pad's ? GIVEN the pad opened as the vouch-back -> the help Your vouch back replaces the pad's body in place AND Set is disabled while it shows AND NEVER a dialog opens

WHEN tap the pad's ? GIVEN the pad opened plainly -> the pad's four help lines replace its body in place AND Set is disabled while they show AND NEVER a dialog opens

WHEN drag on the pad field -> the pick is set AND NEVER anything is signed

WHEN tap the pad field without dragging -> NEVER the pick moves

WHEN release a drag on the field -> NEVER the pick is signed

WHEN tap Set GIVEN the signing has not answered 200ms after the press -> Set reads Setting… AND the pad stays open AND NEVER a spinner appears

WHEN tap Set GIVEN the pad opened as the vouch-back and the signing is taken -> the ceremony opens

WHEN tap Set GIVEN the pad bloomed from a stance face anywhere else and the signing is taken -> the opinion lands AND the pad closes back where it bloomed

WHEN tap Set GIVEN the signing does not go through -> the pad stays open at the pick, the fault above the commit row and Retry in Set's place, as PadFailed draws it

WHEN tap Set GIVEN the write rule refuses -> nothing is staged or spent AND the notice stands where the landing line and Set were, with Not now, as PadWriteRule draws it

WHEN tap Set GIVEN the key is on another device -> the pick waits as PadKeyAbsent draws it

WHEN the key comes back GIVEN a vouch-back was kept -> the kept vouch-back surfaces as its own card and signs through this pad, its ceremony kept AND NEVER it joins the kept picks' review

WHEN tap Cancel GIVEN the pad opened as the vouch-back -> the pad closes onto feed.vouchCard AND nothing is staged

WHEN tap the scrim -> the pad closes onto what it bloomed over AND nothing is staged
