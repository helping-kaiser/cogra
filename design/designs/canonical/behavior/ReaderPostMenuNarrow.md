# ReaderPostMenuNarrow · `spec:design:behavior-reader-post-menu-narrow`

ALWAYS share leaves postDetail.card.actionRow and leads the reader's post menu as postDetail.menuSheet.share, reading Share this post, GIVEN the viewport is narrower than 360px on the web or 360dp on android

ALWAYS postDetail.card.actionRow reads opinion, score, comments and share, and the reader's post menu holds no Share this post GIVEN the viewport is 360px or 360dp wide or wider

ALWAYS the rows under Share this post keep the wide menu's order and words GIVEN Share this post leads the reader's post menu

WHEN tap Share this post in the reader's post menu -> the platform's own share sheet opens, exactly as the share glyph does on a wider phone

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
