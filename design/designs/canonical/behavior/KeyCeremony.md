# KeyCeremony · `spec:design:behavior-key-ceremony`

WHEN press Create my key on the applicant's task card GIVEN this browser can hold a key -> KeyCeremony opens

WHEN press Make a new key on the applicant's key-elsewhere card GIVEN this browser can hold a key -> KeyCeremony opens AND the ceremony's end replaces the attached key

WHEN tap the Recovery code row or the Your key row in settings GIVEN an applicant before any key -> KeyCeremony opens

WHEN tap the Recovery code row or the Your key row in settings GIVEN an applicant before any key, in a browser that can't hold a key -> KeyCeremonyUnsupported opens AND NEVER anything is minted

WHEN press Create my key or Make a new key -> the ceremony probes this browser for WebCrypto Ed25519 before anything is minted

WHEN the probe finds no Ed25519 -> KeyCeremonyUnsupported opens in the ceremony's place AND nothing is minted

ALWAYS no key exists until the typed-back code confirms or I accept the risk is pressed

WHEN press Create my recovery code -> the dialog Ready to record your code? opens over the ceremony

WHEN press Not now -> the dialog Continue without a backup? opens over the ceremony AND NEVER the ceremony is skipped

ALWAYS Create my recovery code is the filled button and Not now the outlined one

ALWAYS the header's arrow reads Back

WHEN press the header's back arrow GIVEN the ceremony opened from the applicant's task card -> ApplicantFeed opens with the task card exactly as it was AND nothing is made

WHEN press the header's back arrow GIVEN the ceremony opened from the key-elsewhere card -> ApplicantKeyElsewhere opens with the attached key untouched AND nothing is made

WHEN press the header's back arrow GIVEN the ceremony opened from a key row in settings -> Settings opens AND nothing is made

WHEN the tab is closed or the app is killed before the ceremony ends -> nothing is made AND the next open shows the task card exactly as it was
