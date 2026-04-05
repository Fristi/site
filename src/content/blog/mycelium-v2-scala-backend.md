---
pubDate: "2024-12-22"
banner: "/img/blog/mycelium/scala-backend.jpg"
title: "Cloud Component: Scala Backend & REST API Integration"
description: "Building a scalable backend with Scala, PostgreSQL, and Auth0 for the Mycelium v2 plant monitoring system"
draft: true
series: "Mycelium v2"
---

## Scaling Beyond the Edge

While our edge devices and central hub handle local data collection, the cloud backend transforms raw sensor data into actionable insights. This post explores the Scala-based backend architecture that powers Mycelium v2's web services, user management, and long-term data analytics.

## Why Scala for the Backend?

Choosing Scala for our backend wasn't arbitrary—it offers unique advantages for IoT data processing:

### Functional Programming Paradigm

- **Immutable data structures**: Perfect for time-series sensor data that shouldn't change once recorded
- **Pattern matching**: Elegant handling of different sensor types and data validation
- **Higher-order functions**: Clean data transformation pipelines

### JVM Ecosystem

- **Battle-tested libraries**: Akka for concurrency, Slick for database access, Play for web services
- **Performance**: JVM optimization for long-running services
- **Monitoring**: Rich tooling for production observability

### Type Safety

- **Compile-time error detection**: Catches data modeling issues before deployment
- **Strong typing**: Ensures data integrity across service boundaries

## Backend Architecture Overview

The backend follows a layered architecture with clear separation of concerns:

```scala
// Core domain models
case class Plant(
  id: PlantId,
  userId: UserId,
  name: String,
  species: String,
  location: String,
  createdAt: Instant
)

case class SensorReading(
  id: ReadingId,
  plantId: PlantId,
  deviceId: DeviceId,
  moisture: Int,
  light: Int,
  temperature: Double,
  humidity: Int,
  batteryLevel: Double,
  recordedAt: Instant,
  receivedAt: Instant
)

// Service layer
trait PlantService {
  def createPlant(userId: UserId, request: CreatePlantRequest): Future[Plant]
  def getPlant(plantId: PlantId): Future[Option[Plant]]
  def getUserPlants(userId: UserId): Future[Seq[Plant]]
  def updatePlant(plantId: PlantId, updates: PlantUpdates): Future[Plant]
}

trait SensorDataService {
  def recordReading(reading: SensorReading): Future[Unit]
  def getReadings(plantId: PlantId, timeRange: TimeRange): Future[Seq[SensorReading]]
  def getLatestReading(plantId: PlantId): Future[Option[SensorReading]]
}
```

## REST API Design

The API follows RESTful principles with clear resource hierarchies:

### Plant Management Endpoints

```scala
// Routes definition using Play Framework
class PlantController @Inject()(
  plantService: PlantService,
  authAction: AuthenticatedAction,
  cc: ControllerComponents
) extends AbstractController(cc) {

  def createPlant = authAction.async(parse.json) { implicit request =>
    request.body.validate[CreatePlantRequest] match {
      case JsSuccess(plantRequest, _) =>
        plantService.createPlant(request.user.id, plantRequest)
          .map(plant => Created(Json.toJson(plant)))
          .recover {
            case _: DuplicateNameException => Conflict("Plant name already exists")
            case _: ValidationException => BadRequest("Invalid plant data")
          }
      case JsError(errors) =>
        Future.successful(BadRequest(JsError.toJson(errors)))
    }
  }

  def getPlant(plantId: String) = authAction.async { implicit request =>
    PlantId.fromString(plantId) match {
      case Some(id) =>
        plantService.getPlant(id).map {
          case Some(plant) if plant.userId == request.user.id => Ok(Json.toJson(plant))
          case Some(_) => Forbidden("Access denied")
          case None => NotFound("Plant not found")
        }
      case None =>
        Future.successful(BadRequest("Invalid plant ID"))
    }
  }
}
```

### Sensor Data Endpoints

```scala
class SensorDataController @Inject()(
  sensorService: SensorDataService,
  plantService: PlantService,
  authAction: AuthenticatedAction,
  cc: ControllerComponents
) extends AbstractController(cc) {

  def getReadings(plantId: String) = authAction.async { implicit request =>
    val timeRange = TimeRange.fromQuery(request.queryString)

    for {
      plant <- plantService.getPlant(PlantId.fromString(plantId).get)
      readings <- plant match {
        case Some(p) if p.userId == request.user.id =>
          sensorService.getReadings(p.id, timeRange)
        case Some(_) =>
          Future.failed(new ForbiddenException("Access denied"))
        case None =>
          Future.failed(new NotFoundException("Plant not found"))
      }
    } yield Ok(Json.toJson(readings))
  }

  def recordReading = Action.async(parse.json) { implicit request =>
    // This endpoint is called by the central hub
    request.body.validate[SensorReading] match {
      case JsSuccess(reading, _) =>
        sensorService.recordReading(reading)
          .map(_ => Created("Reading recorded"))
          .recover {
            case _: ValidationException => BadRequest("Invalid sensor data")
          }
      case JsError(errors) =>
        Future.successful(BadRequest(JsError.toJson(errors)))
    }
  }
}
```

## User Authentication with Auth0

We integrated Auth0 for user management, avoiding the complexity of building our own authentication system:

### Auth0 Configuration

```scala
class AuthenticatedAction @Inject()(
  parser: BodyParsers.Default,
  auth0Config: Auth0Config
)(implicit ec: ExecutionContext) extends ActionBuilderImpl(parser) {

  override def invokeBlock[A](request: Request[A], block: AuthenticatedRequest[A] => Future[Result]): Future[Result] = {
    request.headers.get("Authorization") match {
      case Some(authHeader) if authHeader.startsWith("Bearer ") =>
        val token = authHeader.substring(7)
        validateToken(token).flatMap { user =>
          block(AuthenticatedRequest(user, request))
        }.recover {
          case _: InvalidTokenException => Unauthorized("Invalid token")
          case _: ExpiredTokenException => Unauthorized("Token expired")
        }
      case _ =>
        Future.successful(Unauthorized("Missing authorization header"))
    }
  }

  private def validateToken(token: String): Future[User] = {
    // JWT validation using Auth0's public key
    val algorithm = Algorithm.RSA256(auth0Config.publicKey)
    val verifier = JWT.require(algorithm)
      .withIssuer(auth0Config.issuer)
      .withAudience(auth0Config.audience)
      .build()

    Try {
      val decodedJWT = verifier.verify(token)
      User(
        id = UserId(decodedJWT.getSubject),
        email = decodedJWT.getClaim("email").asString(),
        name = decodedJWT.getClaim("name").asString()
      )
    }.toEither match {
      case Right(user) => Future.successful(user)
      case Left(exception) => Future.failed(new InvalidTokenException(exception.getMessage))
    }
  }
}
```

## PostgreSQL Schema Design

The database schema balances normalization with query performance:

```sql
-- Users table (managed by Auth0, but we store additional metadata)
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,  -- Auth0 user ID
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plants table
CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    species VARCHAR(255),
    location VARCHAR(255),
    device_id VARCHAR(255) UNIQUE,  -- Links to physical sensor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, name)  -- User can't have duplicate plant names
);

-- Sensor readings table (time-series data)
CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id UUID NOT NULL REFERENCES plants(id),
    device_id VARCHAR(255) NOT NULL,
    moisture INTEGER NOT NULL CHECK (moisture >= 0 AND moisture <= 100),
    light INTEGER NOT NULL CHECK (light >= 0),
    temperature DECIMAL(4,1) NOT NULL,
    humidity INTEGER NOT NULL CHECK (humidity >= 0 AND humidity <= 100),
    battery_level DECIMAL(4,2) NOT NULL CHECK (battery_level >= 0),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- When sensor recorded
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- When backend received

    -- Partitioning for time-series performance
    PARTITION BY RANGE (recorded_at)
);

-- Create monthly partitions for sensor readings
CREATE TABLE sensor_readings_2024_12 PARTITION OF sensor_readings
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Indexes for common queries
CREATE INDEX idx_sensor_readings_plant_time ON sensor_readings (plant_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_device_time ON sensor_readings (device_id, recorded_at DESC);
CREATE INDEX idx_plants_user ON plants (user_id);
```

## Data Access Layer with Slick

We use Slick for type-safe database access:

```scala
class SensorDataRepository @Inject()(db: Database)(implicit ec: ExecutionContext) {
  import profile.api._

  class SensorReadingsTable(tag: Tag) extends Table[SensorReading](tag, "sensor_readings") {
    def id = column[ReadingId]("id", O.PrimaryKey)
    def plantId = column[PlantId]("plant_id")
    def deviceId = column[DeviceId]("device_id")
    def moisture = column[Int]("moisture")
    def light = column[Int]("light")
    def temperature = column[Double]("temperature")
    def humidity = column[Int]("humidity")
    def batteryLevel = column[Double]("battery_level")
    def recordedAt = column[Instant]("recorded_at")
    def receivedAt = column[Instant]("received_at")

    def * = (id, plantId, deviceId, moisture, light, temperature, humidity, batteryLevel, recordedAt, receivedAt) <> (SensorReading.tupled, SensorReading.unapply)
  }

  val sensorReadings = TableQuery[SensorReadingsTable]

  def insertReading(reading: SensorReading): Future[Unit] = {
    db.run(sensorReadings += reading).map(_ => ())
  }

  def getReadings(plantId: PlantId, timeRange: TimeRange): Future[Seq[SensorReading]] = {
    val query = sensorReadings
      .filter(_.plantId === plantId)
      .filter(_.recordedAt >= timeRange.start)
      .filter(_.recordedAt <= timeRange.end)
      .sortBy(_.recordedAt.desc)
      .take(1000)  // Limit for performance

    db.run(query.result)
  }

  def getLatestReading(plantId: PlantId): Future[Option[SensorReading]] = {
    val query = sensorReadings
      .filter(_.plantId === plantId)
      .sortBy(_.recordedAt.desc)
      .take(1)

    db.run(query.result.headOption)
  }
}
```

## Data Modeling Insights

### Time-Series Optimization

Sensor data is inherently time-series, so we optimized for temporal queries:

- **Partitioning**: Monthly partitions improve query performance and maintenance
- **Indexing**: Composite indexes on (plant_id, recorded_at) for common access patterns
- **Retention policies**: Automated cleanup of old data to manage storage costs

### Handling Late-Arriving Data

Edge devices might sync data hours or days after recording:

- **Dual timestamps**: `recorded_at` (sensor time) vs `received_at` (server time)
- **Idempotent inserts**: Duplicate readings are handled gracefully
- **Data validation**: Reject readings with impossible timestamps

### Aggregation Strategy

For dashboard performance, we pre-compute common aggregations:

```scala
case class DailySummary(
  plantId: PlantId,
  date: LocalDate,
  avgMoisture: Double,
  minMoisture: Int,
  maxMoisture: Int,
  avgTemperature: Double,
  totalLightHours: Double
)

// Background job to compute daily summaries
class AggregationService @Inject()(repository: SensorDataRepository) {
  def computeDailySummaries(date: LocalDate): Future[Unit] = {
    // Aggregate raw readings into daily summaries
    // This runs nightly to pre-compute dashboard data
  }
}
```

## Performance and Scalability Considerations

### Connection Pooling

```scala
// Database configuration
db {
  default {
    driver = "org.postgresql.Driver"
    url = "jdbc:postgresql://localhost:5432/mycelium"
    username = ${DATABASE_USER}
    password = ${DATABASE_PASSWORD}

    # Connection pool settings
    hikaricp {
      maximumPoolSize = 20
      minimumIdle = 5
      connectionTimeout = 30000
      idleTimeout = 600000
      maxLifetime = 1800000
    }
  }
}
```

### Caching Strategy

```scala
class CachedPlantService @Inject()(
  underlying: PlantService,
  cache: AsyncCacheApi
)(implicit ec: ExecutionContext) extends PlantService {

  def getPlant(plantId: PlantId): Future[Option[Plant]] = {
    cache.getOrElseUpdate(s"plant:${plantId.value}", 5.minutes) {
      underlying.getPlant(plantId)
    }
  }
}
```

## Looking Forward

The Scala backend provides a robust foundation for the Mycelium v2 ecosystem, handling user management, data persistence, and API services. In our next post, we'll explore how users interact with this data through our cross-platform desktop application built with Tauri.

The backend's functional programming approach and strong typing ensure data integrity as we scale from monitoring a few plants to supporting thousands of users and their gardens.
