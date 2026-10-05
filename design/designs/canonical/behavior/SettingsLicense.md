# SettingsLicense · `spec:design:behavior-settings-license`

WHEN tap Default license -> the license sheet opens over settings, titled Default license AND settings stays beneath the scrim, inert AND focus moves to its title

ALWAYS the sheet's axes and readings are the seal's own license sheet's

ALWAYS the sheet's "?" stands on the title's row and is named License

ALWAYS one Credit reading of three stands chosen

ALWAYS one Public record of use reading of three stands chosen

WHEN the sheet opens -> the chosen readings are the account's current default

WHEN tap a Credit reading -> that reading is staged AND the Credit reading chosen before is not AND NEVER the default changes before Done

WHEN tap a Public record of use reading -> that reading is staged AND the Public record of use reading chosen before is not AND NEVER the default changes before Done

ALWAYS the foot reads the license summary the seal's license row reads

WHEN press Done -> the sheet closes AND the staged pair is saved as the account's default license AND the Default license row reads it AND focus returns to the row

WHEN the default's save does not go through -> the default reverts to what it was AND the Default license row says so with Retry, in the hold's row vehicle

ALWAYS a new post starts from the account's default license

ALWAYS changing the default license never reaches a post already signed

WHEN tap the scrim -> the sheet closes AND the default is what it was AND NEVER anything staged applies

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the default is what it was AND NEVER anything staged applies
