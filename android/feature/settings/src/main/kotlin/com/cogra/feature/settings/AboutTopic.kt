// About CoGra (`About.jsx`, `About.md`): nine topics folded into rows, all
// closed on open, each opening and folding on its own. The answers are the
// board's words, transcribed rather than rephrased — the copy is the
// design (the same rule `HelpTopic` keeps).

package com.cogra.feature.settings

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.Hairline
import com.cogra.core.designsystem.v2.atom.PageHeader

/** One topic: its title and the paragraphs behind it. */
data class AboutTopic(val title: String, val answer: List<String>) {
    /** The registered key: the title lowercased, each run of other characters one `-`. */
    val key: String get() = title.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
}

/** `About.jsx`'s nine topics, verbatim. */
val AboutTopics = listOf(
    AboutTopic(
        "What this is",
        listOf(
            "CoGra is a place to read and write in public, where what reaches you is decided by the people and " +
                "the things you have pointed at — never by a system guessing what will keep you here.",
        ),
    ),
    AboutTopic(
        "Your feed is your own steps",
        listOf(
            "Posts arrive along the connections you made, one step at a time. Nothing is put in front of you " +
                "because it performs well, and there is no feed you did not shape.",
            "You can change what a feed shows whenever you like, and you can open any post's score to see " +
                "exactly which steps carried it to you.",
        ),
    ),
    AboutTopic(
        "Everything here is public",
        listOf(
            "Posts, comments, opinions, tags, citations — and chats, once they arrive. Anything written on CoGra " +
                "can be read, quoted and cited by anyone.",
            "There is no private side to this. If something is not meant to be read by strangers, it is not " +
                "meant for here.",
        ),
    ),
    AboutTopic(
        "An opinion says two things",
        listOf(
            "Every opinion you give carries two: how far you are for or against the thing, and how much of it " +
                "you want reaching you. The pad is where you place both at once.",
            "The face beside an opinion is a short reading of that pair, not a separate rating. You can turn " +
                "the exact numbers on in settings.",
        ),
    ),
    AboutTopic(
        "Nothing is lost",
        listOf(
            "Posts and comments are built in layers, and a layer is never taken away. An edit adds to the " +
                "record instead of replacing it, so what you are reading carries its own history.",
            "When something does have to go — the law, or the author's own choice — the words are removed and " +
                "a mark stays where they were. Nothing disappears quietly.",
        ),
    ),
    AboutTopic(
        "Money follows the reach you made",
        listOf(
            "Reading and writing here can earn, and what you earn is yours.",
            "Advertising is pull, not push: a campaign offers to pay for reach, and where that money lands is " +
                "decided the same way a feed is — by the graph, not by the bid. Nobody buys their way into " +
                "what you see.",
            "Every figure opens onto what produced it, down to the record that paid it.",
        ),
    ),
    AboutTopic(
        "Getting in, and being let in",
        listOf(
            "CoGra is invite-only. Somebody already here vouches for you, and until they have, you are an " +
                "applicant: you can read everything, write one post, give one opinion and say how you feel " +
                "about one topic.",
            "These wait with your application and arrive with you. Until then only you can see them, and they " +
                "are signed together with the vouch that lets you in. If your application is closed, your " +
                "account stays — anyone can still vouch you in.",
            "That is not a waiting period for its own sake. The first link to you is a real one, given by a " +
                "person who stands behind it — which is the thing that keeps this place small enough to be " +
                "honest.",
        ),
    ),
    AboutTopic(
        "Your key is yours",
        listOf(
            "Everything you publish is signed by a key only you hold. We cannot sign for you, and we cannot " +
                "recover it for you — your recovery code is the only way back.",
        ),
    ),
    AboutTopic(
        "This page grows",
        listOf(
            "CoGra is being built, and this page describes the product rather than the build. Some of what is " +
                "written here is already in your hands; some of it is on its way.",
        ),
    ),
)

private val Page = DataNode("about")

/** The open topics' keys, kept across configuration changes as a plain list. */
private val OpenTopicsSaver = listSaver<SnapshotStateList<String>, String>(
    save = { open -> open.toList() },
    restore = { saved -> saved.toMutableStateList() },
)

/**
 * The pinned header reads `Back to settings` from Settings (the only door
 * Android has: the join form's "?" is not built here), and the page
 * carries no "?" and no bottom bar.
 */
@Composable
fun AboutScreen(onBack: () -> Unit) {
    val open = rememberSaveable(saver = OpenTopicsSaver) { mutableStateListOf<String>() }
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = {
            PageHeader(
                title = stringResource(R.string.about_title),
                onBack = onBack,
                backContentDescription = stringResource(R.string.back_to_settings),
                node = Page / "header",
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 32.dp),
        ) {
            AboutTopics.forEach { topic ->
                val isOpen = topic.key in open
                Topic(topic, isOpen) { if (isOpen) open.remove(topic.key) else open.add(topic.key) }
            }
        }
    }
}

/** The WHOLE row is the control — title and chevron together — and says whether it is open. */
@Composable
private fun Topic(topic: AboutTopic, open: Boolean, onToggle: () -> Unit) {
    val node = (Page / "topic").keyed(topic.key)
    val turn by animateFloatAsState(if (open) 180f else 0f, label = "aboutChevron")
    Column(Modifier.fillMaxWidth().dataNode(node)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 48.dp)
                .clickable(role = Role.Button, onClick = onToggle)
                .foldSemantics(open, onToggle)
                .dataNode(Page / "topic" / "row")
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = topic.title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .weight(1f)
                    .dataNode(Page / "topic" / "row" / "title"),
            )
            Icon(
                imageVector = Icons.Filled.ExpandMore,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .size(20.dp)
                    .rotate(turn)
                    .dataNode(Page / "topic" / "row" / "chevron"),
            )
        }
        if (open) TopicAnswer(topic.answer)
        Hairline()
    }
}

/**
 * A heading row whose open state is announced through the documented
 * expand/collapse actions (TalkBack reads "expanded" / "collapsed").
 */
private fun Modifier.foldSemantics(open: Boolean, onToggle: () -> Unit): Modifier = semantics {
    heading()
    val toggle = {
        onToggle()
        true
    }
    if (open) collapse(action = toggle) else expand(action = toggle)
}

/** The open words, in the quiet ink, 8dp apart. */
@Composable
private fun TopicAnswer(answer: List<String>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp)
            .dataNode(Page / "topic" / "answer"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        answer.forEach { line ->
            Text(
                text = line,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
