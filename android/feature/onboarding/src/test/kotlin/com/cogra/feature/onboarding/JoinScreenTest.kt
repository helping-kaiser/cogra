package com.cogra.feature.onboarding

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import com.cogra.domain.AuthTokens
import com.cogra.domain.InviterView
import com.cogra.domain.Outcome
import com.cogra.domain.identity.Register
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingOnboardingRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

/** A registration that answers only when the test lets it. */
private class HeldOnboarding : ThrowingOnboardingRepository() {
    val answer = CompletableDeferred<Outcome<AuthTokens>>()

    override suspend fun register(
        inviteLink: String,
        handle: String,
        email: String,
        password: String,
        deviceLabel: String?,
    ): Outcome<AuthTokens> = answer.await()
}

/**
 * Join.md and JoinErrors.md, line by line, against the drawn screen. Tags
 * are the boards' evident `join.*` paths (Join is not registered in
 * `nodes.json`). Assertions bind to nodes and their order, never to text
 * widths (Robolectric measures text near zero).
 */
@RunWith(RobolectricTestRunner::class)
class JoinScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val mira = InviterView(handle = "mira", name = "Mira Voss")

    private val filled = JoinUiState(
        handle = "noor",
        email = "noor@fieldmail.org",
        password = "fielddayfield",
        confirm = "fielddayfield",
    )

    private fun show(
        state: JoinUiState = JoinUiState(),
        onSubmit: () -> Unit = {},
        onBack: () -> Unit = {},
        onAbout: () -> Unit = {},
        onSignIn: () -> Unit = {},
    ) {
        compose.setContent {
            JoinScreen(
                state = state,
                inviter = mira,
                onHandleChange = {},
                onEmailChange = {},
                onPasswordChange = {},
                onSubmit = onSubmit,
                onBack = onBack,
                onAbout = onAbout,
                onSignIn = onSignIn,
            )
        }
    }

    private fun tag(path: String) = compose.onNodeWithTag(path, useUnmergedTree = true)

    // The page outgrows Robolectric's default screen: scroll a control into view before
    // pressing it, or the touch lands outside the window and nothing answers.
    private fun press(path: String) = compose.onNodeWithTag(path).performScrollTo().performClick()

    private fun top(path: String): Float = tag(path).fetchSemanticsNode().positionInRoot.y

    private fun text(path: String): String {
        val runs = tag(path).fetchSemanticsNode().config.getOrNull(SemanticsProperties.Text)
        return runs?.joinToString("") { it.text }.orEmpty()
    }

    // Join.md:9 — ALWAYS the face and the name over the form are the link's inviter's.
    @Test
    fun theFaceAndTheNameOverTheFormAreTheInvitersOwn() {
        show()
        tag("join.avatar").assertExists()
        tag("join.title").assertTextEquals("Mira Voss invited you")
        tag("join.body").assertTextEquals(
            "CoGra is invite-only — a member vouches for you, and @mira's approval brings you in.",
        )
        assertThat(top("join.avatar")).isLessThan(top("join.title"))
        assertThat(top("join.title")).isLessThan(top("join.handle"))
    }

    // Join.md:9 — an inviter with no written name is named by their handle.
    @Test
    fun anInviterWithNoWrittenNameIsNamedByTheirHandle() {
        compose.setContent { JoinScreen(JoinUiState(), InviterView(handle = "mira"), {}, {}, {}, {}) }
        tag("join.title").assertTextEquals("mira invited you")
    }

    // Join.md:11 — ALWAYS the header's arrow reads a plain Back, with no origin noun.
    @Test
    fun theHeadersArrowReadsAPlainBack() {
        var back = 0
        show(onBack = { back++ })
        compose.onNode(hasContentDescription("Back") and SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick))
            .assertExists()
        compose.onNodeWithTag("join.header.back").performClick()
        assertThat(back).isEqualTo(1)
    }

    // Join.md:19-21 — the header's "?" is the screen's one explanation, named
    // About CoGra; a tap opens About.
    @Test
    fun theHeadersQuestionMarkIsNamedAboutCograAndOpensIt() {
        var about = 0
        show(onAbout = { about++ })
        compose.onNode(hasContentDescription("About CoGra")).assertExists()
        compose.onNodeWithTag("join.header.help").performClick()
        assertThat(about).isEqualTo(1)
    }

    // Join.md:31, 33 — the hints, GIVEN the field carries no error line.
    @Test
    fun theHandleAndPasswordFieldsCarryTheirHints() {
        show()
        tag("join.handle.support").assertTextEquals("3–30 characters: a–z, 0–9, _")
        tag("join.password.support").assertTextEquals("At least 12 characters.")
        tag("join.email.support").assertDoesNotExist()
    }

    // Join.md:35-37 — the reveal control shows and hides, named for what it does next.
    @Test
    fun theRevealControlIsNamedForWhatItDoes() {
        show(filled)
        reveal("join.password", "Show password").assertExists()
        press("join.password.reveal")
        reveal("join.password", "Hide password").assertExists()
        press("join.password.reveal")
        reveal("join.password", "Show password").assertExists()
    }

    // Join.md:41-45 — a second press is refused, the commit never dims, reads
    // Creating account… past 200ms, and still at 5s, with no spinner or slow line.
    @Test
    fun createAccountWaitsWithoutDimmingASpinnerOrASlowLine() {
        var presses = 0
        compose.mainClock.autoAdvance = false
        show(filled.copy(inFlight = true), onSubmit = { presses++ })
        compose.mainClock.advanceTimeBy(100)
        tag("join.commit.action").assertIsEnabled()
        compose.onNode(hasText("Create account"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(150)
        compose.onNode(hasText("Creating account…"), useUnmergedTree = true).assertExists()
        compose.mainClock.advanceTimeBy(5_000)
        compose.onNode(hasText("Creating account…"), useUnmergedTree = true).assertExists()
        // The press scrolls the commit into view, an animation the paused clock would never finish.
        compose.mainClock.autoAdvance = true
        compose.onNodeWithTag("join.commit.action").assertIsEnabled().performScrollTo().performClick()
        assertThat(presses).isEqualTo(0)
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate))
            .assertDoesNotExist()
        tag("join.fault").assertDoesNotExist()
    }

    // Join.md:47 — the arrow, the "?" and Sign in refuse a press, never dimmed,
    // while Create account waits on its answer.
    @Test
    fun theWaysOutRefuseAPressWhileTheRegistrationWaits() {
        val held = HeldOnboarding()
        val vm = JoinViewModel(Register(held, FakeTokenStore()), JoinDraft())
        var left = 0
        compose.setContent {
            JoinRoute(
                inviteId = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1",
                inviter = mira,
                onBack = { left++ },
                onAbout = { left++ },
                onSignIn = { left++ },
                onSpent = {},
                onCreated = {},
                viewModel = vm,
            )
        }
        vm.onHandleChange("noor")
        vm.onEmailChange("noor@fieldmail.org")
        vm.onPasswordChange("fielddayfield")
        vm.onConfirmChange("fielddayfield")
        press("join.commit.action")
        compose.waitForIdle()
        assertThat(vm.state.value.inFlight).isTrue()
        for (path in listOf("join.header.back", "join.header.help")) {
            compose.onNodeWithTag(path).assertIsEnabled().performClick()
        }
        compose.onNodeWithTag("join.signInDoor").assertIsEnabled().performScrollTo().performClick()
        assertThat(left).isEqualTo(0)

        held.answer.complete(Outcome.Failed(IOException("offline")))
        compose.waitForIdle()
        press("join.signInDoor")
        assertThat(left).isEqualTo(1)
    }

    // Join.md:49 — WHEN the account is created -> the applicant days begin.
    @Test
    fun aMadeAccountHandsOnToTheApplicantDays() {
        val held = HeldOnboarding()
        val vm = JoinViewModel(Register(held, FakeTokenStore()), JoinDraft())
        var created = 0
        compose.setContent {
            JoinRoute(
                inviteId = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1",
                inviter = mira,
                onBack = {},
                onAbout = {},
                onSignIn = {},
                onSpent = {},
                onCreated = { created++ },
                viewModel = vm,
            )
        }
        vm.onHandleChange("noor")
        vm.onEmailChange("noor@fieldmail.org")
        vm.onPasswordChange("fielddayfield")
        vm.onConfirmChange("fielddayfield")
        press("join.commit.action")
        held.answer.complete(Outcome.Success(AuthTokens("a", "r", "u2")))
        compose.waitForIdle()
        assertThat(created).isEqualTo(1)
    }

    // Join.md:53-67, JoinErrors.md:5-7 — an errored field's line replaces its
    // hint; an unerrored field keeps its own.
    @Test
    fun anErroredFieldsLineReplacesItsHintAndTheOthersKeepTheirs() {
        show(
            filled.copy(
                answered = JoinLines(handle = JoinLine.HANDLE_TAKEN),
                local = JoinLines(password = JoinLine.PASSWORD_SHORT),
            ),
        )
        tag("join.handle.support").assertTextEquals("That handle is taken.")
        tag("join.password.support").assertTextEquals("A password is at least 12 characters.")
        tag("join.email.support").assertDoesNotExist()
        compose.onNode(hasText("3–30 characters: a–z, 0–9, _"), useUnmergedTree = true).assertDoesNotExist()
    }

    // Join.md:53-65 — each line reads its copy-voice words.
    @Test
    fun eachLineReadsItsOwnWords() {
        val words = mapOf(
            JoinLine.HANDLE_SHAPE to "A handle is 3–30 characters: a–z, 0–9, _.",
            JoinLine.HANDLE_TAKEN to "That handle is taken.",
            JoinLine.EMAIL_SHAPE to "That doesn't look like an email address.",
            JoinLine.EMAIL_IN_USE to "That email already has an account.",
            JoinLine.PASSWORD_SHORT to "A password is at least 12 characters.",
            JoinLine.PASSWORD_LONG to "A password is at most 128 characters.",
            JoinLine.PASSWORD_BREACHED to "That password has turned up in a data breach — pick another one.",
            JoinLine.PASSWORDS_DIFFER to "The two passwords don't match.",
        )
        var state by mutableStateOf(filled)
        compose.setContent {
            JoinScreen(state, mira, {}, {}, {}, {})
        }
        for ((line, expected) in words) {
            state = when (line) {
                JoinLine.HANDLE_SHAPE, JoinLine.HANDLE_TAKEN -> filled.copy(answered = JoinLines(handle = line))
                JoinLine.EMAIL_SHAPE, JoinLine.EMAIL_IN_USE -> filled.copy(answered = JoinLines(email = line))
                JoinLine.PASSWORDS_DIFFER -> filled.copy(local = JoinLines(confirm = line))
                else -> filled.copy(answered = JoinLines(password = line))
            }
            compose.waitForIdle()
            compose.onNode(hasText(expected), useUnmergedTree = true).assertExists()
        }
    }

    // Join.md:69 — no answer: the line stands above Create account, which stays, the retry.
    @Test
    fun noAnswerStandsAboveCreateAccountWhichStaysTheRetry() {
        var presses = 0
        show(filled.copy(fault = JoinFault.NO_ANSWER), onSubmit = { presses++ })
        tag("join.fault").assertTextEquals("That didn't send. Try again.")
        assertThat(top("join.fault")).isLessThan(top("join.commit.action"))
        compose.onNodeWithTag("join.commit.action").assertIsEnabled().performScrollTo().performClick()
        assertThat(presses).isEqualTo(1)
    }

    // Join.md:71, 73 — Already have an account? Sign in stands, and opens SignIn.
    @Test
    fun alreadyHaveAnAccountOpensSignIn() {
        var signIn = 0
        show(onSignIn = { signIn++ })
        compose.onNodeWithTag("join.signInDoor").assertTextEquals("Already have an account? Sign in")
        press("join.signInDoor")
        assertThat(signIn).isEqualTo(1)
    }

    // Join.md:77 — the page scrolls, so its action stays within reach.
    @Test
    fun thePageScrolls() {
        show()
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.ScrollBy)).assertExists()
    }

    // Join.md:79 — the accept sentence stands directly above Create account,
    // Terms a door; Join.md:81 — no checkbox stands on the form.
    @Test
    fun theAcceptSentenceStandsDirectlyAboveCreateAccountWithTermsADoor() {
        show()
        assertThat(text("join.terms")).isEqualTo("By creating your account you accept the Terms.")
        assertThat(doors("join.terms")).containsExactly("Terms")
        assertThat(top("join.terms")).isLessThan(top("join.commit.action"))
        // Only the commit's own waiting line stands between them (the board's order).
        assertThat(top("join.commit.reason")).isAtLeast(top("join.terms"))
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.ToggleableState)).assertDoesNotExist()
    }

    // Join.md:83 — the privacy notice stands at the form's foot, its own line
    // with Privacy Policy a door, and never inside the accept sentence.
    @Test
    fun thePrivacyNoticeIsItsOwnLineAtTheFoot() {
        show()
        assertThat(text("join.privacy")).isEqualTo("How CoGra handles your data: the Privacy Policy.")
        assertThat(doors("join.privacy")).containsExactly("Privacy Policy")
        assertThat(text("join.terms")).doesNotContain("Privacy")
        assertThat(top("join.privacy")).isGreaterThan(top("join.signInDoor"))
    }

    // Join.md:99-101 — Create account stands disabled with its waiting line
    // until all four fields hold a character, then wakes and the line goes.
    @Test
    fun createAccountWaitsOnItsFieldsThenWakes() {
        var state by mutableStateOf(filled.copy(password = ""))
        compose.setContent { JoinScreen(state, mira, {}, {}, {}, {}) }
        tag("join.commit.action").assertIsNotEnabled()
        tag("join.commit.reason").assertTextEquals("Waiting for a handle, your email and a password")
        // Join.md:99 — an empty Repeat password keeps it waiting, under the same line.
        state = filled.copy(confirm = "")
        compose.waitForIdle()
        tag("join.commit.action").assertIsNotEnabled()
        tag("join.commit.reason").assertTextEquals("Waiting for a handle, your email and a password")
        state = filled
        compose.waitForIdle()
        tag("join.commit.action").assertIsEnabled()
        tag("join.commit.reason").assertDoesNotExist()
    }

    // Join.md:39 — Repeat password stands under Password, masked like it, with
    // its own reveal control and no hint.
    @Test
    fun repeatPasswordStandsUnderPasswordMaskedWithItsOwnRevealAndNoHint() {
        show(filled)
        tag("join.confirm.label").assertTextEquals("Repeat password")
        assertThat(top("join.confirm")).isGreaterThan(top("join.password.support"))
        tag("join.confirm.reveal").assertExists()
        tag("join.confirm.support").assertDoesNotExist()
        assertThat(masked("join.confirm.input")).isTrue()
        assertThat(masked("join.password.input")).isTrue()
    }

    // Join.md:41-43 — each password field's reveal answers for that field alone.
    @Test
    fun eachRevealShowsOnlyItsOwnField() {
        show(filled)
        press("join.confirm.reveal")
        reveal("join.confirm", "Hide password").assertExists()
        reveal("join.password", "Show password").assertExists()
    }

    // Join.md:71, JoinErrors.md:7,15 — the mismatch line is the field's only
    // line, in M3's error state, beside Password's own line.
    @Test
    fun theMismatchLineStandsOnRepeatPasswordInItsErrorState() {
        show(filled.copy(local = JoinLines(password = JoinLine.PASSWORD_SHORT, confirm = JoinLine.PASSWORDS_DIFFER)))
        tag("join.confirm.support").assertTextEquals("The two passwords don't match.")
        tag("join.password.support").assertTextEquals("A password is at least 12 characters.")
        tag("join.confirm.input").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
        tag("join.password.input").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
    }

    // Join.md:71 — the press that finds the two apart says so and sends nothing.
    @Test
    fun aPressWithThePasswordsApartSaysSoAndSendsNothing() {
        val held = HeldOnboarding()
        val vm = JoinViewModel(Register(held, FakeTokenStore()), JoinDraft())
        compose.setContent {
            JoinRoute(
                inviteId = "0d9e4a71-2f4b-4a1e-9c53-8d54f0a3b2c1",
                inviter = mira,
                onBack = {},
                onAbout = {},
                onSignIn = {},
                onSpent = {},
                onCreated = {},
                viewModel = vm,
            )
        }
        vm.onHandleChange("noor")
        vm.onEmailChange("noor@fieldmail.org")
        vm.onPasswordChange("fielddayfield")
        vm.onConfirmChange("fielddayfeld")
        press("join.commit.action")
        compose.waitForIdle()
        tag("join.confirm.support").assertTextEquals("The two passwords don't match.")
        assertThat(vm.state.value.inFlight).isFalse()
    }

    // Join.md:89, 93 — the Terms and the Privacy Policy are doors of their own,
    // each inside its line (registered `join.terms.open`, `join.privacy.open`).
    @Test
    fun theTwoLegalDoorsAreNodesInsideTheirLines() {
        show()
        for (line in listOf("join.terms", "join.privacy")) {
            val outer = tag(line).fetchSemanticsNode().boundsInRoot
            val door = tag("$line.open").fetchSemanticsNode().boundsInRoot
            assertThat(door.top).isAtLeast(outer.top)
            assertThat(door.bottom).isAtMost(outer.bottom)
        }
    }

    /** A password field's reveal, by the name it answers to. */
    private fun reveal(field: String, name: String) = compose.onNode(
        hasContentDescription(name) and hasAnyAncestor(hasTestTag("$field.reveal")),
        useUnmergedTree = true,
    )

    /** Whether the input carries the password semantics (masked kind, password keyboard). */
    private fun masked(path: String): Boolean =
        tag(path).fetchSemanticsNode().config.contains(SemanticsProperties.Password)

    /** The link texts inside a line's annotated string. */
    private fun doors(path: String): List<String> {
        val annotated: AnnotatedString = tag(path).fetchSemanticsNode().config[SemanticsProperties.Text].single()
        return annotated.getLinkAnnotations(0, annotated.length)
            .filter { it.item is LinkAnnotation.Clickable }
            .map { annotated.text.substring(it.start, it.end) }
    }
}
