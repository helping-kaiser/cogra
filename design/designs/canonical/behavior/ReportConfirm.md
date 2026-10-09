# ReportConfirm · `spec:design:behavior-report-confirm`

WHEN tap postDetail.menuSheet.report -> the menu closes AND postDetail.reportSheet rises in its place AND NEVER anything is sent yet

ALWAYS postDetail.reportSheet.title names the thing: Report this post? over a post, Report this comment? over a comment, Report @ada? on a person and Report this account? on a deleted account

ALWAYS postDetail.reportSheet.body reads It goes to the people who run CoGra for a look.

ALWAYS the surface the menu's Report row was opened from stands unchanged beneath the sheet, the thread's own sheet included

WHEN tap postDetail.reportSheet.report -> the sheet closes AND the report goes out AND the snackbar reads Reported. AND NEVER ReportProblem opens AND NEVER a mark lands on the reported thing

WHEN tap postDetail.reportSheet.report GIVEN no answer reaches the device -> the sheet stays AND the snackbar reads That didn't send. Try again.

WHEN tap postDetail.reportSheet.cancel -> the sheet closes AND NEVER anything is sent

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND NEVER anything is sent

WHEN tap postDetail.menuSheet.report GIVEN the reader is signed out -> the menu closes AND the join prompt asks over the read AND NEVER postDetail.reportSheet rises
