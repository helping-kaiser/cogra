# ReportProblemEmpty · `spec:design:behavior-report-problem-empty`

WHEN the report opens GIVEN no words were kept from an earlier visit -> What happened stands empty AND Send by email stands enabled

ALWAYS Send by email is enabled GIVEN What happened is empty or holds only spaces

ALWAYS the four facts that travel and the line under them stand read back GIVEN What happened is empty

WHEN press Send by email GIVEN What happened is empty -> the reader's own mail opens with the four facts and the report address filled in AND NEVER the report is sent from CoGra

WHEN the first character is typed in What happened -> Send by email stays enabled

WHEN press the header back arrow GIVEN What happened is empty -> the surface that opened the report returns AND nothing is sent AND NEVER words are kept
