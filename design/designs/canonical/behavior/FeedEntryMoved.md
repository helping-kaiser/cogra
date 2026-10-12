# FeedEntryMoved · `spec:design:behavior-feed-entry-moved`

ALWAYS the trace reads the quiet line The paths that carried it here have moved on. under the cover GIVEN the trace's fetch finds no paths

ALWAYS the trace's score reads a dash, never 0.00, GIVEN no figure is computed for it — the trace's fetch finds no paths, or the thing is still settling

ALWAYS the trace reads the quiet line Still settling — its paths count once it lands. under the cover GIVEN the thing is still settling

ALWAYS the trace makes no fetch GIVEN the thing is still settling

ALWAYS the trace offers no action and draws no empty state GIVEN it has no paths to list
