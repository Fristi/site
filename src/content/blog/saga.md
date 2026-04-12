---
pubDate: "2018-08-10"
banner: "/img/blog/banner_saga.jpg"
title: "Saga, compensate for failures in a terse and composable way"
description: "This blog post is about Sagas, a pattern for managing failures."
---

# Motivation for a `Saga`

Imagine you want to book a trip that includes a car, a hotel and a flight. If something cannot be booked, why would you bother going? If we would build this in Scala it would probably involve calling some external APIs. These APIs can go down, what happens if one of these APIs is down?

![Saga: example of a process that can fail, but takes failure into account](/img/blog/saga.png)

You could use `recover` to execute a _compensating_ action (an action that reverses the side-effect), but it will only work with _one_ action. Of course, you could apply this to all your actions, but this will get messy because you need to keep track of your compensating actions.

# How to describe that nicely?

To describe a program that can handle failure you need to couple the outcome of a successful action to its compensating action.

## A real-world example: booking a trip

Going back to our travel booking scenario, here is how you would express it using `volatile-saga`:

```scala
import cats.effect.IO
import volatilesaga._

def bookTrip(flight: FlightReq, hotel: HotelReq, car: CarReq): Saga[IO, Booking] =
  for {
    f <- Saga.recoverable(flightApi.book(flight))(ref => flightApi.cancel(ref.id))
    h <- Saga.recoverable(hotelApi.book(hotel))(ref => hotelApi.cancel(ref.id))
    c <- Saga.recoverable(carApi.book(car))(ref => carApi.cancel(ref.id))
  } yield Booking(f, h, c)
```

If `carApi.book` fails, the saga automatically cancels the hotel and flight reservations in reverse order — no manual try/catch nesting required.

## A rollback example

```scala
import cats.effect.IO
import cats.implicits._
import cats.effect.Ref
import volatilesaga._
import scala.util.control.NonFatal

def prg(ref: Ref[IO, Int]): Saga[IO, Unit] = for {
  _ <- Saga.recoverable(ref.tryUpdate(_ + 1))(_ => ref.tryUpdate(_ - 1) *> IO.unit).replicateA(500)
  _ <- Saga.recoverable(ref.tryUpdate(_ + 1))(_ => ref.tryUpdate(_ - 1) *> IO.unit).replicateA(500)
  _ <- Saga.nonRecoverable[IO, Nothing](IO.raiseError(new Throwable("Error")))
} yield ()

def main: IO[Int] = for {
  ref <- Ref.of[IO, Int](0)
  _ <- prg(ref).run.recoverWith { case NonFatal(_) => IO.unit }
  current <- ref.get
} yield current
```

The outcome of the main function will be zero, as the `prg` will crash at the end. The first action will increase the `Ref[IO, Int]` to 500 and the second action by another 500, but since it crashes the compensating actions will roll it back to 0.

## The importance of lazy evaluation

The compensating action needs to be a _description_ of an action. A description means, that it is _not_ executed immediately (lazy evaluation) and it may be a side effect. This is called a computation in functional programming. The opposite of lazy evaluation is eager evaluation. An example of a type that is eager is `Future` and `Try`.

## Couple success with compensation

In my `Saga` the signature of the _recoverable_ combinator is defined as:

```scala
def recoverable[F[_] : Sync, A](comp: F[A])(rollback: A => F[Unit]): Saga[F, A]
```

The type class `Sync` constraint on `F[_]` is to enforce a type that supports lazy evaluation. The thing we need for our description of a `Saga`. The function itself takes two arguments, an actual `comp` (short for computation) which is the _do_ action, and the rollback which uses the outcome of the _do_ action to construct a rollback/compensating action.

### Saga, a specialized `Free` Monad

As you can it returns a `Saga[F, A]`. A `Saga` itself is a description of several computations. It's a slightly altered variant of a Free Monad:

```scala
case class Pure[F[_], A](action: A) extends Saga[F, A]
case class Next[F[_], A](action: F[A], compensate: A => F[Unit]) extends Saga[F, A]
case class Bind[F[_], A, B](fa: Saga[F, A], f: A => Saga[F, B]) extends Saga[F, B]
```

The `Pure` and `Bind` are descriptions of operations that you'll find on a `Monad` as well. The `Next` case, however, is not. This will store the parameters of the `recoverable` method as is for later evaluation.

This data is interpreted by the `decide` method on `Saga`, which looks like this:

```scala
def decide[B](f: (A, List[F[Unit]]) => F[B]): F[B]
```

It will fold the description of computations as described in the `Saga` data type to a `F[B]`. If anything fails (due to a `Sync.onError`) it will execute the compensating actions accumulated so far. If it succeeds, it will execute the `f: (A, List[F[Unit]] => F[B]` function. This function lets you decide what to do with the outcome of the computation. This is useful when you work with an `EitherT` or `OptionT`. The outcome may be `None` or `Left`. In that case, you might want to roll back all the actions.

You can also use the `run` variant on `Saga` which uses the `decide`

```scala
def run: F[A] = decide { case (a, _) => F.pure(a) }
```

# Limitations

`volatile-saga` is deliberately in-process and non-persistent. That means:

- **No crash recovery** — if the JVM dies mid-saga, in-flight compensations are lost.
- **No retry logic** — if a compensating action itself fails (e.g. the flight API is down), it is not retried.
- **No idempotency keys** — the library does not manage duplicate-prevention for you.

For the failure path, the recommended approach is to combine `volatile-saga` with the **outbox pattern**: if a compensation fails, write it to an outbox table in your local database, then have a background worker retry failed compensations with exponential backoff. This gives you eventual consistency without requiring a full persistent saga infrastructure.

For scenarios requiring crash recovery, exactly-once semantics, or long-running workflows, consider alternatives:

- **Two-Phase Commit** — strong consistency, but couples services tightly and is fragile under partial failures.
- **Persistent sagas** — store saga state in a database so it survives crashes; more infrastructure overhead.
- **[Temporal](https://temporal.io)** — a full durable execution platform; the right choice for long-running or complex workflows.

# Conclusion

`Saga` is a useful tool when interacting with multiple APIs that cross an asynchronous boundary and do not offer transactional guarantees. For short-lived request/response flows — an HTTP handler, a CLI command, a batch job step — `volatile-saga` gives you structured rollback with minimal infrastructure overhead.

If you want to have a closer look or have feedback, the source code is on [Github](https://github.com/Fristi/volatile-saga).

There is also a ZIO version of this pattern: [zio-saga](https://github.com/VladKopanev/zio-saga)

Happy hacking!
