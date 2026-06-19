package com.cogra.core.domain.model

/**
 * A set of profile-field changes for `editProfile`. A null field is left
 * untouched (omitted from the mutation); a non-null field is applied. For the
 * optional fields ([bio], [websiteUrl]) an empty string clears the stored
 * value, mirroring the backend's "blank clears" rule. [handle] and
 * [displayName] are never sent empty — the caller validates them first.
 */
data class ProfileEdits(
    val handle: String? = null,
    val displayName: String? = null,
    val bio: String? = null,
    val websiteUrl: String? = null,
) {
    /** True when at least one field is actually being changed. */
    val hasChanges: Boolean
        get() = handle != null || displayName != null || bio != null || websiteUrl != null
}
