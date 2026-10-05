# HistoryFilter · `spec:design:behavior-history-filter`

ALWAYS the history's filter sheet is titled What your history shows

ALWAYS the history's filter kinds are the feed filter's own list: Posts, Comments, Profiles and Tags

ALWAYS the history's filter kind chips combine

ALWAYS no kind chip is on and History shows every kind GIVEN the history's filter is at its default

ALWAYS the history's filter sheet carries no order section, no seen toggle, no forms, no also-show and no topic

ALWAYS the history's filter sheet carries no "?"

WHEN tap a kind chip -> the chip stages AND NEVER History moves behind the sheet

WHEN tap Done -> the sheet closes AND History re-reads once with the staged kinds, newest-seen first

WHEN tap Done GIVEN nothing seen is of the staged kinds -> the sheet closes AND History stands narrowed to nothing, with Show everything

WHEN tap the scrim -> the sheet closes AND the staged kinds are dropped AND History stands as it was

WHEN swipe down or press Back -> the sheet closes AND the staged kinds are dropped AND History stands as it was

ALWAYS the history's filter foot holds Reset in its corner and Done at its end

ALWAYS the history's filter foot carries no reading of the staged filter

WHEN tap Reset -> the sheet stages the history's default, no kind narrowed AND NEVER History re-reads

ALWAYS the filter trigger speaks the narrowed kinds by the filter pill's state words GIVEN a kind is narrowed
