package com.cogra.core.network

import com.apollographql.apollo.ApolloClient
import com.cogra.core.domain.model.ErrorCode
import com.cogra.core.domain.model.FieldModerationStatus
import com.cogra.core.domain.model.NetworkRole
import com.cogra.core.domain.model.ProfileEdits
import com.cogra.core.domain.repository.AuthOutcome
import com.cogra.core.domain.repository.EditProfileOutcome
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

private const val USER_JSON = """
  {
    "__typename": "User",
    "id": "u1",
    "handle": { "value": "alice", "status": "NORMAL" },
    "displayName": { "value": "Alice", "status": "NORMAL" },
    "bio": { "value": "hi", "status": "SENSITIVE" },
    "websiteUrl": { "value": null, "status": "NORMAL" },
    "networkRole": "MODERATOR",
    "moderationStatus": "NORMAL",
    "createdAt": "2026-06-17T00:00:00Z",
    "updatedAt": "2026-06-17T01:00:00Z"
  }
"""

class AuthRepositoryImplTest {

    private lateinit var server: MockWebServer
    private lateinit var apolloClient: ApolloClient
    private lateinit var repository: AuthRepositoryImpl

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        apolloClient = ApolloClient.Builder().serverUrl(server.url("/").toString()).build()
        repository = AuthRepositoryImpl(apolloClient)
    }

    @After
    fun tearDown() {
        apolloClient.close()
        server.shutdown()
    }

    private fun enqueueJson(body: String) {
        server.enqueue(MockResponse().setBody(body).addHeader("Content-Type", "application/json"))
    }

    @Test
    fun `logIn maps a successful payload to Authenticated`() = runTest {
        enqueueJson(
            """{"data":{"logIn":{"auth":{"accessToken":"at","refreshToken":"rt","user":$USER_JSON},"userErrors":[]}}}""",
        )

        val outcome = repository.logIn("a@b.com", "pw", "Pixel")

        assertThat(outcome).isInstanceOf(AuthOutcome.Authenticated::class.java)
        val authenticated = outcome as AuthOutcome.Authenticated
        assertThat(authenticated.tokens.accessToken).isEqualTo("at")
        assertThat(authenticated.tokens.refreshToken).isEqualTo("rt")
        assertThat(authenticated.user.id).isEqualTo("u1")
        assertThat(authenticated.user.handle.value).isEqualTo("alice")
        assertThat(authenticated.user.bio.status).isEqualTo(FieldModerationStatus.SENSITIVE)
        assertThat(authenticated.user.websiteUrl.value).isNull()
        assertThat(authenticated.user.networkRole).isEqualTo(NetworkRole.MODERATOR)
    }

    @Test
    fun `logIn maps userErrors to Rejected`() = runTest {
        enqueueJson(
            """{"data":{"logIn":{"auth":null,"userErrors":[{"message":"nope","code":"INVALID_CREDENTIALS","field":null}]}}}""",
        )

        val outcome = repository.logIn("a@b.com", "wrong", null)

        assertThat(outcome).isInstanceOf(AuthOutcome.Rejected::class.java)
        val errors = (outcome as AuthOutcome.Rejected).errors
        assertThat(errors).hasSize(1)
        assertThat(errors.single().code).isEqualTo(ErrorCode.INVALID_CREDENTIALS)
        assertThat(errors.single().field).isEmpty()
    }

    @Test
    fun `me maps a present viewer`() = runTest {
        enqueueJson("""{"data":{"me":$USER_JSON}}""")

        val user = repository.me()

        assertThat(user).isNotNull()
        assertThat(user!!.id).isEqualTo("u1")
    }

    @Test
    fun `me returns null when the viewer is null`() = runTest {
        enqueueJson("""{"data":{"me":null}}""")

        assertThat(repository.me()).isNull()
    }

    @Test(expected = Exception::class)
    fun `me throws on a transport error so the use-case can map it to Failure`() = runTest {
        enqueueJson("""{"errors":[{"message":"boom","extensions":{"code":"INTERNAL"}}],"data":null}""")

        repository.me()
    }

    @Test
    fun `editProfile maps an updated payload to Updated`() = runTest {
        enqueueJson("""{"data":{"editProfile":{"user":$USER_JSON,"userErrors":[]}}}""")

        val outcome = repository.editProfile(ProfileEdits(displayName = "Alice"))

        assertThat(outcome).isInstanceOf(EditProfileOutcome.Updated::class.java)
        assertThat((outcome as EditProfileOutcome.Updated).user.id).isEqualTo("u1")
    }

    @Test
    fun `editProfile maps userErrors to Rejected`() = runTest {
        enqueueJson(
            """{"data":{"editProfile":{"user":null,"userErrors":[{"message":"taken","code":"HANDLE_TAKEN","field":["handle"]}]}}}""",
        )

        val outcome = repository.editProfile(ProfileEdits(handle = "taken"))

        assertThat(outcome).isInstanceOf(EditProfileOutcome.Rejected::class.java)
        val error = (outcome as EditProfileOutcome.Rejected).errors.single()
        assertThat(error.code).isEqualTo(ErrorCode.HANDLE_TAKEN)
        assertThat(error.field).containsExactly("handle")
    }
}
