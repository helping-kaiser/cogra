package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
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
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.annotation.StringRes
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.TagParameterSliders
import com.cogra.core.designsystem.TopicChip
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.domain.LicenseChoice
import com.cogra.domain.topics.TagNameProblem
import com.cogra.domain.topics.canonicalTagName
import com.cogra.domain.topics.isAddableTagName
import com.cogra.domain.topics.tagNameProblem
import com.cogra.feature.content.R

@Composable
fun ComposePostRoute(
    postId: String?,
    /** The write signed; the caller decides where the author lands. */
    onSaved: () -> Unit,
    onBack: () -> Unit,
    keyBanner: @Composable () -> Unit = {},
    viewModel: ComposePostViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    // A one-shot: leaving the composer is an effect of the signature
    // landing in state, not something composition itself performs.
    LaunchedEffect(state.saved) {
        if (state.saved) {
            onSaved()
            viewModel.onSavedConsumed()
        }
    }
    ComposePostScreen(
        state = state,
        onTitleChange = viewModel::onTitleChange,
        onDescriptionChange = viewModel::onDescriptionChange,
        onBodyChange = viewModel::onBodyChange,
        onLicenseChange = viewModel::onLicenseChange,
        onTagInputChange = viewModel::onTagInputChange,
        onAddTag = viewModel::onAddTag,
        onRemoveTag = viewModel::onRemoveTag,
        onTuneTag = viewModel::onTuneTag,
        onDoneTuningTag = viewModel::onDoneTuningTag,
        onTagRelevanceChange = viewModel::onTagRelevanceChange,
        onTagConfidenceChange = viewModel::onTagConfidenceChange,
        onSubmit = viewModel::onSubmit,
        onConfirmSubmit = viewModel::onConfirmSubmit,
        onDismissConfirm = viewModel::onDismissConfirm,
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
    onTagInputChange: (String) -> Unit,
    onAddTag: () -> Unit,
    onRemoveTag: (String) -> Unit,
    onTuneTag: (String) -> Unit,
    onDoneTuningTag: () -> Unit,
    onTagRelevanceChange: (String, Double) -> Unit,
    onTagConfidenceChange: (String, Double) -> Unit,
    onSubmit: () -> Unit,
    onConfirmSubmit: (Boolean) -> Unit,
    onDismissConfirm: () -> Unit,
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
            // Tags are never fields of the post record (post.md §3) —
            // but this is where an author changes them (F3): the
            // section stages its own Tag acts, which ride the same
            // submit and the same signing pass.
            TopicEntry(
                section = state.tagSection,
                testTagPrefix = "compose",
                onTagInputChange = onTagInputChange,
                onAddTag = onAddTag,
                onRemoveTag = onRemoveTag,
                onTuneTag = onTuneTag,
                onDoneTuningTag = onDoneTuningTag,
                onTagRelevanceChange = onTagRelevanceChange,
                onTagConfidenceChange = onTagConfidenceChange,
            )
            // License qualifiers are genesis-only and immutable
            // (post.md §4) — the edit form carries none.
            if (!editing) {
                LicenseControls(license = state.license, onLicenseChange = onLicenseChange)
            }
            state.refusal?.let { message ->
                ErrorLine(message, "compose_refused")
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
            // What signing this will cost, beside the button that does
            // it: every record in the batch is its own priced act, so
            // the count is the thing to read BEFORE signing (F4).
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                SignedActionsLine(
                    count = state.signedActionCount,
                    testTag = "compose_signed_actions",
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = onSubmit,
                    enabled = !state.submitting && !state.nothingToSign,
                    modifier = Modifier.testTag("compose_submit"),
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
    if (state.confirmPending) {
        MultiActionConfirm(
            count = state.signedActionCount,
            testTagPrefix = "compose",
            onConfirm = onConfirmSubmit,
            onDismiss = onDismissConfirm,
        )
    }
}

/**
 * What signing this will cost, beside the button that does it: every
 * record in the batch is its own priced act, so the count is the thing
 * to read BEFORE signing (F4). Live, so it moves as the author types.
 */
@Composable
internal fun SignedActionsLine(
    count: Int,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = pluralStringResource(R.plurals.content_signed_actions, count, count),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.testTag(testTag),
    )
}

/**
 * The confirm a batch earns (F4): what it will sign, and the way out of
 * being asked again. Material puts the confirming action on the right,
 * which `AlertDialog` does for us (F7).
 */
@Composable
internal fun MultiActionConfirm(
    count: Int,
    testTagPrefix: String,
    onConfirm: (Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    var dontAskAgain by rememberSaveable { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("${testTagPrefix}_confirm"),
        title = { Text(stringResource(R.string.content_confirm_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = pluralStringResource(R.plurals.content_confirm_body, count, count),
                    modifier = Modifier.testTag("${testTagPrefix}_confirm_body"),
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        // One target for the pair, announced once.
                        .toggleable(
                            value = dontAskAgain,
                            role = Role.Checkbox,
                            onValueChange = { dontAskAgain = it },
                        )
                        .testTag("${testTagPrefix}_confirm_dont_ask"),
                ) {
                    Checkbox(checked = dontAskAgain, onCheckedChange = null)
                    Text(
                        text = stringResource(R.string.content_confirm_dont_ask),
                        modifier = Modifier.padding(start = 12.dp),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(dontAskAgain) },
                modifier = Modifier.testTag("${testTagPrefix}_confirm_proceed"),
            ) {
                Text(stringResource(R.string.content_confirm_proceed))
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("${testTagPrefix}_confirm_cancel"),
            ) {
                Text(stringResource(R.string.content_confirm_cancel))
            }
        },
    )
}

/**
 * The tags section, on both the creation composer and the edit screen
 * (F3): free text (D15: no autocomplete) with a live canonicalization
 * preview, add-as-chip gated on L1's atom rule (F1), tap-a-chip for its
 * two parameters (F6), remove-before-send, capped at 10 (D18). Each
 * chip carries the server's own words when a write was refused on it
 * (F2).
 */
@Composable
internal fun TopicEntry(
    section: TagSectionState,
    testTagPrefix: String,
    onTagInputChange: (String) -> Unit,
    onAddTag: () -> Unit,
    onRemoveTag: (String) -> Unit,
    onTuneTag: (String) -> Unit,
    onDoneTuningTag: () -> Unit,
    onTagRelevanceChange: (String, Double) -> Unit,
    onTagConfidenceChange: (String, Double) -> Unit,
    /** The comment surfaces sit inside a card; the heading would only repeat. */
    showHeading: Boolean = true,
) {
    val tagInput = section.input
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (showHeading) {
            Text(
                stringResource(R.string.content_topics_heading),
                style = MaterialTheme.typography.titleSmall,
            )
        }
        if (section.tags.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.testTag("${testTagPrefix}_tags"),
            ) {
                section.tags.forEach { row ->
                    TopicChip(
                        name = row.name,
                        onClick = { onTuneTag(row.name) },
                        onRemove = { onRemoveTag(row.name) },
                        testTag = "${testTagPrefix}_tag_${row.name}",
                    )
                }
            }
            // Verbatim, on the chip the server named (F2).
            section.tags.forEach { row ->
                row.error?.let { message ->
                    ErrorLine(message, "${testTagPrefix}_tag_error_${row.name}")
                }
            }
        }
        if (section.capReached) {
            Text(
                stringResource(R.string.content_topics_cap_reached, MAX_TAGS),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.testTag("${testTagPrefix}_tags_cap"),
            )
        } else {
            val problem = tagNameProblem(tagInput)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = tagInput,
                    onValueChange = onTagInputChange,
                    label = { Text(stringResource(R.string.content_topics_field)) },
                    singleLine = true,
                    isError = problem != null,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("${testTagPrefix}_tag_input"),
                )
                // The gate is UX, not validation — the server stays the
                // authority — but a name the substrate cannot carry
                // never reaches a signature (F1).
                TextButton(
                    onClick = onAddTag,
                    enabled = isAddableTagName(tagInput),
                    modifier = Modifier.testTag("${testTagPrefix}_tag_add"),
                ) {
                    Text(stringResource(R.string.content_topics_add))
                }
            }
            if (problem != null) {
                ErrorLine(problem.message(), "${testTagPrefix}_tag_illegal")
            } else if (tagInput.isNotBlank()) {
                Text(
                    stringResource(R.string.content_topics_preview, canonicalTagName(tagInput)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("${testTagPrefix}_tag_preview"),
                )
            }
        }
    }
    section.tags.firstOrNull { it.name == section.tuning }?.let { row ->
        TagParametersDialog(
            row = row,
            testTagPrefix = testTagPrefix,
            onRelevanceChange = { onTagRelevanceChange(row.name, it) },
            onConfidenceChange = { onTagConfidenceChange(row.name, it) },
            onDone = onDoneTuningTag,
        )
    }
}

/** Why this name cannot be an identifier atom, in the reader's terms (F1). */
@Composable
private fun TagNameProblem.message(): String = stringResource(
    when (this) {
        TagNameProblem.WHITESPACE -> R.string.content_topics_illegal_whitespace
        TagNameProblem.TOO_LONG -> R.string.content_topics_illegal_too_long
        TagNameProblem.ILLEGAL_CHARSET -> R.string.content_topics_illegal_charset
    },
)

/**
 * One chip's two parameters (F6). The dialog only closes the editor —
 * every change is already in the draft, and nothing here signs.
 */
@Composable
private fun TagParametersDialog(
    row: TagRow,
    testTagPrefix: String,
    onRelevanceChange: (Double) -> Unit,
    onConfidenceChange: (Double) -> Unit,
    onDone: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDone,
        modifier = Modifier.testTag("${testTagPrefix}_tag_params"),
        title = { Text("#${row.name}") },
        text = {
            TagParameterSliders(
                relevance = row.relevance,
                confidence = row.confidence,
                onRelevanceChange = onRelevanceChange,
                onConfidenceChange = onConfidenceChange,
                testTagPrefix = "${testTagPrefix}_tag_params",
            )
        },
        confirmButton = {
            TextButton(
                onClick = onDone,
                modifier = Modifier.testTag("${testTagPrefix}_tag_params_done"),
            ) {
                Text(stringResource(R.string.content_topics_params_done))
            }
        },
    )
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
            label = R.string.content_license_provenance_label,
            tags = PROVENANCE_TAGS,
            labels = PROVENANCE_LABELS,
            value = license.provenance,
            onChange = { onLicenseChange(license.copy(provenance = it)) },
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

private val PROVENANCE_TAGS = listOf(
    "license_provenance_none",
    "license_provenance_commercial",
    "license_provenance_always",
)

private val PROVENANCE_LABELS = listOf(
    R.string.content_license_provenance_none,
    R.string.content_license_provenance_commercial,
    R.string.content_license_provenance_always,
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
    if (license.attribution == 0.0 && license.provenance == 0.0) {
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
    if (license.provenance > 0.0) {
        terms += when (license.provenance) {
            0.5 -> stringResource(R.string.content_license_terms_record_commercial)
            1.0 -> stringResource(R.string.content_license_terms_record_always)
            else -> stringResource(
                R.string.content_license_terms_record_degree,
                license.provenance.toString(),
            )
        }
    }
    return terms.joinToString(" ")
}
