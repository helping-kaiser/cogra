// Pins the app's no-backup posture: allowBackup="false" is the whole story
// below Android 12 (and the cloud half above it), but on Android 12+ a
// device-to-device transfer is governed by dataExtractionRules, so the
// manifest must name a rules file that excludes everything from both paths.

package com.cogra.app

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

private const val ANDROID_NS = "http://schemas.android.com/apk/res/android"

private fun parse(path: String): Element =
    DocumentBuilderFactory.newInstance()
        .apply { isNamespaceAware = true }
        .newDocumentBuilder()
        .parse(File(path))
        .documentElement

private fun Element.child(tag: String): Element {
    val matches = getElementsByTagName(tag)
    check(matches.length == 1) { "expected one <$tag>, found ${matches.length}" }
    return matches.item(0) as Element
}

private fun Element.rules(tag: String): List<Pair<String, String>> {
    val matches = getElementsByTagName(tag)
    return (0 until matches.length)
        .map { matches.item(it) as Element }
        .map { it.getAttribute("domain") to it.getAttribute("path") }
}

class DataExtractionRulesTest {
    private val application = parse("src/main/AndroidManifest.xml").child("application")
    private val rules = parse("src/main/res/xml/data_extraction_rules.xml")

    @Test
    fun `the manifest declines backup and names the extraction rules`() {
        assertThat(application.getAttributeNS(ANDROID_NS, "allowBackup")).isEqualTo("false")
        assertThat(application.getAttributeNS(ANDROID_NS, "dataExtractionRules"))
            .isEqualTo("@xml/data_extraction_rules")
    }

    @Test
    fun `cloud backup and device transfer both exclude every domain whole`() {
        for (section in listOf("cloud-backup", "device-transfer")) {
            val part = rules.child(section)

            // An include would narrow the default to what it names; the
            // rules only ever subtract.
            assertThat(part.rules("include")).isEmpty()
            assertThat(part.rules("exclude")).containsAtLeast("root" to ".", "device_root" to ".")
            assertThat(part.rules("exclude").map { it.first }).containsAtLeast(
                "file",
                "database",
                "sharedpref",
                "external",
                "device_file",
                "device_database",
                "device_sharedpref",
            )
            assertThat(part.rules("exclude").map { it.second }.toSet()).containsExactly(".")
        }
    }
}
