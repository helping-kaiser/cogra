// THE INTRO — five full-screen cards (OnboardingSteps, OnboardingShape,
// OnboardingPublic, OnboardingLayers, OnboardingVouch; their sidecars in
// design/designs/canonical/behavior/). The frame is `_shared.jsx`'s
// `IntroFrame`: Skip · illustration · words · dots · the card's button.
//
// THE BUTTONS ARE THE MOVEMENT (each sidecar: "a swipe moves nothing"):
// there is no pager. Next opens the next card, Skip leaves from any card,
// and the last card's button reads `Start reading` and leaves where Skip
// leaves. The dots are an indicator, never a control, spoken `Step n of 5`.
// Android Back walks the cards back, and on the first card leaves the way
// Skip does (OnboardingSteps.md:25).
//
// AT ANY WIDTH AND TEXT SIZE (each sidecar's last line): the stage scales to
// the column as one picture, keeping its proportions, and everything between
// Skip and the button scrolls when the words outgrow the screen — Skip and
// the button stay pinned at their edges.

package com.cogra.feature.onboarding.intro

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.domain.ActorRef
import com.cogra.feature.onboarding.R

/**
 * The registered prefix (nodes.json `OnboardingVouch`, `onboarding`). The
 * frame is one frame on all five cards, so every card wears its names.
 */
internal val IntroNode = DataNode("onboarding")

/**
 * The intro, wired. [onLeave] is the one way out — Skip, `Start reading`,
 * and Back on the first card all take it — and the host pops back to what
 * the intro opened over: the feed, or Settings on a re-watch.
 */
@Composable
fun IntroRoute(onLeave: () -> Unit, viewModel: IntroViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BackHandler {
        if (!viewModel.back()) onLeave()
    }
    IntroScreen(
        state = state,
        onSkip = onLeave,
        onNext = { if (state.isLast) onLeave() else viewModel.next() },
    )
}

@Composable
fun IntroScreen(state: IntroUiState, onSkip: () -> Unit, onNext: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .dataNodeSurface(),
    ) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp, end = 12.dp), horizontalArrangement = Arrangement.End) {
            CograButton(
                text = stringResource(R.string.intro_skip),
                onClick = onSkip,
                kind = ButtonKind.Text,
                testTag = (IntroNode / "skip").tag,
            )
        }
        // Between Skip and the button, the stage and the words scroll. The
        // inner column is at least the viewport tall, so with room to spare
        // the stage sits centred in what the words leave, as drawn.
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val viewport = maxHeight
            Column(
                Modifier
                    .verticalScroll(rememberScrollState())
                    .heightIn(min = viewport)
                    .fillMaxWidth(),
            ) {
                Spacer(Modifier.weight(1f))
                Box(Modifier.fillMaxWidth().padding(horizontal = 24.dp), contentAlignment = Alignment.Center) {
                    IntroStage(card = state.card, inviter = state.inviter)
                }
                Spacer(Modifier.weight(1f))
                IntroWords(state.card, state.inviter)
                IntroDots(step = state.step)
            }
        }
        CograButton(
            text = stringResource(if (state.isLast) R.string.intro_start_reading else R.string.intro_next),
            onClick = onNext,
            modifier = Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
            testTag = (IntroNode / "next").tag,
        )
    }
}

@Composable
private fun IntroWords(card: IntroCard, inviter: ActorRef?) {
    val (title, body) = when (card) {
        IntroCard.Steps -> R.string.intro_steps_title to stringResource(R.string.intro_steps_body)
        IntroCard.Shape -> R.string.intro_shape_title to stringResource(R.string.intro_shape_body)
        IntroCard.Public -> R.string.intro_public_title to stringResource(R.string.intro_public_body)
        IntroCard.Layers -> R.string.intro_layers_title to stringResource(R.string.intro_layers_body)
        // The line names the reader's own inviter; with none on the account
        // there is no one for it to name, and the line stands down (as
        // built: the board draws only the named reading).
        IntroCard.Vouch -> R.string.intro_vouch_title to inviter?.let {
            stringResource(R.string.intro_vouch_body, it.handle)
        }
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
        Text(
            text = stringResource(title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.semantics { heading() }.dataNode(IntroNode / "title"),
        )
        if (body != null) {
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp).dataNode(IntroNode / "body"),
            )
        }
    }
}

/** The pager's dots: an indicator, never a control, spoken `Step n of 5`. */
@Composable
private fun IntroDots(step: Int) {
    val spoken = stringResource(R.string.intro_step, step, INTRO_STEPS)
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 20.dp, bottom = 16.dp)
            // The tag rides before the clear: a clear wipes what follows it.
            .dataNode(IntroNode / "dots")
            .clearAndSetSemantics { contentDescription = spoken },
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(INTRO_STEPS) { index ->
            val ink = if (index + 1 == step) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline
            Box(Modifier.size(6.dp).background(ink, CircleShape))
        }
    }
}
