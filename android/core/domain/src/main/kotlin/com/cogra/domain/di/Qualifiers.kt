// DI qualifiers shared across modules (javax.inject only — this module
// stays plain Kotlin).

package com.cogra.domain.di

import javax.inject.Qualifier

/**
 * The per-environment web origin (auth.md "Link URLs") — the base of
 * every shareable URL. Provided by the app module's build config.
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class WebOrigin

/**
 * The app-lifetime coroutine scope for work that must outlive any one
 * screen (the applicant poll/sign loop). Provided by the app module.
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApplicationScope
