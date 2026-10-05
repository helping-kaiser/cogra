# About · `spec:design:behavior-about`

ALWAYS About CoGra is a page of nine topics as rows, each row naming its topic

ALWAYS the whole of a topic's row is its control, its title and its chevron together

WHEN About CoGra opens -> every topic stands closed

ALWAYS a topic's row says whether it is open

WHEN tap a closed topic's row -> the topic unfolds its answer under the row AND every other topic stays as it was

WHEN tap an open topic's row -> the topic folds AND every other topic stays as it was

ALWAYS the header and its back arrow stay pinned while the page scrolls

ALWAYS About CoGra carries no "?" and no bottom bar

ALWAYS the back arrow reads Back to settings GIVEN About CoGra was opened from settings

ALWAYS the back arrow reads a plain Back GIVEN About CoGra was opened from the join form's "?"

WHEN press the header back arrow GIVEN About CoGra was opened from settings -> settings returns

WHEN press the header back arrow GIVEN About CoGra was opened from the join form's "?" -> the join form returns with every field as the reader left it, filled, half-filled or empty
