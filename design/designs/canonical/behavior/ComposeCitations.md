# ComposeCitations · `spec:design:behavior-compose-citations`

ALWAYS the seal beneath the sheet stays inert while the sheet is up

ALWAYS the sheet lists every staged citation

ALWAYS the sheet offers no way to cite something more

ALWAYS each citation's remove control names that citation

WHEN tap a citation's remove control GIVEN two or more citations stay staged -> the citation leaves the post AND the References row behind the sheet counts one fewer AND NEVER a dialog asks

WHEN tap a citation's remove control GIVEN one citation stays staged -> the citation leaves the post AND the References row behind the sheet switches live to reading the one citation back by name AND the sheet stays open AND NEVER a dialog asks

WHEN tap the last citation's remove control -> the citation leaves the post AND the sheet closes to the seal it opened from AND NEVER a dialog asks

WHEN tap a citation's name -> the citation's pair opens in a sheet

WHEN press Done -> the sheet closes to the seal it opened from

WHEN tap the scrim -> the sheet closes to the seal it opened from
