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

dependencies {
    api(project(":core:crypto"))
    implementation(libs.javax.inject)
    implementation(libs.kotlinx.coroutines.core)
    testFixturesImplementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}
