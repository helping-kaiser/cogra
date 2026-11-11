# AppCrash · `spec:design:behavior-app-crash`

ALWAYS crash.title reads This shouldn't have happened, the bug notice's own words, and is the page's one line

ALWAYS crash.reload, Reload, is the page's one action, an outlined button at the column's width under crash.title

ALWAYS the page stands on the app's plain page surface with no header, no bottom bar and nothing else GIVEN the app itself broke and no surface is left to carry a notice

ALWAYS the page never takes the error colour or the failure voice, the bug notice's register

WHEN tap crash.reload -> the app reloads AND NEVER the page asks a question first
