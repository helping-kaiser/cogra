# ComposeSealTagged · `spec:design:behavior-compose-seal-tagged`

WHEN press Next on the details stage GIVEN more tags are staged than the seal's Tags row holds -> the seal opens in this state

ALWAYS the Tags row reads N tags, one line, and never draws a chip it would clip

ALWAYS the Tags row's trailing count is the number of tags staged, bare

ALWAYS the Tags row's spoken name reads Manage the N tags

WHEN tap the Tags row -> the tags sheet opens over the seal AND the seal stays on screen beneath it

WHEN press the header back arrow -> the details stage comes back, one stage behind AND the tags stay staged

WHEN press Back -> the details stage comes back, one stage behind AND the tags stay staged

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks
