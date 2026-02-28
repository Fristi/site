---
pubDate: "2023-05-30"
banner: "/img/blog/rust.png"
title: "A REST API in Rust"
description: "My first experience writing a REST API in Rust as a Functional Scala developer"
---

## Motivation

Over the past few months, I decided to pick up on learning Rust again. I've coded a bare-metal Rust firmware which was a [successful project](/blog/baremetalrust-esp32).

Writing a REST API in the software industry is a common thing and I wondered how it would work in Rust. I decided to write a slimmed-down version of [Confluent's schema registry](https://docs.confluent.io/platform/current/schema-registry/index.html) in Rust. The source code can be found [here](https://github.com/Fristi/rs-schema-registry).

In this blog post, I'll go over what I liked about it and how I view Rust as a Functional Scala developer.

## Result<T,E> + async/await

In Rust there is no `Either[L, R]` like Scala, but it has `Result<T, E>` where `T` is the result type and `E` is the error type. In Rust there is the question mark operator `?`, which unwraps the `T` in case of success and shortcuts to `E` when an error occurs. This is similar to `Either[L,R]`.

Combining this with `async` functions is the same as `EitherT[IO, L, R]` or a ZIO without dependency injection.

Here is a little example of using `Result<T, E>` and `async` + `await` in Rust

```rust
async fn schema_find_by_schema(&self, subject: &String, schema: &String) -> Result<Option<FindBySchemaResponse>, AppError> {
    // this a synchrous call which parses an Avro JSON schema and returns a Result, hence the question mark to unwrap it
    let avro_schema = AvroSchema::parse_str(schema.as_str())?;
    // get the fingerprint for the schema
    let fingerprint = avro_schema.fingerprint::<Sha256>().to_string();
    // lookup the schema by using the fingerprint, note that this a async function which returns a Result, hence the question mark to unwrap it
    let res = self.repository.schema_find_by_schema(&subject, &fingerprint).await?;

    Ok(res)
}
```

This results in very clean and easy code. No need for Monads. However, in Scala with cats-effect and ZIO you'll get cancelable IO, repeat/retry and structured concurrency. This is not the case by default in Rust. There are some crates around which add retry and structured concurrency, but I'm not sure how _good_ they are. I didn't need it in this case, so can't tell you much about yet.

## Type classes in Rust

Type classes are a concept from [Haskell](http://learnyouahaskell.com/types-and-typeclasses), which can be encoded in Scala 2 (which works, but can be better) and is in Scala 3 as well but a bit better. In both Haskell and Scala, there is support for higher-kinded types which allows you to encode `Functor`, `Applicative`, `Monad` and other functional type classes. This allows you to write functions which are pretty generic, but also introduce concepts like Monad and the above.

There is no such thing as higher-kinded types and therefore you won't see good encodings of `Monad` and `Applicative` like in Scala and Haskell where also `flatMap` and `map` has special syntax in the form of `do` (Haskell) and `for` (Scala). I didn't miss this in Rust, async + `Result` is good enough and the cases for specialized monads are not _that_ common.

The nice thing in Rust is that you can _derive_ implementations for your data structures by annotating them like so:

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Person {
    pub name: String,
    pub age: u32
}
```

### Using `From` to do conversions

`From`, used to do value-to-value conversions while consuming the input value. The `From` is also very useful when performing error handling. When constructing a function that is capable of failing, the return type will generally be of the form `Result<T, E>`

### Serializing and deserializing data structures

[serde](https://serde.rs/) is a framework for serializing and deserializing Rust data structures efficiently and generically.

- `Serialize` - As the name implies, it will serialize the data structure into a specific format
- `Deserialize` - As the name implies, it will deserialize the data structure into the specific type

The nice thing about `Serialize` and `Deserialize` is that they would work for JSON, but also Avro.

## Option<T>, no nulls!

In Rust, there is no such thing as `null`. Everything which not return a result is already an `Option` which is a great design decision by the Rust team!

To convert an `Option<T>` to an `Result<T, E>`, it is also pretty easy:

```rust
self.subject_find(&subject).await?.ok_or(AppError::SubjectNotFound(subject.clone()))?;
```

By using `ok_or`, we either return the result or short-circuit with an `AppError::SubjectNotFound`. This is similar to combinators found in cats-effect and ZIO which makes the code pretty concise.

## Axum

[axum](https://github.com/tokio-rs/axum) is a web application framework that focuses on ergonomics and modularity.

- Route requests to handlers with a macro free API.
- Declaratively parse requests using extractors.
- Simple and predictable error handling model.
- Generate responses with minimal boilerplate.
- Take full advantage of the tower and tower-http ecosystem of middleware, services, and utilities.

Axum feels like using a different version http4s. The extractor is a concept that is also known in Scala and http4s. It's easy to define an HTTP handler with multiple path segments, query parameters and a JSON body extractor. Like in this line of code:

```rust
async fn register_schema(Path(subject): Path<String>, body: Json<SchemaPayload>) -> Result<Json<RegisterSchemaResponse>, AppError>;
```

It's registered with a route and after that, the routes are lifted into the server where you can define _how to_ run the server. This is similar to what http4s does.

```rust
let app = Router::new()
    .route("/subjects/:subject/versions", post(register_schema))
    .with_state(service);

axum::Server::bind(&"0.0.0.0:8888".parse().unwrap())
    .serve(app.into_make_service())
    .await
    .unwrap();
```

Using an `AppError` enum which lifts all the specific errors from libraries like _avro_ and _sqlx_ into a generic error and translates them to an HTTP response when they occur.

```rust
pub enum AppError {
    DatabaseError(SqlxError),
    AvroError(AvroError)
    // ... rest is omitted
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::DatabaseError(error) =>
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error_code: 50001, message: error.to_string() })).into_response(),
            AppError::AvroError(error) =>
                (StatusCode::UNPROCESSABLE_ENTITY, Json(ApiError { error_code: 42201, message: error.to_string() })).into_response()
        }
    }
}
```

## Sqlx

[SQLx](https://github.com/launchbadge/sqlx) is an async, pure Rust SQL crate featuring compile-time checked queries without a DSL.

- Truly Asynchronous. Built from the ground up using async/await for maximum concurrency.
- Compile-time checked queries (if you want). See SQLx is not an ORM.
- Database Agnostic. Support for PostgreSQL, MySQL, SQLite, and MSSQL.
- Pure Rust. The Postgres and MySQL/MariaDB drivers are written in pure Rust using zero unsafe code.
- Runtime Agnostic. Works on different runtimes (async-std / tokio / actix) and TLS backends (native-tls, rustls).

SQLx has similar features to Doobie. It is not an ORM like Doobie, it supports multiple SQL databases like Doobie and it can check your queries like also in Doobie.

The compile-time checked query is a feature that is not in Doobie, but Doobie offers type-checking queries which come close to this. I would say that compile-time checked queries are better, because you need to solve any issues directly while a test is maybe not written.

While Doobie uses JDBC (a blocking Java API), SQLx is built from the ground up to be async for maximum concurrency.

## Tokio

[Tokio](https://tokio.rs/) is an event-driven, non-blocking I/O platform for writing asynchronous applications with the Rust programming language. At a high level, it provides a few major components:

- Tools for working with asynchronous tasks, including synchronization primitives and channels and timeouts, sleeps, and intervals.
- APIs for performing asynchronous I/O, including TCP and UDP sockets, filesystem operations, and process and signal management.
- A runtime for executing asynchronous code, including a task scheduler, an I/O driver backed by the operating system’s event queue (epoll, kqueue, IOCP, etc…), and a high performance timer.

ZIO and cats-effect also offer green threads and similar runtimes with support for TCP/UDP sockets and filesystem operations which are non-blocking. Tokio does not offer a Stream API like `zio-streams` or `fs2`, but async iterators. I haven't explored async iterators yet, but it's something else than the declarative nature of `zio-streams` and `fs2` I would assume.

Also, ZIO offers Software Transactional Memory (STM) which is compositional concurrency, which is not offered by Tokio. Other crates offer this, but they seem not to be so popular.

I think both ZIO and cats-effect are a bit more expressive/declarative than Tokio, but Tokio is a great foundation as an async runtime

## Performance

Using [hey](https://github.com/rakyll/hey) to benchmark the performance of my API by calling `GET http://localhost:8888/subjects` the results were oke. I ran **100k requests** with **100 concurrent users**. It resulted in **~9300 request/second**. The REST API was running a connection pool with 100 connections, which matches the 100 concurrent users.

I think with a bit of tweaking you could get better results, but I would say so far it's pretty oke.

```
hey -n 100000 -c 100 http://localhost:8888/subjects

Summary:
  Total:	10.7420 secs
  Slowest:	0.1062 secs
  Fastest:	0.0005 secs
  Average:	0.0214 secs
  Requests/sec:	9309.2445

  Total data:	199856 bytes
  Size/request:	2 bytes
```

The docker stats are impressive, **idle 15 mb** memory usage and under **load 45 mb**. The size of the docker image is also pretty small. Only **30 mb**, but I think it can be smaller by using a different base image?

## Testing

So far I didn't touch testing yet, but as for each design segregating certain dependencies and test parts in isolation is usually the way I like to roll. On top of that some blackbox/smoke/integration tests. But can't tell you anything about that for now!

## Conclusion

I liked writing a REST API in Rust, the DX was pretty good. I didn't get to cryptic errors and the SQLx compile-time queries feature rocks. Also `Result<T, E>` + async and several combinators make writing business logic pretty concise.
The performance is staggering, with almost no memory usage compared to JVM-based API's and good throughput!

A nice experience, I am curious if enterprises pick up Rust. It's harder to learn and at the moment harder to find good developers, but the performance is nice and it has a strong type system.
