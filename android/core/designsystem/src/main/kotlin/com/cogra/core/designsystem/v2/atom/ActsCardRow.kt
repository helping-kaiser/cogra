package com.cogra.core.designsystem.v2.atom

import androidx.compose.runtime.Composable

/** One act on the card ([ActsCard]): its quiet kind, what it names, and its count heard whole. */
class ActsCardRow(
    val label: String,
    val count: Int,
    /** The count's noun, singular — `opinion` reads `1 opinion` to an ear (ActsCard.jsx COUNT). */
    val noun: String,
    val value: @Composable () -> Unit,
)
