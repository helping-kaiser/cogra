package com.cogra.core.designsystem.v2.atom

/**
 * One row of an overflow menu: the words, and what selecting them does.
 *
 * The label is a finished string rather than a resource id, because the
 * rows that name an actor compose their words from that actor
 * (`Hide @ada`) and the menu has no business knowing which ones do.
 */
data class MenuRow(val label: String, val testTag: String, val onSelect: () -> Unit)
