---
pubDate: "2021-08-09"
banner: "/img/blog/owl.jpg"
title: "Using oracles to test the service and data layer"
description: "Getting rid of mocks in your service layer tests and test your database for real"
---

## Motivation

A common architectural style is the 3-layer model (data, service, and API/view layer) for writing web services. With this style, the data layer is tested with unit tests — often against an H2 in-memory database — and the service layer is tested with mocks, where calls to the database are emulated.

Both approaches have problems.

**Data layer tests** treat inserting and reading as encoding/decoding data. Schema changes, new enum members, or Postgres-specific features (like PostGIS) can all cause failures that H2 won’t catch. And when you write property-based tests directly against the repository, you end up re-implementing its logic in your assertions:

```scala
prop { (persons: List[Person], age: Int) =>
  repo.insertMany(persons)
  repo.deleteWhenOlderThan(age)
  val remaining = repo.listAll()

  // Re-implementing the repository’s filter logic right here in the test
  remaining must_== persons.filter(_.age <= age)
}
```

This is fragile. If your assertion has an off-by-one error or uses the wrong comparison operator, the test is worthless — and you won’t know it. You’ve encoded your expectations twice, and you’re hoping they match.

**Service layer tests** have a different problem: what if the behavior of the mocked repository method changes over time, or the mock is simply wrong? You’ll test with incorrect assumptions and introduce bugs.

## A solution

### The solution: make the expectations an executable model

Instead of scattering filtering logic across assertions, move it into a proper in-memory implementation of the same algebra. This model is trivially simple — just list operations on a case class — so it’s easy to get right. Then run the same operations against both the real implementation and the model, and compare results.

This is the **test oracle pattern**: you don’t assert _what_ the result should be, you assert that two implementations _agree_.

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

Once you’ve proven the in-memory model is faithful to the real implementation, you can use that model as a drop-in replacement in your service-layer unit tests. No database, no containers, no network — just fast, deterministic tests that you know are behaviorally accurate, because the model has been validated against the real thing.

This is much better than mocks: a mock returns whatever you tell it to, even outputs the real implementation would never produce for a given input. A validated in-memory model can’t lie that way.

In this case, we work with a functional scala tech stack: Doobie and ZIO. We use ZIO mainly in the upper layers like the service layer and API layer to handle side effects.

## The data layer

### Coding a repository interface

When coding a repository in Scala you can choose to commit to an effect type like `cats.effect.IO`, `scala.concurrent.Future` or `zio.Task` from the start. However, this also has downsides.

- What if you would like to compose several methods?
- In testing evaluating the effect of an effect type like `zio.Task` has an immediate effect leaving a dirty database that can interfere with other tests

When you use doobie you could use `ConnectionIO` or if you use slick `DBIO` to implement these repositories in terms of the effect type which is transactional and can be rolled back. This means you can compose multiple repository methods like inserting and reading an entity while rolling back the whole operation, and leaving the database clean while you have tested the behavior.

A repository interface could look like this:

```scala
final case class Person(id: UUID, name: String, age: Int)

trait PersonRepository[F[_]] {
  def insertMany(persons: List[Person]): F[Long]
  def deleteWhenOlderThen(age: Long): F[Long]
  def listAll(): F[List[Person]]
}


object PersonRepository {
  implicit val functorK: FunctorK[PersonRepository] = Derive.functorK
  implicit val semigroupalK: SemigroupalK[PersonRepository] = Derive.semigroupalK
}
```

We use `FunctorK` and `SemigroupalK` here, which are explained on the [cats-tagless documentation](https://typelevel.org/cats-tagless/). In essence, they give you functions that allow you to transform the interface in interesting ways. Like with `FunctorK` we can transform the effect type and with `SemigroupalK` we can execute two interpreters at the same time which is needed for our data layer testing.

### Coding a repository database implementation

When it comes to coding a doobie implementation it is pretty straightforward. We implement `PersonRepository` in terms of `ConnectionIO`.

One thing to note is that we separate out the queries from the interface. By doing this we can test queries later with the doobie-specs2 package which allows you to test the syntax of queries.

```scala
object DoobiePersonRepository extends PersonRepository[ConnectionIO] {

  object queries {
    def deleteWhenOlderThen(age: Long): Update0 =
      fr"delete from persons where age > $age".update

    def listAll: Query0[Person] =
      fr"select id, name, age from persons".query[Person]
  }

  def insertMany(persons: List[Person]): ConnectionIO[Long] =
    Update[Person]("insert into persons (id, name, age) values (?, ?, ?)").updateMany(persons).map(_.toLong)

  def deleteWhenOlderThen(age: Long): ConnectionIO[Long] =
    queries.deleteWhenOlderThen(age).run.map(_.toLong)

  def listAll(): ConnectionIO[List[Person]] =
    queries.listAll.to[List]
}
```

### Coding a repository in-memory implementation

To code an in-memory implementation we would like to emulate a database and its operations. How you could do that?

- A database can be emulated by using a case class that has fields and where each field is a table in the database. Each field should be a `List[A]`. If every field is a `List[A]` you could potentially derive a `Monoid` for free.
- We need a common set of combinators that allow you to query and mutate.

The first part is simple, we could for example create a case class that will hold our state of the database like this.

```scala
case class Universe(persons: List[Person])
```

Now to query or mutate we need to emulate the behavior of transaction as well, but also when we want to query the database we need to have access to the whole `Universe`.

In functional programming luckily we have the `State` monad which is perfect for this. If the repository is implemented in terms of `State[Universe, *]` we can chain together multiple mutations to form a transaction as well if a query is weaved inside the transaction it will work, because the internal state is updated.

To write universal combinators we need setters to mutate the `Universe` structure and getters to query the `Universe` structure. In functional programming, we also have an abstraction for this: lenses. In this case, I'll use the excellent library Monocle. When you annotate your `Universe` case class with the `@Lenses` annotation, Monocle will automatically generate lenses on the companion object of `Universe`. In this case, we will have a lens defined `Universe.persons` which is of type `Lens[Universe, List[Person]]`.

Now with all the ingredients we can start writing our first combinators:

```scala
final case class Mirra[D, A] private (db: State[D, A]) {
  def run(state: D): A = db.runA(state).value
}

object Mirra {
  def all[D, A](at: Lens[D, List[A]]): Mirra[D, List[A]] =
    Mirra(State.get.map(at.get))

  def insertMany[D, A](at: Lens[D, List[A]])(elements: List[A]): Mirra[D, Long] =
    insertMany_(at)(elements).size

  def insertMany_[D, A](at: Lens[D, List[A]])(elements: List[A]): Mirra[D, List[A]] =
    Mirra(State.modify[D](s => at.modify(_ ++ elements)(s)) *> State.pure(elements))

  def insert[D, A](at: Lens[D, List[A]])(element: A): Mirra[D, Long] =
    insertMany(at)(List(element))

  def delete[D, A](at: Lens[D, List[A]])(filter: A => Boolean): Mirra[D, Long] =
    delete_(at)(filter).size

  def delete_[D, A](at: Lens[D, List[A]])(filter: A => Boolean): Mirra[D, List[A]] =
    Mirra {
      for {
        elements <- State.get[D]
        (toDelete, toKeep) = at.get(elements).partition(filter)
        _ <- State.modify[D](s => at.modify(_ => toKeep)(s))
      } yield toDelete
    }
}
```

The first thing to note is that we create a new type (in Scala 3 we could use opaque types) called `Mirra` wrapping a `State` monad which has constrained combinators. The nice thing about these general combinators is:

- They infer the `Mirra` type when you supply it the `Lens[D, List[A]]`
- When used with an atomic reference, you could even use the implementation to a bootup server and use it locally for testing for example

With these combinators, we can code our `PersonRepository`:

```scala
@Lenses
final case class Universe(
  persons: List[Person]
)

object Universe {
  def zero: Universe = Universe(Nil)
}

object MirraPersonRepository extends PersonRepository[Mirra[Universe, *]] {
  def insertMany(persons: List[Person]): Mirra[Universe, Long] =
    Mirra.insertMany(Universe.persons)(persons)

  def deleteWhenOlderThen(age: Long): Mirra[Universe, Long] =
    Mirra.delete(Universe.persons)(_.age > age)

  def listAll(): Mirra[Universe, List[Person]] =
    Mirra.all(Universe.persons)
}
```

### Testing our in-memory and data layer implementation

As stated before, if we want to assert that our data layer is right we need to run for example a database program (like an insert and read) in parallel. This is where `SemigroupalK` comes into play.

In my proof of concept library I've created a `Harness`:

```scala
class Harness[Alg[_[_]], F[_], Tx[_], D](initState: D, db: Alg[Tx], model: Alg[Mirra[D, *]], tx: Tx ~> F) {

  // create a effect type which is higher kinded tuple which has the doobie version and Mirra version
  type Eff[A] = Tuple2K[Tx, Mirra[D, *], A]
  // set the effect type of the repository interface
  type Paired = Alg[Eff]

  // a eval function which uses the Paired and returns a `F[(A,A)]`
  trait Evaluator {
    def eval[A](f: Paired => Eff[A]): F[(A, A)]
  }

  def model(implicit S: SemigroupalK[Alg], F: Functor[F]): Evaluator = {
    val paired: Paired = S.productK(db, model)
    new Evaluator {
      override def eval[A](f: Paired => Eff[A]): F[(A, A)] = {
        //here we get the `Tuple2K` from `f`
        val effectTuple: Eff[A] = f(paired)
        //we run the connection against a rollback transactor, and get the result
        val dbValue: F[A] = tx(effectTuple.first)
        //we run the Mirra state monad and get the value
        val stateValue: A = effectTuple.second.run(initState)

        dbValue.map(_ -> stateValue)
      }
    }
  }
}
```

Don't be daunted by the generic parameters. I'll go quickly over them:

- `Alg` is the repository type `PersonRepository` in our case
- `F` is the effect type like `cats.effect.IO`
- `Tx` is the transaction type, this is `ConnectionIO` from Doobie
- `D` is the state type used for `Mirra`, in our case, this is `Universe`

Like stated before, it creates out of `SemigroupalK[Alg]` a higher-kinded paired version. So we combine two interpreters of `PersonRepository`, like: `PersonRepository[ConnnectionIO]` and `PersonRepository[Mirra[Universe, *]]` into a `PersonRepository[Tuple2K[ConnectionIO, Mirra[Universe, *], *]]`.

A few tests in my proof of concept look like this:

```scala
  def harness: Harness[PersonRepository, IO, ConnectionIO, Universe] =
    new Harness(Universe.zero, DoobiePersonRepository, MirraPersonRepository, xa.trans)

  "PersonRepository" should {
    "should insert and read" in {
      prop { persons: List[Person] =>
        assertMirroring {
          harness.model.eval { x =>
              x.insertMany(persons) *>
              x.listAll()
          }
        }
      }
    }

    "should delete people older then" in {
      prop { (persons: List[Person], age: Int) =>
        assertMirroring {
          harness.model.eval { x =>
              x.insertMany(persons) *>
              x.deleteWhenOlderThen(age) *>
              x.listAll()
          }
        }
      }
    }
  }
```

In this case, we use specs2 with scalacheck to do property-based testing. We ask scalacheck to generate arbitrary lists of `Person` instances and run our database program by using `harness.model.eval`. This is wrapped by `assertMirroring` is a little helper method that asserts that the values in the returned tuple are equal.

The `*>` can be read as followed. Alternatively you could also write a for comprehension if that is easier for you. Another nice thing to note is that we can configure the `Transactor[IO]` to be a rollback transactor by setting `always` on the strategy to `connection.rollback *> connection.close`

### Using the Oracle in service layer tests

As stated before we use ZIO for our service layer. When writing flows you can just put them on objects for example like this:

```scala

object PersonService {
  def deletePersonsOlderThen(age: Int): RIO[Pg, Unit] =
    for {
      _ <- ZIO.when(age < 0)(ZIO.fail(AppError.InvalidAge))
      _ <- Pg.query(_.persons.deleteWhenOlderThen(age))
    } yield ()
}
```

The nice thing about doing this is that you don't have problems with circular dependencies as the dependencies are residing in the `RIO` effect type offered by ZIO as you can read [here](https://zio.dev/docs/datatypes/contextual/).

I don't like to assert invariants in the API layer, as it's harder to test and the API layer its concern is to decode incoming requests and encode responses. In this case, the invariant is that the age should be greater than zero. When it's smaller we use `ZIO.fail` to stop the program and exit with the `AppError.InvalidAge`. After that, we use the data layer by using the `Pg` service.

In this case, we require the `Pg` service which I like to define like this:

```scala
trait PostgresRepos[F[_]] {
  def persons: PersonRepository[F]
}

object PostgresRepos {
  implicit val functorK: FunctorK[PostgresRepos] = Derive.functorK
}

object Pg {

  trait Service {
    // This is `ConnectionIO` in production.
    type ConnIO[A]

    // Collection of all the `ConnectionIO` based repositories
    protected val postgresReposConnIO: PostgresRepos[ConnIO]

    // The natural transformation which transforms `ConnectionIO` to a `Task`
    protected val transTask: ConnIO ~> Task

    lazy val postgresReposTask: PostgresRepos[Task] =
      postgresReposConnIO.mapK(transTask)

    def query[A](f: PostgresRepos[Task] => Task[A]): Task[A] =
      f(postgresReposTask)
  }

  def query[A](f: PostgresRepos[Task] => Task[A]): Eff[Pg, A] =
    ZIO.accessM(_.get.query(f).mapError(err => AppError.Unexpected(err)))
}
```

The query accessor method has access to `PostgresRepos` which is a trait that is a collection of all the repositories.

Now comes the trick. When you use it in production, you'll use the `DoobieXXX` version and when you _unit test_ your service methods, you use the `MirraXXX` versions which are asserted to be equal to the `DoobieXXX` versions.

## Conclusion

I hope this article gave you insight into how to test your data layer and have better service layer tests as well.

By using the oracle we solve a few problems

- In the data layer tests, we test with the real database without making the database dirty by using rollback on each `ConnectionIO`
- We assert encoding/decoding symmetry from our domain model. You might miss out on decoding existing entries in the database though.
- In the service layer tests, we don't use mocks, but in-memory variants which mirror the behavior of the real implementation asserted in the data layer tests

I've actually coded the `Mirra` library and you can find it [here](https://github.com/Fristi/mirra). It's a proof of concept, but I've used this methodology at DHL Netherlands. Note that the project is not actively maintained, but it remains a useful reference or starting point for anyone who wants to adopt this pattern.
