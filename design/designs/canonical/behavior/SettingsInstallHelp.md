# SettingsInstallHelp · `spec:design:behavior-settings-install-help`

ALWAYS the dialog is the help dialog's shape: the title Add CoGra to your home screen, one paragraph and Close

ALWAYS settings.dialog.body reads In Safari, tap Share, then Add to Home Screen.

ALWAYS the dialog offers no link and no second action

WHEN the dialog opens -> focus moves to its title AND focus stays inside the dialog until it closes

WHEN tap settings.dialog.close -> the dialog closes onto settings, as it was AND focus returns to settings.clearing.install

WHEN tap the scrim -> the dialog closes onto settings, as it was AND focus returns to settings.clearing.install

WHEN press system Back GIVEN the dialog is open -> the dialog closes onto settings, as it was AND NEVER settings navigates back
