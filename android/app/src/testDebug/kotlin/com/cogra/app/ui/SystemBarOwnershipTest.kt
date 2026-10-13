// The system-bar law's conformance pin (core:designsystem SystemBarOwner.kt,
// seam 171): exactly one place in the tree touches the window's bar appearance,
// one theme-root effect, and the rest of the app only declares a ground. This
// reads the production sources, comments stripped, so a second call site —
// in a screen, in the theme XML, anywhere — fails here rather than fighting the
// owner on a phone. Run from the app module; the sources it reads are declared
// as test inputs in app/build.gradle.kts, so an edit anywhere re-runs it.

package com.cogra.app.ui

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.io.File

class SystemBarOwnershipTest {

    private val owner = "core/designsystem/src/main/kotlin/com/cogra/core/designsystem/SystemBarOwner.kt"

    /**
     * The media viewer's dialog is a SEPARATE window: it copies the app window's
     * reading onto itself and clears its own paint, and never sets the app window's.
     */
    private val dialogWindowMirror =
        "core/designsystem/src/main/kotlin/com/cogra/core/designsystem/v2/media/MediaViewer.kt"

    private val production get() = Sources.production

    private fun filesWith(token: String): List<String> =
        production.filter { (_, text) -> token in text }.map { it.first }

    private object Sources {
        /** `android/`, the Gradle root — the test runs with the app module as its working directory. */
        private val root = File("..").canonicalFile

        /** Each module's `src/main` (`<module>/` and `<group>/<module>/`), read once, comments stripped. */
        val production: List<Pair<String, String>> by lazy {
            val mains = root.listFiles().orEmpty().flatMap { top ->
                listOf(top) + top.listFiles().orEmpty().filter { it.isDirectory }
            }.map { File(it, "src/main") }.filter { it.isDirectory }
            mains.flatMap { main ->
                main.walkTopDown().filter { it.isFile && it.extension in setOf("kt", "xml") }.toList()
            }.map { it.relativeTo(root).path.replace('\\', '/') to stripComments(it.readText()) }
        }

        private fun stripComments(text: String): String = text
            .replace(Regex("""(?s)/\*.*?\*/"""), "")
            .replace(Regex("""(?s)<!--.*?-->"""), "")
            .replace(Regex("""(?m)//.*$"""), "")
    }

    @Test
    fun `the system bar appearance has one owner`() {
        // The scan really read the tree: the owner's file is in it, with its call.
        assertThat(production.map { it.first }).contains(owner)
        assertThat(filesWith("enableEdgeToEdge(")).contains(owner)
        // Every call that can set the bars' style or icons lives in the owner's file.
        listOf("enableEdgeToEdge(", "SystemBarStyle", "setSystemBarsAppearance", "WindowInsetsControllerCompat")
            .forEach { token -> assertThat(filesWith(token) - owner).isEmpty() }
        // The owner mounts once, at the theme root.
        val mounts = production.filter { (path, text) -> path != owner && "SystemBarOwner(" in text }
        assertThat(mounts.map { it.first }).containsExactly("app/src/main/kotlin/com/cogra/app/MainActivity.kt")
        // And its one styled call sits in one effect.
        val ownerText = production.first { it.first == owner }.second
        assertThat(Regex("""enableEdgeToEdge\(\s*statusBarStyle""").findAll(ownerText).count()).isEqualTo(1)
        assertThat(Regex("""DisposableEffect\(activity""").findAll(ownerText).count()).isEqualTo(1)
    }

    @Test
    fun `no surface touches the window's icon appearance or bar paint`() {
        listOf("isAppearanceLightStatusBars", "isAppearanceLightNavigationBars", "statusBarColor", "navigationBarColor")
            .forEach { token ->
                val hits = filesWith(token).filter { it != owner }
                assertThat(hits - dialogWindowMirror).isEmpty()
            }
    }

    @Test
    fun `the theme xml sets no bar colour or appearance`() {
        listOf(
            "statusBarColor",
            "navigationBarColor",
            "windowLightStatusBar",
            "windowLightNavigationBar",
            "enforceStatusBarContrast",
            "enforceNavigationBarContrast",
        ).forEach { token ->
            assertThat(filesWith(token).filter { it.endsWith(".xml") }).isEmpty()
        }
    }

    @Test
    fun `only the theme root declares an app ground`() {
        // The app grounds are the theme's; a surface may only declare ForcedDark.
        val declarers = production.filter { (path, text) ->
            path != owner && Regex("""DeclareBarGround\(\s*BarGround\.App""").containsMatchIn(text)
        }
        assertThat(declarers).isEmpty()
    }
}
