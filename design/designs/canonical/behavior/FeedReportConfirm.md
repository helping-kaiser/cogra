# FeedReportConfirm · `spec:design:behavior-feed-report-confirm`

WHEN tap feed.menuSheet.report -> the menu closes AND feed.reportSheet rises in its place over the feed AND NEVER anything is sent yet

ALWAYS feed.reportSheet.title reads Report this post?

ALWAYS feed.reportSheet.body reads It goes to the people who run CoGra for a look.

ALWAYS the feed stands unchanged beneath the sheet

WHEN tap feed.reportSheet.report -> the sheet closes AND the report goes out AND feed.snackbar reads Reported. AND NEVER ReportProblem opens AND NEVER a mark lands on the reported thing

WHEN tap feed.reportSheet.report GIVEN no answer reaches the device -> the sheet stays AND feed.snackbar reads That didn't send. Try again.

WHEN tap feed.reportSheet.report GIVEN the report is refused, the day's reports spent or the thing gone -> the sheet stays AND feed.snackbar reads That didn't send. Try again. AND NEVER feed.snackbar reads Reported.

WHEN tap feed.reportSheet.cancel -> the sheet closes AND NEVER anything is sent

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND NEVER anything is sent

WHEN tap feed.menuSheet.report GIVEN the reader is signed out -> the menu closes AND the join prompt asks over the feed AND NEVER feed.reportSheet rises
