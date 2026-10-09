# HistoryNone · `spec:design:behavior-history-none`

ALWAYS the list reads Nothing you've seen carries that name. Search reads names and titles, never bodies — fewer words reach further. GIVEN the query matches nothing in History

ALWAYS the list reads Nothing you've seen is of that kind. GIVEN the narrowed kinds hold nothing in History and no query is typed

ALWAYS history.searchField keeps the reader's query and history.filterTrigger keeps its reading

ALWAYS Show everything stands under the line as the empty state's one action

ALWAYS the empty state wears no error colour

WHEN tap Show everything -> the query clears AND no kind is narrowed AND History stands whole, reading Everything, ordered by the time the reader first saw each thing, newest first

WHEN the reader types a query something in History carries -> the matches replace the empty state, ordered by the time the reader first saw each thing, newest first

WHEN tap history.filterTrigger -> the history's filter sheet opens over History

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile

ALWAYS history.bottomBar keeps lit the slot of the root History was opened from, history.bottomBar.profileSlot
