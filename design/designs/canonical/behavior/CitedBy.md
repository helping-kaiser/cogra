# CitedBy · `spec:design:behavior-cited-by`

ALWAYS postDetail.citedBySheet opens over the post detail, the post still open beneath it

ALWAYS postDetail.citedBySheet lists what cites the post, newest first

ALWAYS postDetail.citedBySheet holds as many postDetail.citedBySheet.citation rows as postDetail.card.citedBy counts

ALWAYS postDetail.citedBySheet stands apart from the tags-and-references sheet, and neither count folds into the other

ALWAYS postDetail.citedBySheet.citation carries the citing artifact's kind mark, postDetail.citedBySheet.citation.mark, its name, postDetail.citedBySheet.citation.name, and the pair its author signed, postDetail.citedBySheet.citation.value, in the reader's reading mode

ALWAYS a citing row still settling says so

WHEN tap a citing comment's row -> the thread opens on the post the comment answers

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND the post stands open beneath it as it was
