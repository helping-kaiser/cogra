# FeedSheet · `spec:design:behavior-feed-sheet`

WHEN the filter sheet opens -> it stands at 88% of the screen's height

ALWAYS the filter's kinds are the kinds V1.0 serves: Posts, Comments, Profiles and Tags

ALWAYS the kind chips combine

ALWAYS the form chips combine

ALWAYS the order is Ranked or Newest, never both

ALWAYS the People section holds the rows Everyone and Your people, one on and never both

ALWAYS Your people narrows the feed to the people the reader holds an opinion of, whichever way it points, over the same rank

WHEN tap Everyone or Your people -> the choice is staged AND NEVER the feed behind the sheet moves before Done

ALWAYS the sign row stands under Your people as one line of three words, For · Against · Either, the chosen word in primary ink and never a pill GIVEN Your people is on

ALWAYS no sign row stands GIVEN Everyone is on

ALWAYS For narrows Your people to the people the reader is for, Against to the people the reader is against, and Either to both

WHEN tap For, Against or Either -> that word is chosen, staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Everyone GIVEN Your people is on -> the sign row goes AND its chosen word is kept for Your people's return

ALWAYS the filter's topic chips are the topics the reader holds an opinion for

ALWAYS at most one topic chip is on

WHEN tap a topic chip GIVEN it is off -> it turns on AND every other topic chip turns off

WHEN tap a topic chip GIVEN it is on -> it turns off AND NEVER another topic chip turns on

WHEN tap a kind, form, topic or also-show chip -> the chip's change is staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Ranked or Newest -> that order is staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Show what you've already seen -> the toggle flips, staged AND NEVER the feed behind the sheet moves before Done

ALWAYS Posts is the one kind on, Ranked is the order, Everyone is the people row on, Either is the sign row's chosen word, Show what you've already seen is off, Still settling is on and Sensitive and Removed are off GIVEN the filter is at its default and the reader has set no default of their own in Settings

ALWAYS the feed admits content not yet landed, wearing Still settling GIVEN the feed's filter has Still settling on

ALWAYS content not yet landed is woven in among the landed rows, ranked by the reader's reach to its author through the one edge it was born with GIVEN the feed's filter has Still settling on and the order is Ranked

ALWAYS a row not yet landed wears Still settling and carries no score, its score slot bare

ALWAYS the feed admits only what has landed GIVEN the feed's filter has Still settling off

ALWAYS the topic section is the last section of the sheet's body

ALWAYS the sheet's foot holds Reset in its corner and Done at its end, and no section holds Reset

ALWAYS the sheet's foot carries no reading of the staged filter

ALWAYS the reader's default is the app's default GIVEN the reader has set no default of their own in Settings

ALWAYS the reader's default is the one they set GIVEN the reader has set a default of their own in Settings

WHEN tap Reset -> the sheet stages the reader's default AND NEVER the feed re-queries

ALWAYS the trigger speaks only the deviations from the reader's default

ALWAYS the trigger speaks a deviation back toward the app's default like any other GIVEN the reader's own default differs from the app's

ALWAYS the trigger speaks each departing axis's state, never the direction it departs in

ALWAYS the trigger reads your people among its deviations, as your people, for or your people, against GIVEN Your people is on and For or Against is chosen

ALWAYS the filter's "?" says Reset brings back your defaults, to change them go to settings.

WHEN the last kind chip is switched off -> NEVER the chip refuses the tap

WHEN pull down inside the filter sheet -> NEVER the feed refreshes

ALWAYS the trigger's spoken name is its reading followed by what your feed shows

WHEN tap Done GIVEN the staged filter changes Kinds or the topic -> the sheet closes AND the feed re-queries once AND one polite status message says the trigger's new name AND focus returns to the trigger AND NEVER the message draws anything

WHEN tap Done GIVEN every staged change is the device's own — the people row and its sign, the order, Show what you've already seen, the kinds of post, Sensitive, Removed or Still settling -> the sheet closes AND the feed re-derives on the device from what it already holds AND one polite status message says the trigger's new name AND focus returns to the trigger AND NEVER the feed re-queries AND NEVER the message draws anything

WHEN tap Done GIVEN the staged filter is the feed's own, nothing changed -> the sheet closes AND the feed is what it was AND focus returns to the trigger AND NEVER the feed re-queries

WHEN tap the scrim -> the sheet closes AND the staged filter is dropped AND the feed is what it was AND NEVER the feed re-queries

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the staged filter is dropped AND the feed is what it was AND NEVER the feed re-queries
