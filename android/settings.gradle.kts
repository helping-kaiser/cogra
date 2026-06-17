pluginManagement {
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

// Slice 1 stands up only the modules the login -> profile cut needs.
// core:ranker and feature:feed arrive with the slices that need them
// (docs/implementation/roadmap.md).
include(":app")
include(":core:network")
include(":core:domain")
include(":feature:auth")
