pluginManagement {
    // The convention plugins (cogra.android.module) live in an included
    // build so they compile against AGP once, not per module.
    includeBuild("build-logic")
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "cogra"

// The domain and feature modules return with the slices that need them
// (docs/implementation/roadmap.md).
include(":app")
include(":core:crypto")
include(":core:designsystem")
include(":core:domain")
include(":core:network")
include(":feature:auth")
include(":feature:content")
include(":feature:onboarding")
include(":feature:home")
include(":feature:invites")
include(":feature:settings")
