---
pubDate: "2021-08-09"
banner: "/img/blog/owl.jpg"
title: "Using oracles to test the service and data layer"
description: "Getting rid of mocks in your service layer tests and test your database for real"
---

## Motivation

A common architectural style is the 3-layer model (data, service, and API/view layer) for writing web services. With this style, the data layer is tested with unit tests, H2 database or not. The service layer is tested with mocks, where the calls to the database are emulated.

The approach with the data layer has some downsides. Inserting, updating, and reading things can be seen as encoding/decoding data from a medium. As you might like encoding and decoding JSON, decoding might go wrong. When working with databases, schema changes might cause decode errors when you do not update your domain model. Or when you introduce a new enum member it might that the database cannot store this yet. To assert that we have symmetric encoding and decoding effects, we can use property-based tests. Also if you use Postgres and H2 for testing, there might be discrepancies like H2 doesn't have PostGIS or other unsupported features.

The approach with the service layer has some downsides, What if the behavior of the repository method changes over time or the emulated repository method is invalid? You'll test with the wrong assumptions and you might introduce bugs.

## A solution

To tackle both pitfalls we can use oracles and model-based testing which are according to [F# for fun and profit](https://fsharpforfunandprofit.com/posts/property-based-testing-2/#model-based-testing):

> The way it works is that, in parallel with your (complex) system under test, you create a simplified model. Then, when you do something to the system under test, you do the same (but simplified) thing to your model. In the end, you compare your model’s state with the state of the system under test. If they are the same, you’re done.

In our case, we use a mirror implementation of the interface. When working with the data layer, we have a real database implementation and an in-memory implementation. The in-memory implementation can be used as an _oracle_. The oracle can also be used in _both_ testing the data and service layer. In the data layer tests, the oracle is used to verify that the in-memory variant mirrors the behavior of the database and in the service layer tests we use the oracle to mock the database.

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
final case class Septic[D, A] private (db: State[D, A]) {
  def run(state: D): A = db.runA(state).value
}

object Septic {
  def all[D, A](at: Lens[D, List[A]]): Septic[D, List[A]] =
    Septic(State.get.map(at.get))

  def insertMany[D, A](at: Lens[D, List[A]])(elements: List[A]): Septic[D, Long] =
    insertMany_(at)(elements).size

  def insertMany_[D, A](at: Lens[D, List[A]])(elements: List[A]): Septic[D, List[A]] =
    Septic(State.modify[D](s => at.modify(_ ++ elements)(s)) *> State.pure(elements))

  def insert[D, A](at: Lens[D, List[A]])(element: A): Septic[D, Long] =
    insertMany(at)(List(element))

  def delete[D, A](at: Lens[D, List[A]])(filter: A => Boolean): Septic[D, Long] =
    delete_(at)(filter).size

  def delete_[D, A](at: Lens[D, List[A]])(filter: A => Boolean): Septic[D, List[A]] =
    Septic {
      for {
        elements <- State.get[D]
        (toDelete, toKeep) = at.get(elements).partition(filter)
        _ <- State.modify[D](s => at.modify(_ => toKeep)(s))
      } yield toDelete
    }
}
```

The first thing to note is that we create a new type (in Scala 3 we could use opaque types) called `Septic` wrapping a `State` monad which has constrained combinators. The nice thing about these general combinators is:

- They infer the `Septic` type when you supply it the `Lens[D, List[A]]`
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

object SepticPersonRepository extends PersonRepository[Septic[Universe, *]] {
  def insertMany(persons: List[Person]): Septic[Universe, Long] =
    Septic.insertMany(Universe.persons)(persons)

  def deleteWhenOlderThen(age: Long): Septic[Universe, Long] =
    Septic.delete(Universe.persons)(_.age > age)

  def listAll(): Septic[Universe, List[Person]] =
    Septic.all(Universe.persons)
}
```

### Testing our in-memory and data layer implementation

As stated before, if we want to assert that our data layer is right we need to run for example a database program (like an insert and read) in parallel. This is where `SemigroupalK` comes into play.

In my proof of concept library I've created a `Harnass`:

```scala
class Harnass[Alg[_[_]], F[_], Tx[_], D](initState: D, db: Alg[Tx], model: Alg[Septic[D, *]], tx: Tx ~> F) {

  // create a effect type which is higher kinded tuple which has the doobie version and Septic version
  type Eff[A] = Tuple2K[Tx, Septic[D, *], A]
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
        //we run the state monad and get the value
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
- `D` is the state type used for `Septic`, in our case, this is `Universe`

Like stated before, it creates out of `SemigroupalK[Alg]` a higher-kinded paired version. So we combine two interpreters of `PersonRepository`, like: `PersonRepository[ConnnectionIO]` and `PersonRepository[Septic[Universe, *]]` into a `PersonRepository[Tuple2K[ConnectionIO, Septic[Universe, *], *]]`.

A few tests in my proof of concept look like this:

```scala
  def harnass: Harnass[PersonRepository, IO, ConnectionIO, Universe] =
    new Harnass(Universe.zero, DoobiePersonRepository, SepticPersonRepository, xa.trans)

  "PersonRepository" should {
    "should insert and read" in {
      prop { persons: List[Person] =>
        assertMirroring {
          harnass.model.eval { x =>
              x.insertMany(persons) *>
              x.listAll()
          }
        }
      }
    }

    "should delete people older then" in {
      prop { (persons: List[Person], age: Int) =>
        assertMirroring {
          harnass.model.eval { x =>
              x.insertMany(persons) *>
              x.deleteWhenOlderThen(age) *>
              x.listAll()
          }
        }
      }
    }
  }
```

In this case, we use specs2 with scalacheck to do property-based testing. We ask scalacheck to generate arbitrary lists of `Person` instances and run our database program by using `harnass.model.eval`. This is wrapped by `assertMirroring` is a little helper method that asserts that the values in the returned tuple are equal.

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

Now comes the trick. When you use it in production, you'll use the `DoobieXXX` version and when you _unit test_ your service methods, you use the `SepticXXX` versions which are asserted to be equal to the `DoobieXXX` versions.

## Conclusion

I hope this article gave you insight into how to test your data layer and have better service layer tests as well.

By using the oracle we solve a few problems

- In the data layer tests, we test with the real database without making the database dirty by using rollback on each `ConnectionIO`
- We assert encoding/decoding symmetry from our domain model. You might miss out on decoding existing entries in the database though.
- In the service layer tests, we don't use mocks, but in-memory variants which mirror the behavior of the real implementation asserted in the data layer tests

I've actually coded the `Septic` thing into a repository and you can find it up [here](https://github.com/Fristi/septic/). It's a proof of concept, but I've used this methodology at DHL Netherlands. It needs some work on testing all the combinators at `Septic`. If someone wants to continue the work release this to Maven Central go ahead. It would be great to mention my work if you do.
