// THE KEPT PICKS' REVIEW AND ITS SEAL, drawn (KeptPicksReview, KeptPicksSeal;
// registered round 23: `keptPicks.*` with `keptPicks.pick` keyed by place from
// 1, `keptPicksSeal.*` with `keptPicksSeal.acts.actRow` keyed the same way).
//
// - The review: `Kept picks` over the intro, the approval line where one was
//   kept, one `StagedReference` row per pick with its ×, a polite status that
//   says each drop, and `Sign them` pinned at the foot (ruling A2's wizard
//   reading).
// - The seal: the standard seal — `What you sign` and `Last step` in the
//   header with its `?`, the acts card, `Sign the picks` over `Back`. It waits
//   like every seal: inert from the press, `Signing the picks…` past 200ms with
//   the ways out refusing a press (never dimmed), the slow line past 5s, never
//   a spinner.

package com.cogra.feature.stance.kept

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.StanceZeroWords
import com.cogra.core.designsystem.bundleReadout
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.pair
import com.cogra.core.designsystem.reading
import com.cogra.core.designsystem.v2.atom.ActsCard
import com.cogra.core.designsystem.v2.atom.ActsCardRow
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.atom.NoticeLine
import com.cogra.core.designsystem.v2.atom.NoticePanel
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.SLOW_SIGNING_MS
import com.cogra.core.designsystem.v2.atom.WizardHeader
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.atom.rememberParticiple
import com.cogra.core.designsystem.v2.atom.rememberWaitedPast
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StanceTarget

private val REVIEW = DataNode("keptPicks")
private val SEAL = DataNode("keptPicksSeal")

/** What the screen hands back up: every way out, and the door to Invites. */
data class KeptPicksActions(
    val onRemove: (Int) -> Unit = {},
    val onFocusMoved: () -> Unit = {},
    val onSignThem: () -> Unit = {},
    val onHeaderBack: () -> Unit = {},
    val onBackToReview: () -> Unit = {},
    val onLeave: () -> Unit = {},
    val onSign: () -> Unit = {},
    val onOpenInvites: () -> Unit = {},
)

/**
 * The route: the screen over its holder, and the exits routed up. [onExit]
 * leaves for where the review was opened from, with the line the surface
 * there says once (or none); [onOpenInvites] opens Invites naming its door,
 * `Back to Kept picks` (Invites.md:111).
 */
@Composable
fun KeptPicksRoute(
    onExit: (String?) -> Unit,
    onOpenInvites: () -> Unit,
    viewModel: KeptPicksViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.exit) {
        val exit = state.exit as? KeptExit.Left ?: return@LaunchedEffect
        viewModel.onExited()
        onExit(
            when (val snack = exit.snackbar) {
                KeptSnack.NothingLeft -> KEPT_NOTHING_LEFT
                is KeptSnack.Signed -> keptSigned(snack.count)
                null -> null
            },
        )
    }
    KeptPicksScreen(
        state = state,
        actions = KeptPicksActions(
            onRemove = viewModel::onRemove,
            onFocusMoved = viewModel::onFocusMoved,
            onSignThem = viewModel::onSignThem,
            onHeaderBack = viewModel::onHeaderBack,
            onBackToReview = viewModel::onBackToReview,
            onLeave = viewModel::onLeave,
            onSign = viewModel::onSign,
            onOpenInvites = onOpenInvites,
        ),
    )
}

@Composable
fun KeptPicksScreen(state: KeptPicksUiState, actions: KeptPicksActions) {
    // Nothing is drawn until the store answers, and nothing once the review
    // is leaving empty: a blank page for the frame it takes, never a flash of
    // an empty review.
    if (!state.loaded || state.rows.isEmpty()) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface))
        return
    }
    when (state.stage) {
        KeptStage.REVIEW -> KeptPicksReview(state, actions)
        KeptStage.SEAL -> KeptPicksSeal(state, actions)
    }
}

// ── The review ──────────────────────────────────────────────────────────────

@Composable
private fun KeptPicksReview(state: KeptPicksUiState, actions: KeptPicksActions) {
    // The system's Back is the header's arrow: the review closes, every pick kept (:33).
    BackHandler(onBack = actions.onHeaderBack)
    val focus = remember(state.rows.size) { List(state.rows.size) { FocusRequester() } }
    LaunchedEffect(state.focusIndex) {
        val index = state.focusIndex ?: return@LaunchedEffect
        focus.getOrNull(index)?.requestFocus()
        actions.onFocusMoved()
    }
    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .dataNodeSurface(),
    ) {
        PageHeader(
            title = KEPT_PICKS_TITLE,
            onBack = actions.onHeaderBack,
            backContentDescription = KEPT_BACK,
            node = REVIEW / "header",
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(Space.x4),
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = Space.x6, end = Space.x6, top = Space.x2),
        ) {
            Text(
                text = KEPT_PICKS_INTRO,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.dataNode(REVIEW / "intro"),
            )
            if (state.approvalKept) ApprovalLine(REVIEW, actions.onOpenInvites)
            Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
                state.rows.forEachIndexed { index, row ->
                    KeptPickRow(
                        row = row,
                        onRemove = { actions.onRemove(index) },
                        node = (REVIEW / "pick").keyed("${index + 1}"),
                        removeFocus = focus[index],
                    )
                }
            }
            Announcement(state.removedLeft)
        }
        // THE FOOT IS PINNED, 24 under `Sign them` (the board's pinned foot).
        Box(Modifier.padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x6)) {
            CograButton(
                text = KEPT_SIGN_THEM,
                onClick = actions.onSignThem,
                modifier = Modifier.fillMaxWidth(),
                testTag = (REVIEW / "sign").tag,
            )
        }
    }
}

/**
 * `keptPicks.announcement` — the pickers' status idiom: a polite status at
 * rest, saying nothing and drawing nothing until a drop (KeptPicksReview.md:7).
 */
@Composable
private fun Announcement(left: Int?) {
    val said = left?.let(::keptRemoved).orEmpty()
    Box(
        Modifier
            .size(1.dp)
            .dataNode(REVIEW / "announcement")
            .semantics {
                liveRegion = LiveRegionMode.Polite
                if (said.isNotEmpty()) contentDescription = said
            },
    )
}

/** `An approval waits in your invites — go there to sign it.` with `Open Invites` at its end (:45). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ApprovalLine(root: DataNode, onOpenInvites: () -> Unit) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth().dataNode(root / "approval"),
    ) {
        Text(
            text = KEPT_APPROVAL_LINE,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        InlineAction(
            text = KEPT_OPEN_INVITES,
            onClick = onOpenInvites,
            size = InlineSize.Small,
            node = root / "approval" / "open",
        )
    }
}

/**
 * ONE KEPT PICK (`StagedReference` with its ×, `stance`): the target's mark,
 * the name over its kind — and, where the pick would net its bundle to
 * nothing, that consequence in the family's landing words (KeptPicksReview.md:19)
 * — the pair as the readout draws it, spoken whole, and the remove ×.
 *
 * A REMOVED TARGET wears the removed-mark face: an empty tile, the mark where
 * the name stood in the system's voice, and its × named for the pick it drops
 * (`Remove this pick: Post, Removed by its author`).
 */
@Composable
private fun KeptPickRow(row: KeptRow, onRemove: () -> Unit, node: DataNode, removeFocus: FocusRequester) {
    val preview = row.preview
    val topic = preview.kind == StanceKind.TOPIC
    val axes = if (topic) StanceAxes.Affinity else StanceAxes.Opinion
    val zero = if (topic) StanceZeroWords.Disconnected else StanceZeroWords.Severed
    val point = StancePoint(row.pick.pick.pDirected, row.pick.pick.pInterest)
    val kind = keptKindWord(preview.kind)
    val removedName = preview.removed
    val removeName = if (removedName != null) "Remove this pick: $kind, $removedName" else "Remove ${preview.name}"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(node)
            .defaultMinSize(minHeight = 48.dp)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .padding(horizontal = Space.x3, vertical = Space.x2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        KeptMark(preview.kind, preview.name, preview.src.takeIf { removedName == null }, node / "mark")
        Column(Modifier.weight(1f)) {
            Text(
                text = removedName ?: preview.name,
                style = MaterialTheme.typography.bodyMedium.let {
                    if (removedName != null) it.copy(fontWeight = FontWeight.Normal) else it
                },
                color = if (removedName != null) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.dataNode(node / "name"),
            )
            KindLine(kind, node / "kind")
            if (row.severs) KindLine(stringResource(zero.reached), node / "consequence")
        }
        KeptPair(point, axes, node / "pair")
        RemoveCross(removeName, onRemove, removeFocus, node / "remove")
    }
}

/** The × that drops a kept pick, named for what it drops; 32 drawn, answering at 48. */
@Composable
private fun RemoveCross(name: String, onRemove: () -> Unit, focus: FocusRequester, node: DataNode) {
    Box(
        modifier = Modifier
            .dataNode(node)
            .focusRequester(focus)
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onRemove)
                    .semantics { contentDescription = name },
                drawnWidth = REMOVE_BOX,
                drawnHeight = REMOVE_BOX,
            )
            .size(REMOVE_BOX),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(REMOVE_GLYPH),
        )
    }
}

@Composable
private fun KindLine(text: String, node: DataNode) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.dataNode(node),
    )
}

/**
 * The row's mark (`NodeMark` on the staged row): a person's circle, else a
 * 32dp tile on `surfaceContainerHigh` — a post's cover, a topic's `#`, or the
 * kind's own empty tile.
 */
@Composable
private fun KeptMark(kind: StanceKind, name: String, src: String?, node: DataNode) {
    if (kind == StanceKind.PERSON) {
        Box(Modifier.dataNode(node).clearAndSetSemantics { }) { CograAvatar(name = name, size = MARK, url = src) }
        return
    }
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(MARK)
            .dataNode(node)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .clearAndSetSemantics { },
    ) {
        when {
            kind == StanceKind.POST && src != null -> AsyncImage(
                model = src,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(MARK),
            )
            kind == StanceKind.TOPIC -> Text(
                text = "#",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * The pair a kept pick signs, as the readout draws it: the face always, the
 * digits as a `cg-exact` tail in geek mode only, and the whole reading spoken —
 * `Nice, For or against +0.10, How much reaches you +0.10`, a topic's in the
 * Affinity pad's axis words (KeptPicksReview.md:7).
 */
@Composable
private fun KeptPair(point: StancePoint, axes: StanceAxes, node: DataNode) {
    val anchor = bundleReadout(point, EMPTY_PICK_LABEL)
    val spoken = "${stringResource(anchor.label)}, ${point.reading(axes)}"
    Row(
        modifier = Modifier
            .dataNode(node)
            .semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Text(
            text = anchor.emoji,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.dataNode(node / "face").clearAndSetSemantics { },
        )
        if (LocalShowExactValues.current) {
            Text(
                text = point.pair(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                modifier = Modifier.dataNode(node / "exact").clearAndSetSemantics { },
            )
        }
    }
}

// ── The seal ────────────────────────────────────────────────────────────────

@Composable
private fun KeptPicksSeal(state: KeptPicksUiState, actions: KeptPicksActions) {
    val swapped = rememberParticiple(state.signing)
    val slow = rememberWaitedPast(state.signing, SLOW_SIGNING_MS)
    // Past 200ms the ways out refuse a press, never dimmed (KeptPicksSeal.md:23).
    val locked = state.signing && swapped
    val back = { if (!locked) actions.onBackToReview() }
    var help by remember { mutableStateOf<HelpTopic?>(null) }
    BackHandler(onBack = back)
    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .dataNodeSurface(),
    ) {
        WizardHeader(
            title = KEPT_SEAL_TITLE,
            onBack = back,
            onLeave = { if (!locked) actions.onLeave() },
            leaveContentDescription = KEPT_SEAL_LEAVE,
            trailingNote = KEPT_SEAL_STAGE,
            onHelp = { help = HelpTopic.HowSigningWorks },
            helpContentDescription = KEPT_SEAL_HELP,
            node = SEAL / "header",
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(Space.x4),
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(start = Space.x6, end = Space.x6, top = Space.x2, bottom = Space.x6),
        ) {
            ActsCard(rows = state.rows.map { it.actRow() }, slow = slow, node = SEAL / "acts")
            if (state.approvalKept) ApprovalLine(SEAL, actions.onOpenInvites)
            Spacer(Modifier.weight(1f))
            SealFoot(state, swapped, actions, back, onHelp = { help = it })
        }
    }
    help?.let { topic ->
        HelpDialog(title = topic.title, paragraphs = topic.paragraphs, onClose = { help = null })
    }
}

/** A seal row (KeptPicksSeal.md:5-:13): what it is on — or its mark — over the face and the pair. */
private fun KeptRow.actRow(): ActsCardRow {
    val topic = preview.kind == StanceKind.TOPIC
    return ActsCardRow(label = keptActLabel(preview.kind), count = 1, noun = keptActNoun(preview.kind)) {
        val point = StancePoint(pick.pick.pDirected, pick.pick.pInterest)
        val removed = preview.removed
        Column(Modifier.padding(vertical = 6.dp)) {
            Text(
                // A topic reads with its # on the seal (:7).
                text = removed ?: if (topic && pick.target is StanceTarget.Topic) "#${preview.name}" else preview.name,
                style = MaterialTheme.typography.bodyMedium.let {
                    if (removed != null) it.copy(fontWeight = FontWeight.Normal) else it
                },
                color = if (removed != null) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            SealPair(point, if (topic) StanceAxes.Affinity else StanceAxes.Opinion)
        }
    }
}

/** The seal row's face and pair (`StanceReadout`'s `ReadoutLine`), spoken whole. */
@Composable
private fun SealPair(point: StancePoint, axes: StanceAxes) {
    val anchor = bundleReadout(point, EMPTY_PICK_LABEL)
    val spoken = "${stringResource(anchor.label)}, ${point.reading(axes)}"
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = spoken },
    ) {
        Text(
            text = anchor.emoji,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.clearAndSetSemantics { },
        )
        if (LocalShowExactValues.current) {
            Text(
                text = point.pair(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
    }
}

/**
 * The seal's foot in its states: the write rule's notice with `Not now`, the
 * bug notice with `Try again`, `Report a problem` and `Not now`, or the commit
 * — `Sign the picks` over `Back`, with the fault line and `Retry` where no
 * answer reached the seal (KeptPicksSeal.md:27-:39).
 */
@Composable
private fun SealFoot(
    state: KeptPicksUiState,
    swapped: Boolean,
    actions: KeptPicksActions,
    back: () -> Unit,
    onHelp: (HelpTopic) -> Unit,
) {
    when (state.fault) {
        KeptSealFault.WRITE_RULE -> WriteRuleFoot(actions, onHelp)
        KeptSealFault.BUG -> BugFoot(actions)
        else -> Column(
            verticalArrangement = Arrangement.spacedBy(Space.x2),
            modifier = Modifier.fillMaxWidth().dataNode(SEAL / "foot"),
        ) {
            val offline = state.fault == KeptSealFault.OFFLINE && !state.signing
            if (offline) ErrorLine(KEPT_OFFLINE_LINE, testTag = "kept_picks_seal_fault")
            CograButton(
                text = when {
                    swapped -> KEPT_SIGNING
                    offline -> KEPT_RETRY
                    else -> KEPT_SIGN
                },
                // Inert from the press, never dimmed (:21).
                onClick = { if (!state.signing) actions.onSign() },
                kind = if (offline) ButtonKind.Outlined else ButtonKind.Filled,
                modifier = Modifier.fillMaxWidth(),
                testTag = (SEAL / "foot" / "sign").tag,
            )
            FootText(KEPT_BACK, back, (SEAL / "foot" / "back").tag)
        }
    }
}

/** The write rule's notice on the kept picks' seal (WriteRuleFailed.md:39), `Not now` back to the review. */
@Composable
private fun WriteRuleFoot(actions: KeptPicksActions, onHelp: (HelpTopic) -> Unit) {
    NoticePanel(
        title = KEPT_WRITE_RULE_TITLE,
        helpLabel = KEPT_WRITE_RULE_HELP,
        onHelp = { onHelp(HelpTopic.WhySigningWaitsKept) },
        helpTestTag = "kept_picks_seal_write_rule_help",
        testTag = "kept_picks_seal_write_rule",
    ) {
        NoticeLine(KEPT_WRITE_RULE_FACT)
    }
    FootText(KEPT_NOT_NOW, actions.onBackToReview, "kept_picks_seal_not_now")
}

/** `This shouldn't have happened` (SealFaultBug.md:43-:45): `Try again`, then `Report a problem` and `Not now`. */
@Composable
private fun BugFoot(actions: KeptPicksActions) {
    NoticePanel(title = KEPT_BUG_TITLE, testTag = "kept_picks_seal_bug") {
        NoticeLine(KEPT_BUG_FACT)
        CograButton(
            text = KEPT_TRY_AGAIN,
            onClick = actions.onSign,
            kind = ButtonKind.Inverse,
            modifier = Modifier.fillMaxWidth(),
            testTag = "kept_picks_seal_try_again",
        )
    }
    Column(Modifier.fillMaxWidth()) {
        // No report surface exists on the app yet; the word stands as drawn.
        FootText(KEPT_REPORT, {}, "kept_picks_seal_report")
        FootText(KEPT_NOT_NOW, actions.onBackToReview, "kept_picks_seal_not_now")
    }
}

@Composable
private fun FootText(text: String, onClick: () -> Unit, testTag: String) {
    CograButton(
        text = text,
        onClick = onClick,
        kind = ButtonKind.Text,
        modifier = Modifier.fillMaxWidth(),
        testTag = testTag,
    )
}

/** `StagedReference`'s × box: 32 drawn, 18 glyph. */
private val REMOVE_BOX = 32.dp
private val REMOVE_GLYPH = 18.dp

/** `NodeMark` at the staged row's size. */
private val MARK = 32.dp
