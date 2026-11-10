package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface

/**
 * The task page's one anatomy (settings-surface §3.0; the entry funnel's
 * doors draw the same page): a header with back only and no title; a body
 * column at `8px 24px 32px`; the `h1` in `headlineSmall`; the lead in
 * `bodyMedium` on `onSurfaceVariant`, 8dp under it; then the page's own
 * fields, commit and note. THE PAGE SCROLLS with its commit in flow —
 * readme §4's "two placements": task pages put the commit after the last
 * field (K6, the executed law over the K13 digest's pinned CTA).
 *
 * The deletion band, while the account's confirmed deletion runs its grace,
 * sits directly under the pinned header, full-bleed (`FeedDeleting.md:3-5`).
 */
@Composable
fun TaskPage(
    node: DataNode,
    backLabel: String,
    onBack: () -> Unit,
    title: String,
    lead: String,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    deletionBand: @Composable () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = {
            Column {
                PageHeader(
                    onBack = onBack,
                    backContentDescription = backLabel,
                    node = node / "header",
                )
                deletionBand()
            }
        },
        snackbarHost = { CograSnackbarHost(snackbar, testTag = "${node.path}_snackbar") },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 32.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier
                    .semantics { heading() }
                    .dataNode(node / "title"),
            )
            Text(
                text = lead,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .dataNode(node / "body"),
            )
            content()
        }
    }
}
