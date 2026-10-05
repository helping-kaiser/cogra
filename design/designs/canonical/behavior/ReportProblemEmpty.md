# ReportProblemEmpty · `spec:design:behavior-report-problem-empty`

WHEN the report opens GIVEN no words were kept from an earlier visit -> What happened stands empty AND Send by email stands visible and disabled AND Nothing to send yet stands right above it

ALWAYS Send by email is disabled and never hidden GIVEN What happened is empty

ALWAYS the four facts that travel and the line under them stand read back GIVEN What happened is empty

WHEN press Send by email GIVEN What happened is empty -> NEVER the mail opens AND NEVER anything changes

WHEN the first character is typed in What happened -> Send by email wakes AND Nothing to send yet goes

WHEN press the header back arrow GIVEN What happened is empty -> the surface that opened the report returns AND nothing is sent AND NEVER words are kept

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
