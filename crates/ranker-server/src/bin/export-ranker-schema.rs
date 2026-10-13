//! Prints the ranker pod's GraphQL SDL. `make ranker-schema` redirects this
//! into the checked-in ranker-schema.graphql, which the api's relay
//! generates its client from; CI fails when that file drifts.

fn main() {
    print!("{}", ranker_server::schema::sdl());
}
