# ComposeSealCited · `spec:design:behavior-compose-seal-cited`

WHEN press Next on the details stage GIVEN two or more citations are staged -> the seal opens in this state

ALWAYS the References row reads N cited, one line, and never stacks the citations' names

ALWAYS the References row's trailing count is the number of citations staged, bare

ALWAYS the References row's spoken name reads Manage the N citations

WHEN tap the References row -> the citations sheet opens over the seal AND the seal stays on screen beneath it

WHEN press the header back arrow -> the details stage comes back, one stage behind AND the citations stay staged

WHEN press Back -> the details stage comes back, one stage behind AND the citations stay staged

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks
