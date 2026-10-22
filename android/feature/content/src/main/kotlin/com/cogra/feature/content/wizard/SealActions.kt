package com.cogra.feature.content.wizard

import com.cogra.core.designsystem.v2.compose.HelpTopic

/** What the seal's foot and fact rows answer with — one bundle, so the stage stays readable. */
internal class SealActions(
    val onOpenSheet: (SealSheet) -> Unit,
    val onSign: () -> Unit,
    val onBack: () -> Unit,
    val onRestoreKey: () -> Unit,
    val onKeepDraft: () -> Unit,
    val onHelp: (HelpTopic) -> Unit,
    val onRetryUploads: () -> Unit,
    val onRemoveRefused: (String) -> Unit,
    val onReport: () -> Unit,
    val onDiscardPost: () -> Unit,
)
