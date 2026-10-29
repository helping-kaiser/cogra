package com.cogra.core.designsystem.v2.atom

/**
 * The [AddressCard]'s one inline word (`Revoke`), waiting as the pill does:
 * inert from the press, its participle past 200ms.
 */
data class AddressAction(
    val label: String,
    val onClick: () -> Unit,
    /** In flight: the word refuses a second press and is never dimmed. */
    val inFlight: Boolean = false,
    /** What the word reads once the wait passes the participle delay (`Revoking…`). */
    val busyLabel: String? = null,
)
