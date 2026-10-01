# EditComposeUnchanged · `spec:design:behavior-edit-compose-unchanged`

ALWAYS the edit signs only when its acts batch holds an act, never by comparing the fields' bytes

ALWAYS Sign the edit stays visible and inert GIVEN the batch is empty

ALWAYS the footer reads Nothing to sign yet GIVEN the batch is empty

ALWAYS the footer is not a control GIVEN the batch is empty

WHEN press Sign the edit GIVEN the batch is empty -> NEVER the edit signs

WHEN typing in the title or the description stages the first act -> the footer starts counting AND Sign the edit answers

WHEN press the header X GIVEN the batch is empty -> the edit is left AND nothing is kept or discarded AND NEVER a dialog asks
