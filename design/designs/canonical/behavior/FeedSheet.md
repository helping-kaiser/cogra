# FeedSheet · `spec:design:behavior-feed-sheet`

WHEN the filter sheet opens -> it stands at 88% of the screen's height

ALWAYS the filter's kinds are the kinds V1.0 serves: Posts, Comments, Profiles and Tags

ALWAYS the kind chips combine

ALWAYS the form chips combine

ALWAYS the order is Ranked or Newest, never both

ALWAYS the filter's topic chips are the topics the reader holds an opinion for

ALWAYS at most one topic chip is on

WHEN tap a topic chip GIVEN it is off -> it turns on AND every other topic chip turns off

WHEN tap a topic chip GIVEN it is on -> it turns off AND NEVER another topic chip turns on

WHEN tap a kind, form, topic or also-show chip -> the chip's change is staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Ranked or Newest -> that order is staged AND NEVER the feed behind the sheet moves before Done

WHEN tap Show what you've already seen -> the toggle flips, staged AND NEVER the feed behind the sheet moves before Done

ALWAYS Posts is the one kind on, Ranked is the order, Show what you've already seen is off, Still settling is on and Sensitive and Removed are off GIVEN the filter is at its default and the reader has set no default of their own in Settings

ALWAYS the feed admits content not yet landed, wearing Still settling GIVEN the feed's filter has Still settling on

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

ALWAYS the filter's "?" says Reset brings back your defaults, to change them go to settings.

WHEN the last kind chip is switched off -> NEVER the chip refuses the tap

WHEN pull down inside the filter sheet -> NEVER the feed refreshes

ALWAYS the trigger's spoken name is its reading followed by what your feed shows

WHEN tap Done GIVEN the staged filter differs from the feed's -> the sheet closes AND the feed re-queries once AND one polite status message says the trigger's new name AND focus returns to the trigger AND NEVER the message draws anything

WHEN tap Done GIVEN the staged filter is the feed's own, nothing changed -> the sheet closes AND the feed is what it was AND focus returns to the trigger AND NEVER the feed re-queries

WHEN tap the scrim -> the sheet closes AND the staged filter is dropped AND the feed is what it was AND NEVER the feed re-queries

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the staged filter is dropped AND the feed is what it was AND NEVER the feed re-queries
