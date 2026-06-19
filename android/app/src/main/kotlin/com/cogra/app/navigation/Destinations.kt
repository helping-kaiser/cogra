package com.cogra.app.navigation

import kotlinx.serialization.Serializable

/**
 * Type-safe Navigation Compose destinations (Navigation 2.8+). No arguments
 * yet — later slices add data-carrying routes (e.g. a post id) as serializable
 * properties.
 */
@Serializable
object Login

@Serializable
object Profile

@Serializable
object EditProfile

/** Result key the edit screen sets on the profile's `savedStateHandle` to
 *  signal a saved edit — the profile consumes it to refresh and confirm. */
const val PROFILE_UPDATED_RESULT = "profile_updated"
