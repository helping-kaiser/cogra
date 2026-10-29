// THE FEED FILTER SHEET (design/components/navigation/FeedFilter.jsx
// `FeedFilterSheet`, `FeedPeopleRows`; OrderSection.jsx; FeedSheet.md,
// SettingsReading.md): the whole filter — four kinds that combine, forms of
// post, the one order with the seen toggle, what else is admitted, whose
// people, and the one topic that does not combine — with `Reset` and `Done`
// in its foot. web's twin is `web/src/lib/ui2/feed-filter-sheet.tsx`.
//
// ONE SHEET, TWO HOSTS. The feed opens it from the band's trigger; Settings'
// What your feed shows row opens it to set the reader's default, titled, with
// no topic section (a default never holds one). The sections, hints and foot
// are the same on both (SettingsReading.md: "the sheet is the feed's own
// filter sheet, its sections and hints the feed's"); only the host decides
// what `Reset` stages and what `Done` does.
//
// IT STAGES, AND ONLY THE HOST COMMITS (the sheet law, readme §4, *Sheets*):
// every control here changes the staged value the host holds, and nothing
// behind the sheet moves. The scrim, a swipe down and Back close it through
// `onDismiss`, which the host reads as "drop what is staged".
//
// IT STANDS AT 88% WITH ITS FOOT PINNED (FeedSheet.md:3; SettingsReading.md):
// four kinds and four sections outrun the sheet, so the sections scroll and
// the one control that must always be reachable stays under them.

package com.cogra.feature.feedfilter

import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.CograChip
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.FilterFoot
import com.cogra.core.designsystem.v2.atom.FilterSection
import com.cogra.core.designsystem.v2.atom.HelpDialog
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.core.designsystem.v2.atom.SegmentedFilter
import com.cogra.core.designsystem.v2.atom.SegmentedOption
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.atom.sheetCeilingHeight
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.feed.FEED_KINDS
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedForm
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedOrder
import com.cogra.domain.feed.FeedTopic
import com.cogra.domain.feed.PeopleScope
import com.cogra.domain.feed.PeopleSign
import com.cogra.domain.feed.label

/** The sheet's height share of the screen (FeedSheet.md:3: "it stands at 88% of the screen's height"). */
private const val SHEET_SHARE = 0.88f

/** The people rows' dot (`FeedPeopleRows`: 18px, a 5px ring chosen, a hairline not). */
private val DOT = 18.dp
private val DOT_CHOSEN_RING = 5.dp

/** The rows' words stand past the dot's column (18 + 10), and so does the sign row. */
private val DOT_GAP = 10.dp
private val ROWS_GAP = 6.dp

/** The sign row's indent: past the dot's column, so it aligns with the rows' words. */
private val SIGN_INDENT = DOT + DOT_GAP

/** A sign word's drawn line (body-medium's 20): its target grows to 48 around it (ruling 92). */
private val SIGN_LINE = 20.dp

/** The chip's registered value (`FEED_KINDS`: `posts`, `comments`, `profiles`, `topics`). */
fun FeedKind.chipValue(): String = when (this) {
    FeedKind.POST -> "posts"
    FeedKind.COMMENT -> "comments"
    FeedKind.PROFILE -> "profiles"
    FeedKind.TAG -> "topics"
}

private fun FeedForm.chipValue(): String = name.lowercase()

/**
 * Whose words the people rows, the order hint and the topic hint speak in:
 * the reader's own, or — on a feed that borrows a view — the borrowed
 * account's (FeedSheet.md, "GIVEN the feed borrows a view"). Show what
 * you've already seen, the kinds, the forms, Also show, Reset and the "?"
 * keep the reader's own first person either way.
 */
private data class ViewWords(
    val yourPeople: String,
    val everyoneHint: String,
    val yourPeopleHint: String,
    val signName: String,
    val orderHint: String,
    val topicHint: String,
)

@Composable
private fun viewWords(borrowedHandle: String?): ViewWords = if (borrowedHandle == null) {
    ViewWords(
        yourPeople = stringResource(R.string.feedfilter_your_people),
        everyoneHint = stringResource(R.string.feedfilter_everyone_hint),
        yourPeopleHint = stringResource(R.string.feedfilter_your_people_hint),
        signName = stringResource(R.string.feedfilter_sign_name),
        orderHint = stringResource(R.string.feedfilter_order_hint),
        topicHint = stringResource(R.string.feedfilter_topic_hint),
    )
} else {
    ViewWords(
        yourPeople = stringResource(R.string.feedfilter_your_people_borrowed, borrowedHandle),
        everyoneHint = stringResource(R.string.feedfilter_everyone_hint_borrowed, borrowedHandle),
        yourPeopleHint = stringResource(R.string.feedfilter_your_people_hint_borrowed, borrowedHandle),
        signName = stringResource(R.string.feedfilter_sign_name_borrowed, borrowedHandle),
        orderHint = stringResource(R.string.feedfilter_order_hint_borrowed, borrowedHandle),
        topicHint = stringResource(R.string.feedfilter_topic_hint_borrowed, borrowedHandle),
    )
}

/**
 * THE SHEET. [staged] is all it draws; every control hands [onStage] the
 * next staged value. [onReset] stages the host's default — the reader's on
 * a feed, CoGra's in Settings — and [onDone] commits. [titled] is the
 * settings host's reading: titled `What your feed shows` with its "?" on the
 * title's row and the note under it, focus on the title at opening
 * (SettingsReading.md). The feed's sheet is untitled — its trigger is a thumb
 * away, still on screen — and wears its "?" in the corner. [topics] are the
 * topics the reader holds and is for; none draws no topic section.
 * [onOpenTopics] is `All your topics`, the door to everything held; null
 * stands it inert.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedFilterSheet(
    staged: FeedFilter,
    onStage: (FeedFilter) -> Unit,
    onReset: () -> Unit,
    onDone: () -> Unit,
    onDismiss: () -> Unit,
    node: DataNode,
    titled: Boolean = false,
    topics: List<FeedTopic> = emptyList(),
    onOpenTopics: (() -> Unit)? = null,
    borrowedHandle: String? = null,
) {
    var helpOpen by remember { mutableStateOf(false) }
    val words = viewWords(borrowedHandle)
    CograSheetHost(onDismissRequest = onDismiss) {
        // The registered sheet wraps the surface and its corner "?" both, so the
        // "?" stands inside the sheet's box as the board draws it.
        Box(Modifier.dataNode(node)) {
            CograSheetSurface(
                modifier = Modifier.height(sheetHeight()),
                handleTestTag = (node / "dragHandle").tag,
                edgeToEdge = true,
                gap = 0.dp,
            ) {
                if (titled) TitledLead(node, onHelp = { helpOpen = true })
                // THE FOOT IS PINNED AND THE SECTIONS SCROLL (SettingsReading.md):
                // the last section keeps its own gap above the hairline.
                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = Space.x4),
                ) {
                    Sections(staged, onStage, node, words, topics.takeUnless { titled }.orEmpty(), onOpenTopics)
                }
                FilterFoot(
                    resetLabel = stringResource(R.string.feedfilter_reset),
                    doneLabel = stringResource(R.string.feedfilter_done),
                    onReset = onReset,
                    onDone = onDone,
                    node = node / "foot",
                )
            }
            if (!titled) {
                // THE "?" RIDES THE SHEET'S CORNER (FeedFilter.jsx: absolute at
                // `--space-1` / `--space-2`): the dialog is the box it measures from.
                HelpDot(
                    onHelp = { helpOpen = true },
                    contentDescription = stringResource(R.string.feedfilter_help),
                    modifier = Modifier.align(Alignment.TopEnd).padding(top = Space.x1, end = Space.x2),
                    testTag = (node / "help").tag,
                )
            }
        }
    }
    if (helpOpen) {
        HelpDialog(
            title = HelpTopic.TheFeedFilter.title,
            paragraphs = HelpTopic.TheFeedFilter.paragraphs,
            onClose = { helpOpen = false },
            testTag = "${node.path}_help_dialog",
        )
    }
}

/**
 * TRUE 88% OF THE SCREEN (FeedSheet.md:3; design round 25: a sheet's height
 * class is its whole height — `BottomSheet` is border-box, its padding inside
 * the 88%). This surface's padding sits inside its height too, so the share is
 * the whole sheet; the sheet ceiling still caps it (readme §13).
 */
@Composable
private fun sheetHeight(): Dp {
    val window = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.height.toDp() }
    return (window * SHEET_SHARE).coerceAtMost(sheetCeilingHeight())
}

/** The settings host's lead: the title with its "?" on its row, then the note, focus on the title. */
@Composable
private fun TitledLead(node: DataNode, onHelp: () -> Unit) {
    val title = remember { FocusRequester() }
    // WHEN the sheet opens -> focus moves to its title (SettingsReading.md:11).
    LaunchedEffect(Unit) { title.requestFocus() }
    SheetTitle(
        text = stringResource(R.string.feedfilter_purpose),
        modifier = Modifier
            .dataNode(node / "title")
            .focusRequester(title)
            .focusable()
            .padding(start = Space.x6, end = Space.x6, bottom = Space.x2),
        trailing = {
            HelpDot(
                onHelp = onHelp,
                contentDescription = stringResource(R.string.feedfilter_help),
                testTag = (node / "title" / "help").tag,
            )
        },
    )
    QuietNote(
        text = stringResource(R.string.feedfilter_note),
        modifier = Modifier
            .padding(start = Space.x6, end = Space.x6, bottom = Space.x4)
            .fillMaxWidth()
            .dataNode(node / "note"),
    )
}

@Composable
private fun Sections(
    staged: FeedFilter,
    onStage: (FeedFilter) -> Unit,
    node: DataNode,
    words: ViewWords,
    topics: List<FeedTopic>,
    onOpenTopics: (() -> Unit)?,
) {
    val kinds = node / "kinds"
    FilterSection(
        label = stringResource(R.string.feedfilter_kinds),
        hint = stringResource(R.string.feedfilter_kinds_hint),
        node = kinds,
    ) {
        FEED_KINDS.forEach { kind ->
            // The last kind chip never refuses (FeedSheet.md:75): nothing is
            // what a feed with every kind off shows, and it says so.
            CograChip(
                label = kind.label,
                selected = kind in staged.kinds,
                onClick = { onStage(staged.copy(kinds = staged.kinds.toggled(kind))) },
                testTag = (kinds / "${kind.chipValue()}Chip").tag,
            )
        }
    }
    // "Applies once posts or comments are in" (FeedFilter.jsx `postsish`).
    val postsish = FeedKind.POST in staged.kinds || FeedKind.COMMENT in staged.kinds
    val forms = node / "forms"
    FilterSection(
        label = stringResource(R.string.feedfilter_forms),
        hint = stringResource(if (postsish) R.string.feedfilter_forms_hint_on else R.string.feedfilter_forms_hint_off),
        node = forms,
    ) {
        FeedForm.entries.forEach { form ->
            CograChip(
                label = form.label,
                selected = form in staged.forms,
                onClick = { onStage(staged.copy(forms = staged.forms.toggled(form))) },
                testTag = (forms / "${form.chipValue()}Chip").tag,
                enabled = postsish,
            )
        }
    }
    OrderSection(staged, onStage, node / "order", words.orderHint)
    AlsoSection(staged, onStage, node / "also")
    // WHO THE FEED READS FROM (ruling 77; the sign row, item 7): with the
    // scope narrowers at the body's tail, the topic section staying last.
    val people = node / "people"
    FilterSection(
        label = stringResource(R.string.feedfilter_people),
        hint = stringResource(R.string.feedfilter_people_hint),
        node = people,
    ) {
        PeopleRows(staged, onStage, people, words)
    }
    // ONE TOPIC, LAST (FeedSheet.md:29-35, :53): only the topics held FOR, at
    // most one on — a second pick replaces the first, the held one's tap
    // clears it — and the door out to everything held under them.
    if (topics.isNotEmpty()) TopicSection(staged, onStage, node / "topic", words.topicHint, topics, onOpenTopics)
}

private fun <T> Set<T>.toggled(value: T): Set<T> = if (value in this) this - value else this + value

/** `OrderSection`: Ranked or Newest, and Show what you've already seen under it. */
@Composable
private fun OrderSection(staged: FeedFilter, onStage: (FeedFilter) -> Unit, node: DataNode, hint: String) {
    val label = stringResource(R.string.feedfilter_order)
    FilterSection(label = label, hint = hint, node = node) {
        SegmentedFilter(
            options = listOf(
                SegmentedOption(FeedOrder.RANKED, FeedOrder.RANKED.label, "rankedOption"),
                SegmentedOption(FeedOrder.NEWEST, FeedOrder.NEWEST.label, "newestOption"),
            ),
            selected = staged.order,
            onSelect = { onStage(staged.copy(order = it)) },
            ariaLabel = label,
            node = node / "picker",
        )
        val seen = node / "seen"
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x3),
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = Layout.TouchTargetMin)
                .toggleable(
                    value = staged.showSeen,
                    role = Role.Checkbox,
                    onValueChange = { onStage(staged.copy(showSeen = it)) },
                )
                .dataNode(seen),
        ) {
            Checkbox(checked = staged.showSeen, onCheckedChange = null, modifier = Modifier.dataNode(seen / "box"))
            Text(
                text = stringResource(R.string.feedfilter_seen),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.dataNode(seen / "label"),
            )
        }
    }
}

/** `Also show` (`FEED_ALSO`): Sensitive, Removed, and Still settling — the one on by default. */
@Composable
private fun AlsoSection(staged: FeedFilter, onStage: (FeedFilter) -> Unit, node: DataNode) {
    FilterSection(
        label = stringResource(R.string.feedfilter_also),
        hint = stringResource(R.string.feedfilter_also_hint),
        node = node,
    ) {
        CograChip(
            label = stringResource(R.string.feedfilter_also_sensitive),
            selected = staged.showSensitive,
            onClick = { onStage(staged.copy(showSensitive = !staged.showSensitive)) },
            testTag = (node / "sensitiveChip").tag,
        )
        CograChip(
            label = stringResource(R.string.feedfilter_also_removed),
            selected = staged.showRemoved,
            onClick = { onStage(staged.copy(showRemoved = !staged.showRemoved)) },
            testTag = (node / "removedChip").tag,
        )
        CograChip(
            label = stringResource(R.string.feedfilter_also_settling),
            selected = staged.stillSettling,
            onClick = { onStage(staged.copy(stillSettling = !staged.stillSettling)) },
            testTag = (node / "settlingChip").tag,
        )
    }
}

/**
 * THE PEOPLE SECTION'S BODY (`FeedPeopleRows`): Everyone and Your people as
 * ROWS — the license sheets' radio-row anatomy, never a segmented pill — and,
 * under Your people while it is on, the sign as ONE LINE OF THREE WORDS,
 * `For · Against · Either`, the chosen word in primary ink and at the label's
 * weight, so the choice never rests on colour alone (WCAG 1.4.1). Choosing
 * Everyone hides the sign row and keeps its word (FeedSheet.md:27).
 *
 * The rows and the sign row are keyed by the state the section draws
 * (`everyone`, `your-people`) — the registry keys these paths by the board's
 * `people` chip, one drawing per value (nodes.json SettingsReading `keys`);
 * their parts take the key from the row they sit in.
 */
@Composable
private fun PeopleRows(staged: FeedFilter, onStage: (FeedFilter) -> Unit, node: DataNode, words: ViewWords) {
    val state = if (staged.people == PeopleScope.EVERYONE) "everyone" else "your-people"
    // ONE BLOCK, AS THE BOARD DRAWS IT (`_shared.jsx` PeopleCopies wraps the
    // rows and the sign row in one box): the sign row stands 6 under the rows.
    Column(Modifier.fillMaxWidth()) {
        val people = stringResource(R.string.feedfilter_people)
        Column(
            modifier = Modifier.selectableGroup().semantics { contentDescription = people },
            verticalArrangement = Arrangement.spacedBy(ROWS_GAP),
        ) {
            PeopleRow(
                label = stringResource(R.string.feedfilter_everyone),
                hint = words.everyoneHint,
                chosen = staged.people == PeopleScope.EVERYONE,
                onChoose = { onStage(staged.copy(people = PeopleScope.EVERYONE)) },
                node = (node / "everyone").keyed(state),
                parts = node / "everyone",
            )
            PeopleRow(
                label = words.yourPeople,
                hint = words.yourPeopleHint,
                chosen = staged.people == PeopleScope.YOUR_PEOPLE,
                onChoose = { onStage(staged.copy(people = PeopleScope.YOUR_PEOPLE)) },
                node = (node / "yourPeople").keyed(state),
                parts = node / "yourPeople",
            )
        }
        if (staged.people == PeopleScope.YOUR_PEOPLE) {
            SignRow(
                sign = staged.peopleSign,
                onSign = { onStage(staged.copy(peopleSign = it)) },
                name = words.signName,
                node = (node / "sign").keyed(state),
                parts = node / "sign",
            )
        }
    }
}

@Composable
private fun PeopleRow(
    label: String,
    hint: String,
    chosen: Boolean,
    onChoose: () -> Unit,
    node: DataNode,
    parts: DataNode,
) {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = chosen, role = Role.RadioButton, onClick = onChoose)
            .dataNode(node),
        horizontalArrangement = Arrangement.spacedBy(DOT_GAP),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier
                .padding(top = 1.dp)
                .size(DOT)
                .border(
                    width = if (chosen) DOT_CHOSEN_RING else 1.dp,
                    color = if (chosen) colors.primary else colors.outline,
                    shape = CircleShape,
                )
                .dataNode(parts / "dot"),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.onSurface,
                modifier = Modifier.fillMaxWidth().dataNode(parts / "label"),
            )
            Text(
                text = hint,
                style = MaterialTheme.typography.bodySmall,
                color = colors.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth().dataNode(parts / "hint"),
            )
        }
    }
}

/**
 * The sign row (FeedSheet.md:19-25): aligned with the rows' words, past the
 * dot's column, and 6 under the row above; each word's 48 target grows
 * invisibly up and down without reaching the rows (ruling 92). Its spoken
 * name is `Which of your people` (`Which of @mira's people` on a borrowed view).
 */
@Composable
private fun SignRow(sign: PeopleSign, onSign: (PeopleSign) -> Unit, name: String, node: DataNode, parts: DataNode) {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .padding(start = SIGN_INDENT, top = ROWS_GAP)
            .selectableGroup()
            .semantics { contentDescription = name }
            .dataNode(node),
        horizontalArrangement = Arrangement.spacedBy(ROWS_GAP),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PeopleSign.entries.forEachIndexed { index, option ->
            if (index > 0) {
                Text("·", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
            }
            val chosen = option == sign
            Text(
                text = option.label,
                style = MaterialTheme.typography.bodyMedium.copy(
                    // The chosen word sits at the label's weight (FeedFilter.jsx: 500).
                    fontWeight = if (chosen) FontWeight.Medium else FontWeight.Normal,
                ),
                color = if (chosen) colors.primary else colors.onSurfaceVariant,
                modifier = Modifier
                    .hitTarget(
                        interactive = Modifier.selectable(
                            selected = chosen,
                            role = Role.RadioButton,
                            onClick = { onSign(option) },
                        ),
                        drawnHeight = SIGN_LINE,
                    )
                    .dataNode(parts / option.name.lowercase()),
            )
        }
    }
}

@Composable
private fun TopicSection(
    staged: FeedFilter,
    onStage: (FeedFilter) -> Unit,
    node: DataNode,
    hint: String,
    topics: List<FeedTopic>,
    onOpenTopics: (() -> Unit)?,
) {
    FilterSection(label = stringResource(R.string.feedfilter_topic), hint = hint, node = node) {
        topics.forEach { topic ->
            val on = staged.topic?.id == topic.id
            CograChip(
                label = "#${topic.name}",
                selected = on,
                onClick = { onStage(staged.copy(topic = if (on) null else topic)) },
                testTag = (node / "tag").keyed(topic.name).tag,
            )
        }
        Box(Modifier.fillMaxWidth()) {
            // `All your topics` opens the reader's own Your topics — everything
            // held, the topics held against included (FeedSheet.md).
            CograButton(
                text = stringResource(R.string.feedfilter_all_topics),
                onClick = onOpenTopics ?: {},
                kind = ButtonKind.Text,
                size = ButtonSize.Compact,
                testTag = (node / "allTopics").tag,
            )
        }
    }
}
