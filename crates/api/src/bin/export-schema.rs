// Prints the GraphQL SDL. `make schema` redirects this into the
// checked-in schema.graphql; CI fails when that file drifts.

fn main() {
    print!("{}", api::schema::sdl());
}
