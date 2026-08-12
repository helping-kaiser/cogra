// Convention plugins for the android modules (the documented
// multi-module idiom: Gradle "Structuring Software Projects"). Compiled
// against AGP/KGP as compileOnly — each module still applies its own
// android/kotlin plugins.

plugins {
    `kotlin-dsl`
}

dependencies {
    compileOnly(libs.android.gradlePlugin)
    compileOnly(libs.kotlin.gradlePlugin)
}

gradlePlugin {
    plugins {
        register("androidModule") {
            id = "cogra.android.module"
            implementationClass = "AndroidModuleConventionPlugin"
        }
    }
}
