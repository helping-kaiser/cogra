// The signed-profile store's law (ProfileEditSeal.md:45, AvatarSeal.md:37,
// Profile.md:97): a taken change is laid for its account and profile, a later
// change's fields win over an earlier one's, the first read asked after it
// replaces it, and an account change drops it. web's twin is
// `signed-profile.test.ts`.

package com.cogra.domain.profile

import com.cogra.domain.AuthTokens
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.testModeratedField
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SignedProfileTest {

    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }

    private fun TestScope.store() = SignedProfile(session, backgroundScope).also { runCurrent() }

    private val renamed = SignedProfileFields(displayName = "Noa", bio = Setting("new bio"), websiteUrl = Setting(null))

    @Test
    fun aTakenChangeIsLaidForItsProfile() = runTest {
        val signed = store()
        signed.lay(signed.begin(), "u1", renamed)
        assertThat(signed.laid.value.over("u1")).isEqualTo(renamed)
        assertThat(signed.laid.value.over("u2")).isNull()
    }

    @Test
    fun aChangeBegunWithNoAccountIsNeverLaid() = runTest {
        session.tokens.value = null
        val signed = store()
        signed.lay(signed.begin(), "u1", renamed)
        assertThat(signed.laid.value).isNull()
    }

    @Test
    fun aChangeTakenAfterTheAccountChangedIsNeverLaid() = runTest {
        val signed = store()
        val signing = signed.begin()
        session.tokens.value = AuthTokens("a2", "r2", "u2")
        runCurrent()
        signed.lay(signing, "u1", renamed)
        assertThat(signed.laid.value).isNull()
    }

    @Test
    fun theFirstReadAskedAfterReplacesItAReadAskedBeforeDoesNot() = runTest {
        val signed = store()
        val before = signed.asked()
        signed.lay(signed.begin(), "u1", renamed)
        // In flight when the change was taken: it confirms nothing.
        signed.answered(before, "u1")
        assertThat(signed.laid.value.over("u1")).isEqualTo(renamed)
        // Another profile's read confirms nothing either.
        signed.answered(signed.asked(), "u2")
        assertThat(signed.laid.value.over("u1")).isEqualTo(renamed)

        signed.answered(signed.asked(), "u1")
        assertThat(signed.laid.value).isNull()
    }

    @Test
    fun aLaterChangesFieldsWinAndUntouchedFieldsKeepTheEarlierOnes() = runTest {
        val signed = store()
        signed.lay(signed.begin(), "u1", renamed)
        val picture = SignedProfileFields(avatar = Setting(SignedPicture("m1", "https://media/m1")))
        signed.lay(signed.begin(), "u1", picture)
        assertThat(signed.laid.value.over("u1")).isEqualTo(renamed.copy(avatar = picture.avatar))

        // A change that began signing before the one laid never overrides it;
        // what the later one left untouched keeps the earlier one's (on another
        // profile, so the first change's fields stand nowhere in the slot).
        val older = signed.begin()
        val newer = signed.begin()
        signed.lay(newer, "u2", SignedProfileFields(displayName = "Newer"))
        signed.lay(older, "u2", SignedProfileFields(displayName = "Older", bio = Setting(null)))
        assertThat(signed.laid.value.over("u2")?.displayName).isEqualTo("Newer")
        assertThat(signed.laid.value.over("u2")?.bio).isEqualTo(Setting(null))
    }

    @Test
    fun anAccountChangeOrSignOutDropsIt() = runTest {
        val signed = store()
        signed.lay(signed.begin(), "u1", renamed)
        // A rotated token pair is the same account: nothing drops.
        session.tokens.value = AuthTokens("a-rotated", "r-rotated", "u1")
        runCurrent()
        assertThat(signed.laid.value).isNotNull()

        session.tokens.value = AuthTokens("a2", "r2", "u2")
        runCurrent()
        assertThat(signed.laid.value).isNull()

        session.tokens.value = AuthTokens("a", "r", "u1")
        runCurrent()
        signed.lay(signed.begin(), "u1", renamed)
        session.tokens.value = null
        runCurrent()
        assertThat(signed.laid.value).isNull()
    }

    @Test
    fun theHeadWearsWhatWasSignedAndKeepsWhatItLeftUntouched() {
        val read = testProfile(id = "u1", handle = "jakob", bio = "old")
        assertThat(read.wearing(null)).isEqualTo(read)

        val worn = read.wearing(renamed)
        assertThat(worn.displayName.value).isEqualTo("Noa")
        assertThat(worn.bio).isEqualTo(testModeratedField("new bio"))
        assertThat(worn.websiteUrl.value).isNull()
        assertThat(worn.avatar).isEqualTo(read.avatar)
        assertThat(worn.handle).isEqualTo("jakob")

        val pictured = read.wearing(SignedProfileFields(avatar = Setting(SignedPicture("m1", "https://media/m1"))))
        assertThat(pictured.avatar?.id).isEqualTo("m1")
        assertThat(pictured.avatar?.url).isEqualTo("https://media/m1")
        assertThat(pictured.bio).isEqualTo(read.bio)

        assertThat(pictured.wearing(SignedProfileFields(avatar = Setting(null))).avatar).isNull()
    }
}
