# ReferencePicker · `spec:design:behavior-reference-picker`

ALWAYS referencePicker.staged.stagedReference stands only in the staged section above the results

WHEN tap a result row -> the row's target is staged in the composer's references AND the row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN tap the remove control of a staged row -> the row's target is unstaged from the composer's references AND the row leaves the staged section AND the status message announces the unstage AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND NEVER referencePicker.staged.stagedReference is unstaged

WHEN press the header back -> the picker closes to the composer it was opened from AND NEVER referencePicker.staged.stagedReference is unstaged

WHEN tap a result row GIVEN the row's target is withdrawn in the edit the picker was opened from -> the target's withdrawal is unstaged AND NEVER a second record is staged for the target

ALWAYS the back arrow reads Back to the post from a post's composer or its edit, and Back to the comment from a reply's composer or a comment's edit

WHEN the picker opens -> referencePicker.searchField takes focus AND the keyboard rises

WHEN tap referencePicker.filterTrigger -> referencePicker.filterSheet rises over the picker AND it holds referencePicker.filterSheet.kinds and referencePicker.filterSheet.foot alone

ALWAYS referencePicker.filterSheet.kinds holds the kinds a citation can point at: Posts, Comments and Profiles

ALWAYS referencePicker.filterSheet carries no order section and no Show what you've already seen

ALWAYS no kind chip is on and the results read every citable kind GIVEN the picker's filter is at its default

WHEN tap a kind chip -> the chip's change is staged AND NEVER the results behind the sheet move before Done

WHEN tap referencePicker.filterSheet.foot.reset -> the sheet stages the picker filter's default AND NEVER the results re-query

WHEN tap referencePicker.filterSheet.foot.done -> the sheet closes AND the results re-query once with the staged kinds AND referencePicker.filterTrigger reads them

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND the staged filter is dropped AND NEVER anything staged applies

ALWAYS referencePicker.cap reads Up to 10 citations per post. above the results GIVEN the composer holds ten citations and was opened from a post's composer or its edit

ALWAYS referencePicker.cap reads Up to 10 citations per comment. above the results GIVEN the composer holds ten citations and was opened from a reply's composer or a comment's edit

ALWAYS every referencePicker.result is dimmed and takes no tap GIVEN the composer holds ten citations

WHEN tap the remove control of a staged row GIVEN the composer holds ten citations -> the row's target is unstaged AND referencePicker.cap leaves AND the results take taps again

WHEN the results' read gets no answer GIVEN no result has loaded for the query -> referencePicker.fault reads Can't reach the server — results can't load right now. over referencePicker.fault.retry, outlined, where the results were AND referencePicker.searchField keeps the query AND NEVER the line says try again

WHEN tap referencePicker.fault.retry -> the results are read again for the query in referencePicker.searchField

WHEN the query changes GIVEN referencePicker.fault stands -> the results read again

ALWAYS no line stands where the results are GIVEN the results' read is in flight or found nothing
