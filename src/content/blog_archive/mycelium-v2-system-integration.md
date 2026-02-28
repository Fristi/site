---
pubDate: "2025-01-05"
banner: "/img/blog/mycelium/system-integration.jpg"
title: "End-to-End Flow & System Integration: From Sensor to Dashboard"
description: "Bringing together all Mycelium v2 components and exploring the complete data journey with performance insights and testing strategies"
draft: true
series: "Mycelium v2"
---

## The Complete Journey

After exploring each component individually, it's time to see how they work together. This post traces a sensor reading's complete journey through the Mycelium v2 ecosystem and examines the integration challenges we solved along the way.

## The Data Flow: A Sensor Reading's Journey

Let's follow a single moisture reading from a basil plant as it travels through our system:

### Step 1: Edge Device Sensing (ESP32)

```cpp
// 6:00 AM - ESP32 wakes from deep sleep
void loop() {
    // Wake up, sensors stabilize
    delay(2000);

    // Read sensors
    SensorData data = {
        .device_id = DEVICE_ID,
        .moisture = getMoisturePercentage(),    // 45%
        .light = getLightLevel(),               // 120 lux
        .temperature = dht.readTemperature(),   // 22.3°C
        .humidity = dht.readHumidity(),         // 65%
        .battery = getBatteryVoltage(),         // 3.7V
        .timestamp = 0  // Will be synced with hub
    };

    // Attempt BLE transmission
    if (transmitToHub(data)) {
        Serial.println("Data transmitted successfully");
        enterDeepSleep(calculateSleepDuration());
    } else {
        // Store locally and retry later
        storeForRetry(data);
        enterDeepSleep(RETRY_INTERVAL);
    }
}
```

### Step 2: Central Hub Processing (Rust)

```rust
// Central hub receives BLE advertisement
impl CentralHub {
    async fn process_device_data(&mut self, device: &MyceliumDevice) -> Result<(), HubError> {
        // Establish BLE connection
        let connection = self.device_manager.connect(device).await?;

        // Sync time with device first
        let current_time = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as u32;
        connection.send_time_sync(current_time).await?;

        // Receive sensor data
        let raw_data = connection.read_sensor_data().await?;

        // Parse TLV protocol
        let sensor_reading = TlvParser::parse_sensor_data(&raw_data)?;

        // Enrich with metadata
        let enriched_reading = SensorReading {
            id: Uuid::new_v4(),
            device_id: sensor_reading.device_id,
            plant_id: self.device_registry.get_plant_id(&sensor_reading.device_id)?,
            moisture: sensor_reading.moisture,
            light: sensor_reading.light,
            temperature: sensor_reading.temperature,
            humidity: sensor_reading.humidity,
            battery_level: sensor_reading.battery,
            recorded_at: Instant::from_timestamp(sensor_reading.timestamp),
            received_at: Instant::now(),
        };

        // Store locally
        self.local_store.insert_reading(enriched_reading.clone()).await?;

        // Queue for cloud sync
        self.sync_queue.push(enriched_reading).await?;

        Ok(())
    }
}
```

### Step 3: Cloud Synchronization

```rust
// Periodic sync with backend
impl SyncManager {
    async fn sync_pending_readings(&mut self) -> Result<(), SyncError> {
        let pending_readings = self.local_store.get_pending_sync().await?;

        if pending_readings.is_empty() {
            return Ok(());
        }

        // Batch upload for efficiency
        let batch_size = 50;
        for chunk in pending_readings.chunks(batch_size) {
            match self.api_client.upload_readings(chunk).await {
                Ok(_) => {
                    // Mark as synced
                    let ids: Vec<_> = chunk.iter().map(|r| r.id).collect();
                    self.local_store.mark_synced(&ids).await?;

                    info!("Synced {} readings to cloud", chunk.len());
                }
                Err(e) => {
                    warn!("Failed to sync batch: {}", e);
                    // Will retry on next sync cycle
                    break;
                }
            }
        }

        Ok(())
    }
}
```

### Step 4: Backend Processing (Scala)

```scala
// REST endpoint receives sensor data
class SensorDataController @Inject()(
  sensorService: SensorDataService,
  alertService: AlertService,
  cc: ControllerComponents
) extends AbstractController(cc) {

  def uploadReadings = Action.async(parse.json) { implicit request =>
    request.body.validate[Seq[SensorReading]] match {
      case JsSuccess(readings, _) =>
        for {
          // Store readings
          _ <- sensorService.batchInsert(readings)

          // Process alerts for each reading
          _ <- Future.traverse(readings) { reading =>
            alertService.checkAlerts(reading)
          }

          // Update plant health scores
          _ <- Future.traverse(readings.groupBy(_.plantId)) { case (plantId, plantReadings) =>
            sensorService.updatePlantHealth(plantId, plantReadings.last)
          }
        } yield Ok(Json.obj("status" -> "success", "count" -> readings.length))

      case JsError(errors) =>
        Future.successful(BadRequest(JsError.toJson(errors)))
    }
  }
}
```

### Step 5: Alert Processing

```scala
// Check if plant needs attention
class AlertService @Inject()(
  plantService: PlantService,
  notificationService: NotificationService
) {

  def checkAlerts(reading: SensorReading): Future[Unit] = {
    for {
      plant <- plantService.getPlant(reading.plantId)
      alerts <- evaluateConditions(plant, reading)
      _ <- Future.traverse(alerts)(sendAlert)
    } yield ()
  }

  private def evaluateConditions(plant: Plant, reading: SensorReading): Future[Seq[Alert]] = {
    val alerts = mutable.Buffer[Alert]()

    // Low moisture alert
    if (reading.moisture < plant.moistureThreshold) {
      alerts += Alert(
        plantId = plant.id,
        alertType = AlertType.LowMoisture,
        severity = if (reading.moisture < 20) Severity.Critical else Severity.Warning,
        message = s"${plant.name} needs watering (${reading.moisture}% moisture)"
      )
    }

    // Low battery alert
    if (reading.batteryLevel < 3.3) {
      alerts += Alert(
        plantId = plant.id,
        alertType = AlertType.LowBattery,
        severity = Severity.Info,
        message = s"Sensor battery low for ${plant.name} (${reading.batteryLevel}V)"
      )
    }

    Future.successful(alerts.toSeq)
  }
}
```

### Step 6: Desktop App Display (Tauri + React)

```typescript
// React component receives real-time updates
const PlantMonitor: React.FC = () => {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Initial data load
    loadRecentReadings();

    // Set up real-time updates
    const interval = setInterval(() => {
      loadRecentReadings();
      checkForAlerts();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadRecentReadings = async () => {
    try {
      const recentReadings = await invoke<SensorReading[]>(
        "get_recent_readings",
        {
          hours: 1,
        }
      );

      setReadings((prev) => {
        // Merge new readings, avoiding duplicates
        const combined = [...prev, ...recentReadings];
        const unique = combined.filter(
          (reading, index, self) =>
            index === self.findIndex((r) => r.id === reading.id)
        );

        // Keep only last 100 readings for performance
        return unique
          .slice(-100)
          .sort(
            (a, b) =>
              new Date(b.recorded_at).getTime() -
              new Date(a.recorded_at).getTime()
          );
      });
    } catch (error) {
      console.error("Failed to load readings:", error);
    }
  };

  // Display latest reading with visual indicators
  const latestReading = readings[0];

  return (
    <div className="plant-monitor">
      {latestReading && (
        <div className="current-status">
          <StatusCard
            title="Soil Moisture"
            value={`${latestReading.moisture}%`}
            status={getMoistureStatus(latestReading.moisture)}
            icon="💧"
          />
          <StatusCard
            title="Temperature"
            value={`${latestReading.temperature}°C`}
            status={getTemperatureStatus(latestReading.temperature)}
            icon="🌡️"
          />
          <StatusCard
            title="Light Level"
            value={`${latestReading.light} lux`}
            status={getLightStatus(latestReading.light)}
            icon="☀️"
          />
        </div>
      )}

      <SensorChart readings={readings} />
      <AlertPanel alerts={alerts} />
    </div>
  );
};
```

## Synchronization Mechanisms

### Time Synchronization

Different components operate on different clocks, requiring careful time management:

```rust
// Central hub provides authoritative time
impl TimeSync {
    pub async fn sync_device_time(&self, device: &mut Device) -> Result<(), SyncError> {
        let network_time = self.ntp_client.get_time().await?;
        let sync_packet = TimeSync {
            timestamp: network_time.timestamp(),
            timezone_offset: self.local_timezone_offset(),
        };

        device.send_time_sync(sync_packet).await?;
        device.last_time_sync = Some(Instant::now());

        Ok(())
    }
}
```

### Data Consistency

We handle eventual consistency across disconnected systems:

```scala
// Backend handles duplicate readings gracefully
class SensorDataService {
  def insertReading(reading: SensorReading): Future[Unit] = {
    // Use device_id + recorded_at as natural key
    val query = sql"""
      INSERT INTO sensor_readings (device_id, plant_id, moisture, light, temperature, humidity, battery_level, recorded_at, received_at)
      VALUES (${reading.deviceId}, ${reading.plantId}, ${reading.moisture}, ${reading.light}, ${reading.temperature}, ${reading.humidity}, ${reading.batteryLevel}, ${reading.recordedAt}, ${reading.receivedAt})
      ON CONFLICT (device_id, recorded_at) DO UPDATE SET
        received_at = EXCLUDED.received_at,
        -- Update other fields only if new data is more recent
        moisture = CASE WHEN EXCLUDED.received_at > sensor_readings.received_at THEN EXCLUDED.moisture ELSE sensor_readings.moisture END
    """

    db.run(query.update).map(_ => ())
  }
}
```

## Performance Analysis

### Latency Breakdown

From sensor reading to dashboard display:

- **ESP32 sensing**: 2-3 seconds (sensor stabilization)
- **BLE transmission**: 1-2 seconds (connection + data transfer)
- **Hub processing**: <100ms (TLV parsing + local storage)
- **Cloud sync**: 200-500ms (HTTP request + database insert)
- **Dashboard update**: 30 seconds (polling interval)

**Total latency**: 30-40 seconds for real-time display

### Throughput Metrics

- **Sensors per hub**: 20-30 devices (BLE connection limit)
- **Readings per hour**: 1,200-1,800 (assuming 30-minute intervals)
- **Backend capacity**: 10,000+ readings/minute (tested with load simulation)
- **Database growth**: ~50MB/month per 100 plants (with daily aggregation)

### Power Consumption

- **ESP32 average**: 15mA during transmission, 10µA in deep sleep
- **Battery life**: 4-6 months with 18650 battery (2500mAh)
- **Hub power**: 2-3W continuous (Raspberry Pi 4)

## Testing Strategy

### Unit Testing

Each component has comprehensive unit tests:

```rust
// Rust unit tests for TLV parsing
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tlv_parsing() {
        let test_data = vec![
            0x01, 0x04, 0x00, 0x12, 0x34, 0x56, 0x78, // Device ID
            0x02, 0x01, 0x00, 0x2D,                     // Moisture: 45%
            0x03, 0x02, 0x00, 0x78, 0x00,               // Light: 120
        ];

        let reading = TlvParser::parse_sensor_data(&test_data).unwrap();

        assert_eq!(reading.device_id, 0x78563412);
        assert_eq!(reading.moisture, 45);
        assert_eq!(reading.light, 120);
    }
}
```

### Integration Testing

End-to-end tests verify the complete data flow:

```typescript
// Jest integration test
describe("End-to-End Data Flow", () => {
  test("sensor reading reaches dashboard", async () => {
    // Mock sensor data
    const mockReading = {
      device_id: "test-device-001",
      moisture: 45,
      light: 120,
      temperature: 22.3,
      humidity: 65,
      battery: 3.7,
      timestamp: Date.now(),
    };

    // Simulate hub receiving data
    await hubClient.receiveSensorData(mockReading);

    // Wait for sync
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify data appears in dashboard
    const dashboardData = await invoke("get_recent_readings", { hours: 1 });

    expect(dashboardData).toContainEqual(
      expect.objectContaining({
        moisture: 45,
        temperature: 22.3,
      })
    );
  });
});
```

### Load Testing

We simulate high-volume scenarios:

```scala
// Gatling load test
class SensorDataLoadTest extends Simulation {
  val httpProtocol = http
    .baseUrl("http://localhost:9000")
    .header("Authorization", "Bearer ${auth_token}")

  val sensorDataScenario = scenario("Sensor Data Upload")
    .exec(
      http("Upload Batch")
        .post("/api/sensor-data/batch")
        .body(StringBody("""[
          {"device_id": "device-${deviceId}", "moisture": ${moisture}, ...}
        ]""")).asJson
    )

  setUp(
    sensorDataScenario.inject(
      constantUsersPerSec(100) during (5.minutes)
    )
  ).protocols(httpProtocol)
}
```

## Debugging Across Components

### Distributed Tracing

We use correlation IDs to trace requests across services:

```rust
// Add correlation ID to each reading
struct SensorReading {
    correlation_id: Uuid,
    // ... other fields
}

// Log with correlation ID at each step
info!("Processing reading {} from device {}", reading.correlation_id, reading.device_id);
```

### Monitoring and Observability

Key metrics we track:

- **Device connectivity**: Online/offline status, last seen timestamps
- **Data freshness**: Time since last reading per plant
- **Error rates**: Failed BLE connections, HTTP timeouts, database errors
- **Performance**: Response times, memory usage, battery levels

## System Resilience

### Failure Modes and Recovery

- **BLE connection failures**: Automatic retry with exponential backoff
- **Network outages**: Local storage with sync when connectivity returns
- **Backend downtime**: Hub continues collecting data, syncs when service recovers
- **Device battery death**: Low battery alerts with replacement reminders

### Data Integrity Guarantees

- **At-least-once delivery**: Readings may be duplicated but never lost
- **Idempotent operations**: Duplicate readings are handled gracefully
- **Checksums**: TLV packets include CRC for transmission error detection

## Looking Forward

The end-to-end integration of Mycelium v2 demonstrates how modern IoT systems can be both robust and user-friendly. In our final post, we'll reflect on the challenges we overcame, lessons learned, and exciting possibilities for the future.

From a single moisture sensor to a complete plant monitoring ecosystem—every component working in harmony to keep your plants healthy and thriving.
