# KeyDecline · `spec:design:behavior-key-decline`

WHEN press Not now on the key ceremony -> the dialog Continue without a backup? opens over the ceremony AND NEVER the ceremony is skipped

ALWAYS only the dialog and its scrim take a press while it is up

ALWAYS Go back is the filled answer and I accept the risk the quiet text button

WHEN press Go back -> the dialog closes onto the key ceremony AND nothing is made

WHEN tap the scrim or press system Back or Escape -> the dialog closes onto the key ceremony AND nothing is made

WHEN press I accept the risk -> I accept the risk refuses a second press until the attach answers AND NEVER I accept the risk dims

WHEN the attach is taken -> the key is attached and kept with no backup AND the reader returns where the ceremony began AND the task card the ceremony came from completes and leaves the feed AND the snackbar reads Key made — no backup yet. You can make a code in settings. AND NEVER the dialog closes silently

WHEN press I accept the risk GIVEN no answer reaches the device -> the dialog stays up with its pair AND the line That didn't send. Try again. stands in it AND I accept the risk reads Retry AND NEVER the snackbar Key made — no backup yet. You can make a code in settings. appears

WHEN press I accept the risk GIVEN the server answers INTERNAL, FORBIDDEN, SIGNATURE_INVALID or a BAD_INPUT naming no field -> the dialog stays up with its pair AND the line That didn't go through. Try again. stands in it AND I accept the risk reads Retry AND NEVER the snackbar Key made — no backup yet. You can make a code in settings. appears

WHEN the attach is refused because the application was approved meanwhile GIVEN the ceremony opened from the key-elsewhere card -> the dialog and the ceremony close AND the feed opens with the member's key-elsewhere card at its head, as KeyCeremony says AND NEVER a fault line or Retry stands AND NEVER a snackbar answers

ALWAYS the pledge reads Everything you publish is signed with a key that is created on this browser and stays in your hands — CoGra never holds it and can never reissue it. on the web, and says in this app in the app GIVEN the ceremony stands beneath the dialog

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
