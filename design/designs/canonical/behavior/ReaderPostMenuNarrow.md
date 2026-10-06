# ReaderPostMenuNarrow · `spec:design:behavior-reader-post-menu-narrow`

ALWAYS share leaves the card's action row and leads the reader's post menu as Share GIVEN the viewport is narrower than 360px on the web or 360dp on android

ALWAYS the card's action row reads opinion, score, comments and share, and the reader's post menu holds no Share GIVEN the viewport is 360px or 360dp wide or wider

ALWAYS the rows under Share keep the wide menu's order and words GIVEN Share leads the reader's post menu

WHEN tap Share in the reader's post menu -> the platform's own share sheet opens, exactly as the share glyph does on a wider phone

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
