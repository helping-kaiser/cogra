package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.annotation.StringRes
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.LicenseChoice
import com.cogra.feature.content.R

@Composable
fun ComposePostRoute(
    postId: String?,
    onSaved: () -> Unit,
    onBack: () -> Unit,
    keyBanner: @Composable () -> Unit = {},
    viewModel: ComposePostViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    if (state.saved) {
        viewModel.onSavedConsumed()
        onSaved()
    }
    ComposePostScreen(
        state = state,
        onTitleChange = viewModel::onTitleChange,
        onDescriptionChange = viewModel::onDescriptionChange,
        onBodyChange = viewModel::onBodyChange,
        onLicenseChange = viewModel::onLicenseChange,
        onSubmit = viewModel::onSubmit,
        onBack = onBack,
        keyBanner = keyBanner,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComposePostScreen(
    state: ComposePostUiState,
    onTitleChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onBodyChange: (String) -> Unit,
    onLicenseChange: (LicenseChoice) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
    keyBanner: @Composable () -> Unit = {},
) {
    val editing = state.editingId != null
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.collapsingTop(collapsingTop),
        topBar = {
            Column {
                TopAppBar(
                    colors = surfaceTopAppBarColors(),
                    scrollBehavior = collapsingTop.scrollBehavior,
                    title = {
                        Text(
                            stringResource(
                                if (editing) R.string.content_compose_edit_title
                                else R.string.content_compose_title,
                            ),
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack, modifier = Modifier.testTag("compose_back")) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.content_back),
                            )
                        }
                    },
                )
                // The key banner rides the collapsing top here too — a
                // keyless writer learns before drafting, not at submit
                // (design.md §6).
                CollapsingTopBanner(collapsingTop) { keyBanner() }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.loading) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .testTag("compose_loading"),
                )
                return@Column
            }
            if (state.notFound) {
                ErrorLine(R.string.content_error_not_found, "compose_not_found")
                return@Column
            }
            OutlinedTextField(
                value = state.title,
                onValueChange = onTitleChange,
                label = { Text(stringResource(R.string.content_field_title)) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_title"),
            )
            OutlinedTextField(
                value = state.description,
                onValueChange = onDescriptionChange,
                label = { Text(stringResource(R.string.content_field_description)) },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_description"),
            )
            OutlinedTextField(
                value = state.body,
                onValueChange = onBodyChange,
                label = { Text(stringResource(R.string.content_field_body)) },
                minLines = 6,
                isError = state.emptyBody,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_body"),
            )
            if (state.emptyBody) {
                ErrorLine(R.string.content_error_empty_body, "compose_empty_body")
            }
            // License qualifiers are genesis-only and immutable
            // (post.md §4) — the edit form carries none.
            if (!editing) {
                LicenseControls(license = state.license, onLicenseChange = onLicenseChange)
            }
            if (state.refused) {
                ErrorLine(R.string.content_error_refused, "compose_refused")
            }
            if (state.signingFailed) {
                ErrorLine(
                    if (state.signingNeedsKey) {
                        R.string.content_error_signing_no_key
                    } else {
                        R.string.content_error_signing
                    },
                    "compose_signing_failed",
                )
            }
            if (state.transportFailed) {
                ErrorLine(R.string.content_error_transport, "compose_transport_error")
            }
            Button(
                onClick = onSubmit,
                enabled = !state.submitting,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("compose_submit"),
            ) {
                Text(
                    stringResource(
                        if (editing) R.string.content_save_edit else R.string.content_submit,
                    ),
                )
            }
        }
    }
}

/**
 * The mandatory authoring-time license declaration (guidelines §5).
 * Each axis offers the three degrees CoGra publishes a reading for —
 * the record carries the whole square, but a degree with no published
 * reading is a term no reader could check.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LicenseControls(
    license: LicenseChoice,
    onLicenseChange: (LicenseChoice) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.content_license_heading),
            style = MaterialTheme.typography.titleSmall,
        )
        Text(
            stringResource(R.string.content_license_caption),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        LicenseAxis(
            label = R.string.content_license_attribution_label,
            tags = ATTRIBUTION_TAGS,
            labels = ATTRIBUTION_LABELS,
            value = license.attribution,
            onChange = { onLicenseChange(license.copy(attribution = it)) },
        )
        LicenseAxis(
            label = R.string.content_license_oversight_label,
            tags = OVERSIGHT_TAGS,
            labels = OVERSIGHT_LABELS,
            value = license.oversight,
            onChange = { onLicenseChange(license.copy(oversight = it)) },
        )
    }
}

private val ATTRIBUTION_TAGS = listOf(
    "license_attribution_none",
    "license_attribution_commercial",
    "license_attribution_always",
)

private val ATTRIBUTION_LABELS = listOf(
    R.string.content_license_attribution_none,
    R.string.content_license_attribution_commercial,
    R.string.content_license_attribution_always,
)

private val OVERSIGHT_TAGS = listOf(
    "license_oversight_none",
    "license_oversight_commercial",
    "license_oversight_always",
)

private val OVERSIGHT_LABELS = listOf(
    R.string.content_license_oversight_none,
    R.string.content_license_oversight_commercial,
    R.string.content_license_oversight_always,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LicenseAxis(
    @StringRes label: Int,
    tags: List<String>,
    labels: List<Int>,
    value: Double,
    onChange: (Double) -> Unit,
) {
    Text(stringResource(label))
    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
        LicenseChoice.TIERS.forEachIndexed { index, tier ->
            SegmentedButton(
                selected = value == tier,
                onClick = { onChange(tier) },
                shape = SegmentedButtonDefaults.itemShape(
                    index = index,
                    count = LicenseChoice.TIERS.size,
                ),
                modifier = Modifier.testTag(tags[index]),
            ) {
                Text(stringResource(labels[index]))
            }
        }
    }
}

/**
 * What a landed node's qualifiers oblige, on the read surface. Public
 * Domain is the one pair that obliges nothing, so it says so rather
 * than listing two absences; a degree between the published tiers reads
 * as the degree itself rather than being rounded into a tier it is not.
 */
@Composable
internal fun licenseTerms(license: LicenseChoice): String {
    if (license.attribution == 0.0 && license.oversight == 0.0) {
        return stringResource(R.string.content_license_terms_public_domain)
    }
    val terms = mutableListOf<String>()
    if (license.attribution > 0.0) {
        terms += when (license.attribution) {
            0.5 -> stringResource(R.string.content_license_terms_credit_commercial)
            1.0 -> stringResource(R.string.content_license_terms_credit_always)
            else -> stringResource(
                R.string.content_license_terms_credit_degree,
                license.attribution.toString(),
            )
        }
    }
    if (license.oversight > 0.0) {
        terms += when (license.oversight) {
            0.5 -> stringResource(R.string.content_license_terms_record_commercial)
            1.0 -> stringResource(R.string.content_license_terms_record_always)
            else -> stringResource(
                R.string.content_license_terms_record_degree,
                license.oversight.toString(),
            )
        }
    }
    return terms.joinToString(" ")
}
