//! ´mod:module:ranker-pod´
//!
//! The ranking relay's client to the server ranker pod (ranked-feed-api
//! §4.2 step 4, §4.6). Ranking never runs in this process
//! (feed-ranking.md §11): the pod is a separate container that fetches the
//! viewer's slice back from this api and answers the ranking; this module
//! only carries the request there and the answer back.
//!
//! The client is generated at compile time from the pod's checked-in
//! `ranker-schema.graphql` and the relay's documents — `ranker_pod.graphql`
//! for the feed, `ranker_pod_search.graphql` for ranked search — so a pod
//! schema change that breaks the relay fails this crate's build. The `ranker` crate itself is never a
//! dependency of the api (PR-9).
//!
//! Backpressure is technical, never a rate-limit scope (ranked-feed-api
//! §13): a semaphore bounds concurrent pod calls (`RANKER_MAX_IN_FLIGHT`),
//! and every call — the wait for a slot included — is bounded by
//! `RANKER_TIMEOUT_MS`. Both surface as the caller's `INTERNAL`.
//!
//! # Measured budgets (ranked-feed-api §4.6; filled on first green)
//!
//! - P-3, a warm `feedRanking` round trip: not measurable until the pod
//!   exists (RK-2). Against the in-test stub pod the relay's own share —
//!   the cursor read, the candidate read, one HTTP hop, the mapping — is
//!   recorded in the RF-2 lane report; `RANKER_TIMEOUT_MS` stays at its
//!   provisional 10 000 until P-3 sets it at about 3× the pod's p99.

use std::sync::Arc;
use std::time::Duration;

use graphql_client::GraphQLQuery;
use tokio::sync::Semaphore;

/// The pod schema's `UUID` scalar, named as the generated code expects.
#[expect(
    clippy::upper_case_acronyms,
    reason = "graphql_client resolves a custom scalar by its schema name, and ranker-schema.graphql names it UUID"
)]
type UUID = uuid::Uuid;

/// The pod schema's `DateTime` scalar.
type DateTime = chrono::DateTime<chrono::Utc>;

/// The relay's `rank` document, typed against the pod's schema.
#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "../../ranker-schema.graphql",
    query_path = "src/ranker_pod.graphql",
    response_derives = "Debug, Clone, PartialEq",
    variables_derives = "Debug, Clone"
)]
pub struct Rank;

pub use rank::{
    FriendAuthorReorder, NodeKind as PodKind, PeopleMark as PodMark, RankParams,
    RankRank as PodRanking, RankRankEntries as PodEntry, RankRankSettling as PodPlace,
    SettlingCandidate, Variables as RankVariables,
};

/// The ranked-search relay's `rankSearch` document (ranked-feed-api §4.8).
#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "../../ranker-schema.graphql",
    query_path = "src/ranker_pod_search.graphql",
    response_derives = "Debug, Clone, PartialEq",
    variables_derives = "Debug, Clone"
)]
pub struct RankSearch;

pub mod search {
    //! The `rankSearch` document's generated types, under the relay's names.
    pub use super::rank_search::{
        FriendAuthorReorder, RankParams, RankSearchRankSearch as PodSearchRanking,
        RankSearchRankSearchEntries as PodSearchEntry, Variables as RankSearchVariables,
    };
}

/// Where the pod is and how hard the relay may lean on it (ranked-feed-api
/// §4.6; production-deploy.md names `RANKER_URL` as this packet's).
#[derive(Debug, Clone)]
pub struct RankerConfig {
    /// The pod's GraphQL endpoint (`RANKER_URL`).
    pub url: String,
    /// The bound on one relay call, the wait for a slot included
    /// (`RANKER_TIMEOUT_MS`). Provisional until measured (P-3).
    pub timeout: Duration,
    /// Concurrent pod calls at most (`RANKER_MAX_IN_FLIGHT`). Provisional.
    pub max_in_flight: usize,
}

impl RankerConfig {
    /// The dev pod: `RANKER_BIND` 0.0.0.0:8090 (ranker-core.md §4.4).
    pub const DEFAULT_URL: &str = "http://localhost:8090/graphql";
    pub const DEFAULT_TIMEOUT_MS: u64 = 10_000;
    pub const DEFAULT_MAX_IN_FLIGHT: usize = 8;

    /// The configuration the environment names, the dev defaults beneath.
    pub fn from_env() -> anyhow::Result<Self> {
        use anyhow::Context;
        let timeout_ms: u64 =
            crate::env_or("RANKER_TIMEOUT_MS", &Self::DEFAULT_TIMEOUT_MS.to_string())
                .parse()
                .context("RANKER_TIMEOUT_MS must be a number of milliseconds")?;
        let max_in_flight: usize = crate::env_or(
            "RANKER_MAX_IN_FLIGHT",
            &Self::DEFAULT_MAX_IN_FLIGHT.to_string(),
        )
        .parse()
        .context("RANKER_MAX_IN_FLIGHT must be a whole number")?;
        anyhow::ensure!(max_in_flight > 0, "RANKER_MAX_IN_FLIGHT must be at least 1");
        Ok(Self {
            url: crate::env_or("RANKER_URL", Self::DEFAULT_URL),
            timeout: Duration::from_millis(timeout_ms),
            max_in_flight,
        })
    }
}

impl Default for RankerConfig {
    fn default() -> Self {
        Self {
            url: Self::DEFAULT_URL.to_string(),
            timeout: Duration::from_millis(Self::DEFAULT_TIMEOUT_MS),
            max_in_flight: Self::DEFAULT_MAX_IN_FLIGHT,
        }
    }
}

/// Why a pod call produced no ranking. Every variant but `NotFound` is the
/// relay's `INTERNAL`; the variant is the logged cause.
#[derive(Debug, thiserror::Error)]
pub enum PodError {
    /// The pod's slice was null: the viewer resolves to no rankable actor.
    #[error("the pod found no rankable actor for the viewer")]
    NotFound,
    /// The pod refused the request as malformed — a relay bug, since the
    /// relay sends no calibration of its own.
    #[error("the pod refused the request as bad input: {0}")]
    BadInput(String),
    /// The pod answered with its own fault.
    #[error("the pod answered a fault ({code}): {message}")]
    Fault { code: String, message: String },
    /// No slot freed within the timeout: over `RANKER_MAX_IN_FLIGHT`.
    #[error("over the in-flight cap: no slot freed within {0:?}")]
    OverCap(Duration),
    /// The call itself outlasted the timeout.
    #[error("the pod did not answer within {0:?}")]
    Timeout(Duration),
    /// The pod could not be reached, or the connection broke.
    #[error("the pod is unreachable: {0}")]
    Unreachable(#[from] reqwest::Error),
    /// The pod answered something that is not the schema's answer.
    #[error("the pod's answer does not decode: {0}")]
    Undecodable(String),
}

/// The pod, as a client. Cheap to clone: the connection pool and the
/// in-flight slots are shared.
#[derive(Clone)]
pub struct RankerClient {
    http: reqwest::Client,
    url: String,
    timeout: Duration,
    slots: Arc<Semaphore>,
}

impl RankerClient {
    pub fn new(config: &RankerConfig) -> Result<Self, reqwest::Error> {
        Ok(Self {
            http: reqwest::Client::builder().build()?,
            url: config.url.clone(),
            timeout: config.timeout,
            slots: Arc::new(Semaphore::new(config.max_in_flight)),
        })
    }

    /// One `rank` call.
    pub async fn rank(&self, variables: RankVariables) -> Result<PodRanking, PodError> {
        self.call::<Rank>(variables).await.map(|data| data.rank)
    }

    /// One `rankSearch` call (ranked-feed-api §4.8).
    pub async fn rank_search(
        &self,
        variables: search::RankSearchVariables,
    ) -> Result<search::PodSearchRanking, PodError> {
        self.call::<RankSearch>(variables)
            .await
            .map(|data| data.rank_search)
    }

    /// One pod operation. The wait for a slot and the call each get the
    /// configured timeout, so a call queued behind the cap is refused as
    /// over the cap rather than as slow.
    async fn call<Q: GraphQLQuery>(
        &self,
        variables: Q::Variables,
    ) -> Result<Q::ResponseData, PodError> {
        let _slot = tokio::time::timeout(self.timeout, self.slots.clone().acquire_owned())
            .await
            .map_err(|_| PodError::OverCap(self.timeout))?
            .map_err(|_| PodError::OverCap(self.timeout))?;
        let body = serde_json::to_vec(&Q::build_query(variables))
            .map_err(|e| PodError::Undecodable(e.to_string()))?;
        let call = async {
            let response = self
                .http
                .post(&self.url)
                .header(reqwest::header::CONTENT_TYPE, "application/json")
                .body(body)
                .send()
                .await?;
            let status = response.status();
            Ok::<_, reqwest::Error>((status, response.bytes().await?))
        };
        let (status, bytes) = tokio::time::timeout(self.timeout, call)
            .await
            .map_err(|_| PodError::Timeout(self.timeout))??;
        let answer: graphql_client::Response<Q::ResponseData> =
            serde_json::from_slice(&bytes)
                .map_err(|e| PodError::Undecodable(format!("HTTP {status}: {e}")))?;
        if let Some(error) = answer.errors.as_deref().and_then(<[_]>::first) {
            let code = error
                .extensions
                .as_ref()
                .and_then(|ext| ext.get("code"))
                .and_then(serde_json::Value::as_str)
                .unwrap_or("INTERNAL");
            return Err(match code {
                "NOT_FOUND" => PodError::NotFound,
                "BAD_INPUT" => PodError::BadInput(error.message.clone()),
                other => PodError::Fault {
                    code: other.to_string(),
                    message: error.message.clone(),
                },
            });
        }
        answer
            .data
            .ok_or_else(|| PodError::Undecodable(format!("HTTP {status}: no data and no error")))
    }
}
