---
pubDate: "2021-08-09"
banner: "/img/blog/owl.jpg"
title: "Using oracles to test the service and data layer"
description: "Getting rid of mocks in your service layer tests and test your database for real"
---

## Motivation

A common architectural style is the 3-layer model (data, service, and API/view layer) for writing web services. With this style, the data layer is tested with unit tests — often against an H2 in-memory database — and the service layer is tested with mocks, where calls to the database are emulated.

Both approaches have problems.

**Data layer tests** treat inserting and reading as encoding/decoding data. Schema changes, new enum members, or Postgres-specific features (like PostGIS) can all cause failures that H2 won't catch. And when you write property-based tests directly against the repository, you end up re-implementing its logic in your assertions:

```scala
prop { (persons: List[Person], age: Int) =>
  repo.insertMany(persons)
  repo.deleteWhenOlderThan(age)
  val remaining = repo.listAll()

  // Re-implementing the repository's filter logic right here in the test
  remaining must_== persons.filter(_.age <= age)
}
```

This is fragile. If your assertion has an off-by-one error or uses the wrong comparison operator, the test is worthless — and you won't know it. You've encoded your expectations twice, and you're hoping they match.

**Service layer tests** have a different problem: what if the behavior of the mocked repository method changes over time, or the mock is simply wrong? You'll test with incorrect assumptions and introduce bugs.

## A solution

### Make the expectations an executable model

Instead of scattering filtering logic across assertions, move it into a proper in-memory implementation of the same algebra. This model is trivially simple — just list operations on a case class — so it's easy to get right. Then run the same operations against both the real implementation and the model, and compare results.

This is the **test oracle pattern**: you don't assert _what_ the result should be, you assert that two implementations _agree_.

```
  Generate random data
            │
    ┌───────┴───────┐
    ▼               ▼
 ┌──────┐     ┌──────────┐
 │ Real │     │ In-memory│
 │ impl │     │  model   │
 │ (DB) │     │ (Mirra)  │
 └──┬───┘     └────┬─────┘
    │              │
    ▼              ▼
  result₁ ═══ result₂ ?
```

If they diverge, either the real implementation has a bug, or the model is wrong — both of which are valuable to discover.

### Why this also helps your service tests

Once you've proven the in-memory model is faithful to the real implementation, you can use that model as a drop-in replacement in your service-layer unit tests. No database, no containers, no network — just fast, deterministic tests that you _know_ are behaviorally accurate, because the model has been validated against the real thing.

This is much better than mocks: a mock returns whatever you tell it to, even outputs the real implementation would never produce for a given input. A validated in-memory model can't lie that way.

## How it works

1. **Define** a tagless final algebra for your repository.
2. **Implement** it for real — against a database, HTTP API, etc.
3. **Model** it with `Mirra[S, *]`, a specialized `State` monad with built-in CRUD helpers (`insertMany`, `delete`, `all`, etc.) that operate over a simple in-memory state `S` using Monocle lenses.
4. **Wire** both into a `Harness`, which uses `FunctorK` / `SemigroupalK` (from cats-tagless) to run the same program against both interpreters.
5. **Assert mirroring** — for any randomly generated input, both must produce the same result.

## Step-by-step example

We work with a functional Scala stack: Doobie for the real database implementation and Cats Effect / ZIO for the service layer.

### 1. Define the algebra

```scala
final case class Person(id: UUID, name: String, age: Int)

trait PersonRepository[F[_]] {
  def insertMany(persons: List[Person]): F[Long]
  def deleteWhenOlderThan(age: Long): F[Long]
  def listAll(): F[List[Person]]
}

object PersonRepository {
  implicit val functorK: FunctorK[PersonRepository] = Derive.functorK
  implicit val semigroupalK: SemigroupalK[PersonRepository] = Derive.semigroupalK
}
```

`FunctorK` lets you transform the effect type of the algebra. `SemigroupalK` lets you run two interpreters in parallel through the same algebra — the key ingredient for the oracle harness.

### 2. Write the in-memory model

Define a "universe" case class that represents your in-memory database state, then implement the algebra using Mirra's CRUD helpers and Monocle lenses.

```scala
@Lenses
final case class Universe(persons: List[Person])

object Universe {
  def zero: Universe = Universe(Nil)
}

object InMemoryPersonRepository extends PersonRepository[Mirra[Universe, *]] {
  def insertMany(persons: List[Person]): Mirra[Universe, Long] =
    Mirra.insertMany(Universe.persons)(persons)

  def deleteWhenOlderThan(age: Long): Mirra[Universe, Long] =
    Mirra.delete(Universe.persons)(_.age > age)

  def listAll(): Mirra[Universe, List[Person]] =
    Mirra.all(Universe.persons)
}
```

This is your model — the single source of truth for expected behavior. It's so simple (append to a list, filter a list, return a list) that it's hard to get wrong.

### 3. Write the real implementation

```scala
object DoobiePersonRepository extends PersonRepository[ConnectionIO] {

  object queries {
    def deleteWhenOlderThan(age: Long): Update0 =
      fr"delete from persons where age > $age".update

    def listAll: Query0[Person] =
      fr"select id, name, age from persons".query[Person]
  }

  def insertMany(persons: List[Person]): ConnectionIO[Long] =
    Update[Person]("insert into persons (id, name, age) values (?, ?, ?)")
      .updateMany(persons).map(_.toLong)

  def deleteWhenOlderThan(age: Long): ConnectionIO[Long] =
    queries.deleteWhenOlderThan(age).run.map(_.toLong)

  def listAll(): ConnectionIO[List[Person]] =
    queries.listAll.to[List]
}
```

We implement `PersonRepository` in terms of `ConnectionIO` so operations are transactional and can be rolled back after each test, leaving the database clean.

### 4. Mirror-test them

```scala
def harness: Harness[PersonRepository, IO, ConnectionIO, Universe] =
  new Harness(Universe.zero, DoobiePersonRepository, InMemoryPersonRepository, xa.trans)

"PersonRepository" should {

  "not lose data on insert → read" in {
    prop { persons: List[Person] =>
      assertMirroring {
        harness.model.eval { x =>
          x.insertMany(persons) *>
          x.listAll()
        }
      }
    }
  }

  "delete only people older than the threshold" in {
    prop { (persons: List[Person], age: Int) =>
      assertMirroring {
        harness.model.eval { x =>
          x.insertMany(persons) *>
          x.deleteWhenOlderThan(age) *>
          x.listAll()
        }
      }
    }
  }
}
```

Notice there's no assertion logic about _what_ the result should be — no filtering, no manual comparison. ScalaCheck generates the inputs, the harness runs both implementations, and `assertMirroring` fails the test if the outputs diverge.

### Using the oracle in service layer tests

With the in-memory model validated against the real database, you can wire it directly into your service layer tests. Here's a ZIO service that uses a `Pg` environment:

```scala
object PersonService {
  def deletePersonsOlderThen(age: Int): RIO[Pg, Unit] =
    for {
      _ <- ZIO.when(age < 0)(ZIO.fail(AppError.InvalidAge))
      _ <- Pg.query(_.persons.deleteWhenOlderThen(age))
    } yield ()
}
```

In production, `Pg` is backed by `DoobiePersonRepository`. In unit tests, swap it for `InMemoryPersonRepository` — the one you've already proven mirrors the real thing. No mocks, no guesswork.

## Key concepts

**`Mirra[S, A]`** — A `State`-like monad with built-in helpers for modeling CRUD operations (`insertMany`, `delete`, `all`, etc.). Uses Monocle lenses to target collections within your state type `S`. This is where your expected behavior lives — in one place, as a real implementation, not scattered across test assertions.

**`Harness[Alg, F, G, S]`** — Wires together a real implementation (`Alg[G]`) and a model (`Alg[Mirra[S, *]]`), using `FunctorK` / `SemigroupalK` to run both through the same algebra and compare results.

**`assertMirroring`** — Executes the program against both interpreters, diffs the results, and fails the test if they diverge.

**`FunctorK` / `SemigroupalK`** — Type classes from [cats-tagless](https://github.com/typelevel/cats-tagless) that allow transforming the effect type of an algebra. These are what make it possible to run a single program against two different interpreters, derived automatically with `Derive.functorK` / `Derive.semigroupalK`.

## Conclusion

By using the oracle pattern we solve a few problems at once:

- Data layer tests run against a real database without dirtying it — each `ConnectionIO` is rolled back.
- Encoding/decoding symmetry is verified from the domain model to the database and back.
- Service layer tests use an in-memory model that has been proven to mirror the real implementation — no mocks that can silently lie.

I've coded the `Mirra` library and you can find it [here](https://github.com/Fristi/mirra). It's a proof of concept, but I've used this methodology in production. Note that the project is not actively maintained, but it remains a useful reference or starting point for anyone who wants to adopt this pattern.
