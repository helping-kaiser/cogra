# SealSigningSlow · `spec:design:behavior-seal-signing-slow`

WHEN the signing has not answered 5s after the press of the commit -> the acts card's subline under the total reads Still signing — the network is slow right now. in the olive tertiary ink AND the line is announced once, politely, as a status

ALWAYS the 5s count starts at the press of the commit, a wait for uploads included, never at the label swap and never at the last upload's landing

WHEN the signing answers within 5s of the press -> NEVER the slow line appears

ALWAYS the slow line stands until the signing answers, with no timeout of the design's own, and the seal never retries by itself

ALWAYS the slow line takes the subline's place GIVEN the seal signs one act and carries no all-or-nothing line

ALWAYS no progress bar, no percentage, no named steps and no spinner appear GIVEN the slow line stands

ALWAYS the slow line never takes the failure voice or the error colour

ALWAYS the commit keeps its in-flight label and refuses a press GIVEN the slow line stands

ALWAYS the header back arrow, Back and the header X refuse a press and keep their resting face GIVEN the slow line stands

ALWAYS the fact rows stay readable GIVEN the slow line stands

WHEN the signing is taken GIVEN the slow line stands -> the seal is left as any signed seal is left AND NEVER the slow line stands anywhere after it

WHEN the signing does not go through GIVEN the slow line stands -> the fault takes the commit's place as it does on any seal
