---
pubDate: "2026-06-12"
banner: "/img/blog/banner_saga.jpg"
title: "Apparatus: composable state machines for sagas and event sourcing"
description: "A Scala library that composes finite state machines from pure deciders up to transactional saga networks"
draft: false
---

In 2018 I wrote about [Sagas and volatile-saga](/blog/saga) — a small library that couples each successful step with a compensating action and rolls back in reverse order when something fails. It worked well for short-lived, in-process flows: book a flight, book a hotel, book a car, and unwind the stack if the car rental API is down.

What it did *not* do was model the domain explicitly. State lived in a `Free` monad interpreter, not in typed aggregates. There was no path to persistence, no way to wire multiple services as first-class machines, and no shared vocabulary with event sourcing.

**Apparatus** is the successor. It is a Scala 3 library for building and composing finite state machines — from a single door aggregate, through event-sourced deciders, up to networked sagas with compensation — all wired with a small set of algebraic combinators.

Source and documentation: [github.com/Fristi/apparatus](https://github.com/Fristi/apparatus).

## Three layers of machine

Apparatus organizes behaviour into three layers. The README uses a forest metaphor; the code uses three concrete machine types.

| Layer | Machine | What it does |
|-------|---------|--------------|
| **Basic** | `ClosedMealy` | Receives input, evolves internal state, emits output. State is hidden behind `F[O]`. |
| **Eventful** | `Decider` | Pure `decide` / `evolve` pair. Commands in, events out, state folded from events — the standard event-sourcing split. |
| **Networked** | `Apparatus` | Composes basic and eventful machines with `>>>`, `feedback`, `merge`, `lmapOrEmpty`, and friends. Sagas and projections emerge from the topology. |

A **basic** forest reacts to sunlight and rain. An **eventful** forest remembers fires, storms, and regrowth as events replayed through ecological rules. A **networked** forest exchanges pollen and climate with its neighbours — feedback loops like sagas, shared memory like projections.

In code, all three layers surface as `Apparatus[F, I, O]` nodes. The effect `F` is a type parameter: `SyncIO` in tests, `IO` in production, `ConnectionIO` when you want every step inside a database transaction.

## The Decider pattern

If you have read my post on [event-driven architecture](/blog/event-sourcing), the Decider pattern will feel familiar. An aggregate is two pure functions:

```
Command ──► decide(cmd, state) ──► [Event, …]
                                        │
                                        ▼
                              evolve(event, state) ──► newState
```

`decide` is the guard: validate the command against current state, emit events that *should* happen. `evolve` is the projection: fold events into the next state — the same function you use when replaying an event log.

```scala
enum DoorState { case Closed, Open }
sealed trait DoorCmd { val id: UUID }
object DoorCmd:
  case class Open(id: UUID)  extends DoorCmd
  case class Close(id: UUID) extends DoorCmd
enum DoorEvt { case Opened, Closed }

val door: Decider[DoorState, DoorCmd, List[DoorEvt]] =
  DeciderBuilder.seed("door", DoorState.Closed)
    .partiallyDecide[DoorCmd, DoorEvt]:
      case (DoorState.Closed, _: DoorCmd.Open)  => List(DoorEvt.Opened)
      case (DoorState.Open,   _: DoorCmd.Close) => List(DoorEvt.Closed)
    .evolveList:
      case (DoorState.Closed, DoorEvt.Opened) => DoorState.Open
      case (DoorState.Open,   DoorEvt.Closed) => DoorState.Closed
      case (s, _)                              => s
```

Because both functions are pure, you test them without a database, without Cats Effect, without any framework bootstrap. Call `door.decide(DoorCmd.Open(id), DoorState.Closed)` and assert on the events. Call `door.evolve(...)` and assert on the state. That is the payoff of keeping business rules in data and functions rather than in service classes with scattered `if` branches.

`Apparatus.aggregateMachine(door, _.id)` lifts the decider into a routed network node: each `UUID` gets its own state, materialised by a `DeciderMaterializer`.

## Composing machines

Once you have leaf nodes, you wire them. The combinators are intentionally small — most real topologies use only a handful.

**Sequential (`>>>`)** pipes one machine's output into the next. Use this for projections: an aggregate emits events, a downstream machine builds a read model.

**Parallel (`merge`)** runs two machines on the *same* input and combines outputs with a `Monoid`. Pair it with **`lmapOrEmpty`**, which contramaps through a partial function: when the input does not match, the machine stays silent and returns `Monoid.empty`. This is the fan-out primitive — each sub-machine filters only the events it cares about, analogous to `<+>` routing in http4s.

**Feedback (`feedback`)** closes a loop between two machines. The left machine consumes input and emits a `Foldable` collection; each element feeds the right machine, which may emit new input for the left. The loop runs to quiescence in one step. This is how sagas work.

```scala
val loop: Apparatus[SyncIO, DoorCmd, List[DoorEvt]] =
  doorFsm.feedback(echoPolicy)
```

Before execution, the library **normalises** the tree of `ApparatusF` nodes into a flat graph: aggregate machines are deduplicated by name, open machines get stable `Ref` placeholders, and `DeciderMaterializer` allocates runtime state. You build a tree; the compiler pass turns it into something runnable.

There is also a `Mermaid` renderer — call `.mermaid` on any assembled network and paste the result into [mermaid.live](https://mermaid.live) to see the topology. Useful when a saga wiring gets non-obvious.

## Sagas as a feedback network

The travel-booking scenario from the [volatile-saga post](/blog/saga) returns, but the shape is different. Instead of nesting `recoverable` calls in a for-comprehension, you model each service (flight, car, hotel) as its own `Decider` aggregate and wire them around a saga orchestrator.

The topology:

```
                ┌──────────────────────────────────────────┐
BookingCommand  │  [Booking Saga]  ──► List[SagaEvent]       │
────────────►   │                                           │
                │  each SagaEvent fan-out to:               │
                │  ┌────────────────────────────────────┐   │
                │  │ [Flight / Car / Hotel services]     │   │
                │  └──────────────┬─────────────────────┘   │
                │                 │ List[BookingCommand]     │
                └─────────────────┴──────────────────────────┘
```

The orchestrator emits `SagaEvent`s (`StepStarted`, `CompensationStarted`, …). Each service machine listens via `lmapOrEmpty` — only events for *its* step advance its state — and responds with `BookingCommand.Advance` acknowledgements via `rmap` and a `SagaAdvancePrism`. Those commands feed back into the orchestrator through `feedback`.

Assembly in the examples package:

```scala
def saga[F[_]: Applicative](
  flight: FlightDecider = flightDecider(),
  car:    CarDecider    = carDecider(),
  hotel:  HotelDecider  = hotelDecider()
): Apparatus[F, BookingCommand, List[SagaEvent[BookingStep]]] =
  Apparatus.aggregateMachine(behavior.decider, _.id)
    .feedback(makeServices(flight, car, hotel))
```

A single `BookingCommand.Start` drives the entire loop to completion: hotel reserves, car reserves, flight reserves — or, if flight fails, compensation runs car then hotel in reverse. The orchestrator's `SagaState` tracks `current`, `todo`, and `compensation` explicitly:

```
Waiting ──(Boot)──► Prepared ──(StepStarted)──► Running ──► Succeeded
                                                    │
                                        (step fails)──► Compensating ──► Failed
```

Compared to volatile-saga:

| | volatile-saga | Apparatus saga |
|---|---|---|
| State model | Implicit in Free interpreter | Typed `SagaState` on the orchestrator decider |
| Service boundaries | Anonymous `F[A]` steps | First-class decider per service |
| Persistence | None | `apparatus-doobie` event store |
| Testability | Run the saga, assert on effects | Test each `decide`/`evolve` in isolation, then test the wired network |
| Composition | Flat for-comprehension | `merge`, `feedback`, `lmapOrEmpty` — subgraphs compose further |

The Apparatus version is more ceremony upfront. The payoff is that each service's lifecycle (idle → reserved → compensated → failed) is visible in the type system, and the same deciders can be reused outside the saga — in an HTTP handler, a message consumer, or a batch job.

## Persistence with Doobie

The core module is in-memory by default: `DeciderMaterializer.syncIO` allocates a `Ref` per aggregate. For production, the `apparatus-doobie` module provides a materialiser backed by Postgres.

Every `Apparatus.run` call in `ConnectionIO` becomes one transaction:

1. Advisory-lock the aggregate row.
2. Load and replay stored events through `evolve`.
3. Run `decide` on the new command.
4. Append new events to the `eventstreams` table.
5. Return.

Projections chained with `>>>` update in the same transaction. A saga orchestrator and its service aggregates can all persist atomically within a single microservice boundary — strong consistency without two-phase commit across network boundaries.

This is the sweet spot Apparatus targets: **event-sourced aggregates, transactional read models, and compensating sagas inside one service**, composed from the same `Apparatus` topology whether you run in memory or on Doobie.

For cross-service, long-running, or crash-durable workflows, reach for Temporal or a persistent saga log. Apparatus does not try to be that. It tries to make the *in-service* orchestration legible.

## When to reach for it

Apparatus fits when:

- Business logic has real state machines — payments, bookings, onboarding, device lifecycles — and the transitions are getting lost in service classes.
- You already event-source aggregates and want sagas and projections to use the same `decide`/`evolve` vocabulary.
- You need strongly consistent read models updated in the same database transaction as the write model.
- You want to test domain rules as pure functions without spinning up infrastructure.

It is less suited when:

- You need durable execution across process restarts (use Temporal or an outbox worker).
- The workflow spans many teams' services with no shared database (choreography over a message bus is simpler).
- The domain is CRUD with no meaningful state transitions (a service class is fine).

## From volatile-saga to Apparatus

volatile-saga answered a narrow question well: *how do I compose compensating steps in a for-comprehension without manual try/catch nesting?* Apparatus asks a broader one: *how do I model, compose, test, and optionally persist networks of state machines that include sagas as a special case?*

The booking example that used to be a dozen lines of `Saga.recoverable` is now explicit aggregates, a typed orchestrator, and a feedback loop you can render as a Mermaid diagram. More code, more structure — and a place for the complexity to live when the rules get harder.

If you want to dig in, start with the [getting started guide](https://github.com/Fristi/apparatus/blob/main/docs-src/core/getting-started.md) and the [booking saga source](https://github.com/Fristi/apparatus/blob/main/examples/src/main/scala/apparatus/examples/BookingSaga.scala). Feedback and PRs welcome on GitHub.
