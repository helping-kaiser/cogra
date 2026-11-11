// JOIN (design/designs/canonical/screens/Join.jsx, JoinErrors.jsx;
// behavior/Join.md, JoinErrors.md): the application form under its
// inviter's face, reached once the invite link checks out.

package com.cogra.feature.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.CograPasswordField
import com.cogra.core.designsystem.v2.atom.CograRowButton
import com.cogra.core.designsystem.v2.atom.CograTextField
import com.cogra.core.designsystem.v2.atom.HelpDot
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.WaitingCommit
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.domain.InviterView

/** Join's registered prefix (`nodes.json` `join`, round 28). */
val JOIN = DataNode("join")

@Composable
fun JoinRoute(
    inviteId: String,
    inviter: InviterView,
    onBack: () -> Unit,
    onAbout: () -> Unit,
    onSignIn: () -> Unit,
    /** The registration found the link spent: the door's unusable reading takes over. */
    onSpent: () -> Unit,
    /** The account is made: the applicant days begin. */
    onCreated: () -> Unit,
    viewModel: JoinViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.spent) { if (state.spent) onSpent() }
    LaunchedEffect(state.created) { if (state.created) onCreated() }
    // Join.md:47 — the arrow, the "?" and Sign in refuse a press while
    // Create account waits on its answer, and none of them dims.
    val unlessWaiting: (() -> Unit) -> () -> Unit = { action -> { if (!state.inFlight) action() } }
    JoinScreen(
        state = state,
        inviter = inviter,
        onHandleChange = viewModel::onHandleChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onSubmit = { viewModel.onSubmit(inviteId) },
        onBack = unlessWaiting(onBack),
        onAbout = unlessWaiting(onAbout),
        onSignIn = unlessWaiting {
            viewModel.onLeave()
            onSignIn()
        },
    )
}

@Composable
fun JoinScreen(
    state: JoinUiState,
    inviter: InviterView,
    onHandleChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit = {},
    onAbout: () -> Unit = {},
    onSignIn: () -> Unit = {},
) {
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = {
            PageHeader(
                onBack = onBack,
                // Join.md:19 — the screen's one explanation, named for where it goes.
                action = {
                    HelpDot(
                        onHelp = onAbout,
                        contentDescription = stringResource(R.string.join_help),
                        testTag = (JOIN / "header" / "help").tag,
                    )
                },
                node = JOIN / "header",
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 32.dp),
        ) {
            Inviter(inviter)
            Spacer(Modifier.height(32.dp))
            Fields(state, onHandleChange, onEmailChange, onPasswordChange, onSubmit)
            Spacer(Modifier.height(24.dp))
            Actions(state, onSubmit, onSignIn)
        }
    }
}

/** The commit stack: the fault, the accept sentence, Create account, Sign in, the notice. */
@Composable
private fun Actions(state: JoinUiState, onSubmit: () -> Unit, onSignIn: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        state.fault?.let { fault ->
            Text(
                text = stringResource(fault.text()),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .dataNode(JOIN / "fault"),
            )
        }
        // THE TERMS ARE ACCEPTED BY THE PRESS (Join.md:79-81): the line
        // stands directly above Create account, and no checkbox stands
        // anywhere on the form.
        LegalLine(
            sentence = stringResource(R.string.join_terms),
            door = stringResource(R.string.join_terms_door),
            node = JOIN / "terms",
        )
        WaitingCommit(
            label = stringResource(R.string.join_create),
            reason = stringResource(R.string.join_waiting),
            waiting = state.waiting,
            onCommit = onSubmit,
            inFlight = state.inFlight,
            inFlightLabel = stringResource(R.string.join_creating),
            node = JOIN / "commit",
        )
        // The board's text button keeps its drawn 40dp in the layout and
        // answers at 48 (`cg-hit`), which the row button does; Material's
        // own button would grow the stack by its touch target instead.
        CograRowButton(
            text = stringResource(R.string.entry_sign_in),
            onClick = onSignIn,
            kind = ButtonKind.Text,
            modifier = Modifier.fillMaxWidth(),
            testTag = (JOIN / "signIn").tag,
        )
        // The Privacy Policy is a notice, never part of the acceptance
        // (Join.md:83): its own line at the form's foot.
        LegalLine(
            sentence = stringResource(R.string.join_privacy),
            door = stringResource(R.string.join_privacy_door),
            node = JOIN / "privacy",
        )
    }
}

/**
 * The face and the name over the form are the link's inviter's (Join.md:9):
 * their picture, or the monogram where there is none, and the heading naming
 * them by their written name, else their handle. The line under it keeps the
 * handle — `@mira's approval brings you in`, as the board writes it.
 */
@Composable
private fun Inviter(inviter: InviterView) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CograAvatar(name = inviter.name, size = 64.dp, url = inviter.avatarUrl, testTag = (JOIN / "avatar").tag)
        Text(
            text = stringResource(R.string.join_heading, inviter.name),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(top = 16.dp)
                .semantics { heading() }
                .dataNode(JOIN / "title"),
        )
        Text(
            text = stringResource(R.string.join_lead, inviter.handle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .padding(top = 8.dp)
                .dataNode(JOIN / "body"),
        )
    }
}

@Composable
private fun Fields(
    state: JoinUiState,
    onHandleChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // The `handle` kind: an ASCII keyboard, no caps or correction, and
        // no autofill on Android (TextField.prompt.md's kinds table).
        CograTextField(
            value = state.handle,
            onValueChange = onHandleChange,
            label = stringResource(R.string.join_handle),
            hint = stringResource(R.string.join_handle_hint),
            error = state.handleLine?.let { stringResource(it.text()) },
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Ascii,
                imeAction = ImeAction.Next,
            ),
            node = JOIN / "handle",
        )
        // The `email` kind on a credential form: the email keyboard, and the
        // address is the account's username to autofill.
        CograTextField(
            value = state.email,
            onValueChange = onEmailChange,
            label = stringResource(R.string.join_email),
            error = state.emailLine?.let { stringResource(it.text()) },
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
            contentType = ContentType.Username,
            node = JOIN / "email",
        )
        CograPasswordField(
            value = state.password,
            onValueChange = onPasswordChange,
            label = stringResource(R.string.join_password),
            newPassword = true,
            hint = stringResource(R.string.join_password_hint),
            error = state.passwordLine?.let { stringResource(it.text()) },
            onImeAction = { if (!state.waiting) onSubmit() },
            node = JOIN / "password",
        )
    }
}

/**
 * One of the registration's two legal lines, its [door] a link inside the
 * sentence (the board's `<a>`: `primary`, underlined).
 *
 * THE DOORS OPEN NOTHING YET. The Terms and the Privacy Policy are a launch
 * task — the documents are not written — so the link is drawn and named as
 * the board draws it but answers no tap, as the web's inert doors do.
 * Join.md:85-87 also asks that the form keep every field as it was left on
 * the way back from those pages, which is untestable until the pages exist.
 */
@Composable
private fun LegalLine(sentence: String, door: String, node: DataNode) {
    val doorStyle = TextLinkStyles(
        style = SpanStyle(color = MaterialTheme.colorScheme.primary, textDecoration = TextDecoration.Underline),
    )
    val start = sentence.indexOf(door)
    val text = buildAnnotatedString {
        if (start < 0) {
            append(sentence)
        } else {
            append(sentence.substring(0, start))
            withLink(LinkAnnotation.Clickable(tag = door, styles = doorStyle) {}) { append(door) }
            append(sentence.substring(start + door.length))
        }
    }
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(node.tag),
    )
}

private fun JoinLine.text(): Int = when (this) {
    JoinLine.HANDLE_SHAPE -> R.string.join_handle_shape
    JoinLine.HANDLE_TAKEN -> R.string.join_handle_taken
    JoinLine.EMAIL_SHAPE -> R.string.join_email_shape
    JoinLine.EMAIL_IN_USE -> R.string.join_email_in_use
    JoinLine.PASSWORD_SHORT -> R.string.join_password_short
    JoinLine.PASSWORD_LONG -> R.string.join_password_long
    JoinLine.PASSWORD_BREACHED -> R.string.join_password_breached
}

private fun JoinFault.text(): Int = when (this) {
    JoinFault.NO_ANSWER -> R.string.entry_no_answer
    JoinFault.NOT_THROUGH -> R.string.entry_not_through
    JoinFault.RATE_LIMITED -> R.string.entry_rate_limited
}
