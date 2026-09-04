// Use-cases and domain types — plain Kotlin, no Android dependencies
// (android/CLAUDE.md "Module discipline"). Repository and store
// interfaces live here; core:network binds the implementations. The
// only DI annotation is javax.inject, keeping the module JVM-testable
// while letting Hilt build the use-cases.

plugins {
    alias(libs.plugins.kotlin.jvm)
    // Shared in-memory fakes and the in-test host sealer, consumed by
    // every feature module's tests via testFixtures(project(...)).
    `java-test-fixtures`
}

kotlin {
    jvmToolchain(17)
}

// The repo-root contract artifacts are read at test time rather than
// compiled in, so they belong to no source set and Gradle cannot see
// them. Undeclared, the up-to-date check and the build cache both hand
// back a pass computed against the previous `make constants` /
// `make vectors` output. Declaring a runtime-read file as a task input
// is Gradle's own answer (user manual, "Incremental build");
// `workingDir` is stated because the tests name the files by a path
// relative to this module.
tasks.withType<Test>().configureEach {
    workingDir = projectDir
    inputs.file(file("../../../client-constants.json"))
        .withPropertyName("clientConstants")
        .withPathSensitivity(PathSensitivity.NONE)
    inputs.file(file("../../../stance-fold-vectors.json"))
        .withPropertyName("stanceFoldVectors")
        .withPathSensitivity(PathSensitivity.NONE)
}

dependencies {
    api(project(":core:crypto"))
    implementation(libs.javax.inject)
    implementation(libs.kotlinx.coroutines.core)
    testFixturesImplementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    // Reads the repo-root contract artifacts; nothing in main parses JSON.
    testImplementation(libs.kotlinx.serialization.json)
}
