// Root build script. Plugins are declared here with `apply false` so each
// module can apply them without re-stating versions; the versions live in
// gradle/libs.versions.toml.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.apollo) apply false
}

// Robolectric fetches its android-all sandbox jars from Maven Central at
// *test runtime*, through its own downloader — outside Gradle, so outside
// Gradle's caching, retries, and `--offline`. A blip there fails the test
// run, which is what flaked CI. Declaring the jars as ordinary Gradle
// dependencies and staging them into one directory turns that into a
// build-time resolution; `AndroidModuleConventionPlugin` then points
// Robolectric's offline mode at the directory
// (https://robolectric.org/blog/2023/11/11/improving-android-all-downloading/).
//
// One configuration pair per API level: the jars share a group and name and
// differ only in version, so a single configuration would collapse them to
// the highest version under Gradle's conflict resolution.
val robolectricSdkFiles = mapOf(
    26 to libs.robolectric.android.all.api26,
    32 to libs.robolectric.android.all.api32,
    33 to libs.robolectric.android.all.api33,
    36 to libs.robolectric.android.all.api36,
).map { (apiLevel, jar) ->
    val declared = configurations.dependencyScope("robolectricSdk$apiLevel")
    dependencies.addProvider(declared.name, jar)
    configurations.resolvable("robolectricSdk${apiLevel}Files") {
        extendsFrom(declared.get())
        isTransitive = false
    }
}

// Sync, not Copy: a stale jar left behind after a Robolectric bump would
// otherwise sit in the directory forever, invisible.
tasks.register<Sync>("stageRobolectricSdks") {
    description = "Stages Robolectric's android-all jars for offline test runs."
    from(robolectricSdkFiles)
    into(layout.buildDirectory.dir("robolectric-sdks"))
}
