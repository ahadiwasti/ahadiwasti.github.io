---
title: Distributed Message Queue
created_at: 2026-05-22
updated_at: 2026-05-22
category: System-Design
---

# Designing a Distributed Message Queue

> A real-world walkthrough of how Kafka works under the hood — from producer to consumer — with Go code at every step.

---

## The Problem

Imagine you are building an e-commerce platform. A user places an order. That single action needs to trigger four separate things:

- The **warehouse** needs to prepare the shipment
- The **payment service** needs to charge the card
- The **notification service** needs to send a confirmation email
- The **analytics service** needs to record the event

You could call all four services directly and wait. But what happens if the payment service is slow? Everything blocks. What if the notification service crashes? The whole order fails.

This is exactly the problem a distributed message queue solves. The order service drops one message into a queue and walks away. Each downstream service picks it up independently, at its own pace, without knowing anything about the others.

That queue is Kafka. Let's build it.

---

## The Architecture

Before writing a single line of code, understand the full flow:

```
PRODUCER
├── Sends messages to topics
├── Never knows about partitions or brokers internally
├── Holds message in buffer until ACK received
├── Retries on failure with idempotent mode to prevent duplicates
└── Batches messages and compresses before sending
         │
         │ publishes to
         ▼
TOPIC
├── Logical channel — just a name (orders, payments, notifications)
├── Multiple producers can write to same topic
├── Can be used as Queue or Stream
└── Organized with tags for message filtering
         │
         │ split into
         ▼
PARTITIONS
├── Physical storage unit — actual data lives here
├── Append only WAL file on disk — sequential, fast
├── Each message assigned a unique offset (position number)
├── Messages ordered within partition — not across partitions
├── Split into segments — active segment receives new messages
└── Old segments deleted when retention expires
         │
         │ stored on
         ▼
BROKERS
├── Physical server machines holding partitions
├── Each partition has one Leader broker — handles all reads and writes
├── Follower brokers hold silent replicas — ready for takeover
├── Leader and replicas always on different brokers
├── One broker also acts as Coordinator for each consumer group
└── All brokers together form the CLUSTER
         │
         │ monitored by
         ▼
ZOOKEEPER
├── Central brain of the entire cluster
├── Tracks which brokers are alive via heartbeats
├── Stores partition leader assignments
├── Stores topic configurations and metadata
├── Triggers leader election when broker dies
└── Promotes follower to leader automatically
         │
         │ consumed by
         ▼
CONSUMER GROUPS
├── Team of consumers working together on same topic
├── Each group tracks its own offset independently
├── Multiple groups can read same topic simultaneously (Stream)
├── One group reads and processes once (Queue)
└── Coordinator manages group health and partition assignment
         │
         │ managed by
         ▼
COORDINATOR (one of the brokers)
├── Receives heartbeats from all consumers in group
├── Detects when consumer joins, leaves, or crashes
├── Triggers rebalancing when group changes
└── Broadcasts new partition assignments to all consumers
         │
         │ assigned to
         ▼
CONSUMERS
├── Pull messages from broker at their own pace
├── Long polling when no messages available
├── Each assigned to one or more partitions
├── One partition never assigned to two consumers in same group
├── Track progress using offsets
└── Commit offset after processing
```

Now let's walk through each layer with real Go code.

---

## Setting Up

We will use [kafka-go](https://github.com/segmentio/kafka-go) — the most idiomatic Kafka client for Go.

```bash
go get github.com/segmentio/kafka-go
```

Our example scenario: an order placement system. Every time a user places an order, we publish an event. Downstream services — warehouse, payment, notifications — each consume it independently.

---

## Step 1 — The Producer

The producer is simple from the outside. It knows one thing: the topic name. It has no idea which partition or broker will handle the message. That is Kafka's job.

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "time"

    "github.com/segmentio/kafka-go"
)

type Order struct {
    OrderID   string    `json:"order_id"`
    UserID    string    `json:"user_id"`
    Amount    float64   `json:"amount"`
    CreatedAt time.Time `json:"created_at"`
}

func newProducer(brokers []string, topic string) *kafka.Writer {
    return &kafka.Writer{
        Addr:         kafka.TCP(brokers...),
        Topic:        topic,
        Balancer:     &kafka.Hash{},       // hash(key) % partitions
        RequiredAcks: kafka.RequireAll,    // ACK = all — wait for leader + all replicas
        Async:        false,               // synchronous — wait for ACK before moving on
        Compression:  kafka.Snappy,        // compress batches before sending
        BatchSize:    100,                 // batch up to 100 messages per network trip
        BatchTimeout: 10 * time.Millisecond,
    }
}

func publishOrder(writer *kafka.Writer, order Order) error {
    payload, err := json.Marshal(order)
    if err != nil {
        return fmt.Errorf("failed to marshal order: %w", err)
    }

    // The key determines which partition this message goes to.
    // Same order ID always routes to the same partition — preserving order.
    msg := kafka.Message{
        Key:   []byte(order.OrderID),
        Value: payload,
        Headers: []kafka.Header{
            {Key: "event_type", Value: []byte("order_placed")},
            {Key: "version", Value: []byte("v1")},
        },
    }

    err = writer.WriteMessages(context.Background(), msg)
    if err != nil {
        return fmt.Errorf("failed to publish order: %w", err)
    }

    log.Printf("published order %s to topic", order.OrderID)
    return nil
}

func main() {
    writer := newProducer([]string{"localhost:9092"}, "orders")
    defer writer.Close()

    order := Order{
        OrderID:   "ord-001",
        UserID:    "usr-42",
        Amount:    149.99,
        CreatedAt: time.Now(),
    }

    if err := publishOrder(writer, order); err != nil {
        log.Fatal(err)
    }
}
```

### What is happening here

**`RequireAll`** maps to `ACK=all`. The producer will not remove this message from its buffer until the leader broker AND all in-sync replicas confirm they have written it to disk. This is the safest setting — used for anything critical like orders.

**`kafka.Hash{}`** is the balancer. It hashes the message key and takes the modulo with the number of partitions. Same `order_id` always lands on the same partition — so all events for a single order are guaranteed to be processed in sequence.

**`Compression: kafka.Snappy`** compresses the batch before sending over the network. Smaller payload, faster transfer, better throughput.

**Headers** are metadata attached to the message. The broker can use these for filtering without ever reading the actual payload.

---

## Step 2 — Topics and Partitions

A topic is just a named channel. Partitions are what actually exist on disk inside each broker.

When a message arrives at a broker, Kafka writes it to the tail of a **Write Ahead Log (WAL)** — an append-only file on disk. This is why Kafka is so fast. Disk is slow for random access but extremely fast for sequential writes. Kafka never modifies existing data. It always appends.

```
Partition 1 on disk (WAL):
offset 0  → {"order_id": "ord-001", "amount": 149.99}
offset 1  → {"order_id": "ord-005", "amount": 89.00}
offset 2  → {"order_id": "ord-009", "amount": 34.50}
offset 3  → {"order_id": "ord-013", "amount": 200.00}  ← newest
```

Each message gets a unique **offset** — its position in that partition. Consumers use this offset to track where they left off.

The WAL is split into **segments** so the file does not grow infinitely. The active segment receives new messages. When it hits the configured size, it becomes read-only and a new active segment is created. Old segments are deleted when the retention period expires.

You can create topics programmatically:

```go
package main

import (
    "context"
    "log"
    "net"
    "strconv"

    "github.com/segmentio/kafka-go"
)

func createTopic(broker string, topic string, partitions int, replicationFactor int) error {
    conn, err := kafka.Dial("tcp", broker)
    if err != nil {
        return err
    }
    defer conn.Close()

    controller, err := conn.Controller()
    if err != nil {
        return err
    }

    controllerConn, err := kafka.Dial("tcp", net.JoinHostPort(
        controller.Host,
        strconv.Itoa(controller.Port),
    ))
    if err != nil {
        return err
    }
    defer controllerConn.Close()

    topicConfig := kafka.TopicConfig{
        Topic:             topic,
        NumPartitions:     partitions,
        ReplicationFactor: replicationFactor,
        ConfigEntries: []kafka.ConfigEntry{
            {ConfigName: "retention.ms", ConfigValue: "604800000"}, // 7 days
            {ConfigName: "compression.type", ConfigValue: "snappy"},
        },
    }

    return controllerConn.CreateTopics(topicConfig)
}

func main() {
    // 3 partitions, replication factor 3 (1 leader + 2 followers per partition)
    if err := createTopic("localhost:9092", "orders", 3, 3); err != nil {
        log.Fatal(err)
    }
    log.Println("topic created: orders (3 partitions, replication factor 3)")
}
```

### Replication factor 3 means

- Every partition has **1 leader** and **2 followers**
- Leader and replicas always live on **different brokers**
- If a broker dies, ZooKeeper detects it, elects a follower as the new leader, and the system keeps running
- With 3 replicas, you can lose 2 brokers and still have zero data loss

---

## Step 3 — The Broker and ZooKeeper

You never write code that talks directly to ZooKeeper. But understanding what it does is essential.

ZooKeeper is the central brain of the Kafka cluster. Think of it as HR for your brokers.

Every broker sends a **heartbeat** to ZooKeeper every few seconds. As long as ZooKeeper receives that heartbeat, it knows the broker is alive.

When a broker dies:

```
1. Broker 2 stops sending heartbeats
2. ZooKeeper marks Broker 2 as dead
3. ZooKeeper checks: which partitions had their leader on Broker 2?
4. ZooKeeper elects a follower replica as the new leader for each affected partition
5. ZooKeeper updates the partition leader map
6. Producers and consumers are notified of the new leader locations
7. Everything keeps running — zero manual intervention
```

ZooKeeper also stores:
- Which partitions exist and which broker is the leader for each
- Topic configurations (partition count, retention, replication factor)
- Consumer group offsets (in older Kafka versions — newer versions store these in Kafka itself)

---

## Step 4 — Consumer Groups

This is where the real power of Kafka shows up. Multiple services can read the same order event completely independently.

```go
package main

import (
    "context"
    "encoding/json"
    "log"

    "github.com/segmentio/kafka-go"
)

type Order struct {
    OrderID string  `json:"order_id"`
    UserID  string  `json:"user_id"`
    Amount  float64 `json:"amount"`
}

func newConsumer(brokers []string, topic string, groupID string) *kafka.Reader {
    return kafka.NewReader(kafka.ReaderConfig{
        Brokers:        brokers,
        Topic:          topic,
        GroupID:        groupID,       // consumer group ID
        MinBytes:       1,
        MaxBytes:       10e6,          // 10MB max per fetch
        CommitInterval: 0,             // manual commit — we control when offset is committed
    })
}

func consumeOrders(reader *kafka.Reader, handler func(Order) error) {
    ctx := context.Background()

    for {
        // Pull model — we ask the broker for messages when we are ready
        msg, err := reader.FetchMessage(ctx)
        if err != nil {
            log.Printf("fetch error: %v", err)
            continue
        }

        var order Order
        if err := json.Unmarshal(msg.Value, &order); err != nil {
            log.Printf("unmarshal error: %v", err)
            // bad message — in production you would move this to a DLQ
            reader.CommitMessages(ctx, msg)
            continue
        }

        // Process FIRST then commit — at-least-once delivery
        // If we crash after processing but before committing,
        // the message will be reprocessed after restart.
        // This is acceptable for idempotent operations.
        if err := handler(order); err != nil {
            log.Printf("handler error for order %s: %v", order.OrderID, err)
            // do not commit — message will be retried
            continue
        }

        // Commit offset only after successful processing
        if err := reader.CommitMessages(ctx, msg); err != nil {
            log.Printf("commit error: %v", err)
        }
    }
}

// --- Warehouse Service ---
func warehouseHandler(order Order) error {
    log.Printf("[warehouse] preparing shipment for order %s", order.OrderID)
    // ... prepare shipment logic
    return nil
}

// --- Payment Service ---
func paymentHandler(order Order) error {
    log.Printf("[payment] charging %.2f for order %s", order.Amount, order.OrderID)
    // ... charge card logic
    return nil
}

// --- Notification Service ---
func notificationHandler(order Order) error {
    log.Printf("[notification] sending email for order %s to user %s", order.OrderID, order.UserID)
    // ... send email logic
    return nil
}

func main() {
    brokers := []string{"localhost:9092"}
    topic := "orders"

    // Each service has its own consumer group.
    // All three read the SAME messages independently.
    // This is Kafka used as a Stream.
    warehouseReader  := newConsumer(brokers, topic, "warehouse-service")
    paymentReader    := newConsumer(brokers, topic, "payment-service")
    notificationReader := newConsumer(brokers, topic, "notification-service")

    defer warehouseReader.Close()
    defer paymentReader.Close()
    defer notificationReader.Close()

    // In production each of these would run in its own service/pod.
    // Here we run them as goroutines for demonstration.
    go consumeOrders(warehouseReader, warehouseHandler)
    go consumeOrders(paymentReader, paymentHandler)
    go consumeOrders(notificationReader, notificationHandler)

    // Block forever
    select {}
}
```

### What is happening here

Three consumer groups — `warehouse-service`, `payment-service`, `notification-service` — all subscribe to the `orders` topic. Each group maintains its own offset. When the warehouse is at offset 500, the payment service might be at offset 480 — they are completely independent.

**`FetchMessage` instead of `ReadMessage`** gives us manual offset control. We process first, commit after. This is **at-least-once delivery** — if the service crashes between processing and committing, the message is reprocessed on restart. For most operations this is acceptable as long as your handler is idempotent.

---

## Step 5 — The Coordinator and Rebalancing

Within a single consumer group, the coordinator manages partition assignment. The coordinator is just one of the Kafka brokers that takes on this extra role.

```go
// When you start multiple instances of the same consumer group,
// Kafka automatically distributes partitions between them.

// Instance 1 — starts first, gets all 3 partitions
reader1 := kafka.NewReader(kafka.ReaderConfig{
    Brokers: []string{"localhost:9092"},
    Topic:   "orders",
    GroupID: "warehouse-service",
})

// Instance 2 — joins the group
// Kafka rebalances: Instance 1 gets Partition 0,1 — Instance 2 gets Partition 2
reader2 := kafka.NewReader(kafka.ReaderConfig{
    Brokers: []string{"localhost:9092"},
    Topic:   "orders",
    GroupID: "warehouse-service",
})

// Instance 1 crashes
// Kafka rebalances again: Instance 2 gets all 3 partitions
// No messages are lost — Instance 2 resumes from last committed offset
```

The coordinator tracks this through **heartbeats**. Each consumer sends a heartbeat every few seconds. If the coordinator stops receiving heartbeats from a consumer — it marks it as dead and triggers rebalancing. All remaining consumers are notified and partitions are redistributed automatically.

The golden rule of consumer groups:

```
One partition → one consumer in the same group   ✅
One consumer → multiple partitions               ✅
One partition → two consumers in the same group  ❌ never allowed
```

---

## Step 6 — Dead Letter Queue

Not every message will process cleanly. A malformed payload, a downstream service outage, an unexpected edge case. Without a Dead Letter Queue, one bad message can block your entire consumer.

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"

    "github.com/segmentio/kafka-go"
)

const maxRetries = 3

type Order struct {
    OrderID string  `json:"order_id"`
    UserID  string  `json:"user_id"`
    Amount  float64 `json:"amount"`
}

func processWithDLQ(
    reader *kafka.Reader,
    dlqWriter *kafka.Writer,
    handler func(Order) error,
) {
    ctx := context.Background()
    retryCounts := make(map[string]int)

    for {
        msg, err := reader.FetchMessage(ctx)
        if err != nil {
            log.Printf("fetch error: %v", err)
            continue
        }

        var order Order
        if err := json.Unmarshal(msg.Value, &order); err != nil {
            // unparseable message — send directly to DLQ
            sendToDLQ(ctx, dlqWriter, msg, fmt.Sprintf("unmarshal error: %v", err))
            reader.CommitMessages(ctx, msg)
            continue
        }

        key := string(msg.Key)
        if err := handler(order); err != nil {
            retryCounts[key]++
            log.Printf("handler failed for %s (attempt %d/%d): %v",
                order.OrderID, retryCounts[key], maxRetries, err)

            if retryCounts[key] >= maxRetries {
                // max retries exceeded — move to DLQ
                sendToDLQ(ctx, dlqWriter, msg, fmt.Sprintf("max retries exceeded: %v", err))
                delete(retryCounts, key)
                reader.CommitMessages(ctx, msg)
            }
            // do not commit — will retry on next poll
            continue
        }

        // success — clear retry count and commit
        delete(retryCounts, key)
        reader.CommitMessages(ctx, msg)
    }
}

func sendToDLQ(ctx context.Context, dlqWriter *kafka.Writer, original kafka.Message, reason string) {
    dlqMsg := kafka.Message{
        Key:   original.Key,
        Value: original.Value,
        Headers: append(original.Headers,
            kafka.Header{Key: "dlq_reason", Value: []byte(reason)},
            kafka.Header{Key: "original_topic", Value: []byte("orders")},
        ),
    }

    if err := dlqWriter.WriteMessages(ctx, dlqMsg); err != nil {
        log.Printf("failed to write to DLQ: %v", err)
        return
    }

    log.Printf("message moved to DLQ: key=%s reason=%s", string(original.Key), reason)
}

func main() {
    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers: []string{"localhost:9092"},
        Topic:   "orders",
        GroupID: "warehouse-service",
    })

    dlqWriter := &kafka.Writer{
        Addr:  kafka.TCP("localhost:9092"),
        Topic: "orders-dlq",
    }

    defer reader.Close()
    defer dlqWriter.Close()

    processWithDLQ(reader, dlqWriter, func(order Order) error {
        log.Printf("[warehouse] processing order %s", order.OrderID)
        // simulate processing
        return nil
    })
}
```

The DLQ is just another Kafka topic — `orders-dlq`. Failed messages land there with headers explaining why they failed. A separate monitoring consumer watches the DLQ and alerts engineers. Nobody's main consumer is blocked.

---

## Step 7 — Delayed Messages

Sometimes you need to process a message in the future, not immediately. The classic example: after an order is placed, wait 30 minutes and check if payment was completed.

```go
package main

import (
    "context"
    "encoding/json"
    "log"
    "time"

    "github.com/segmentio/kafka-go"
)

type DelayedMessage struct {
    ProcessAt time.Time       `json:"process_at"`
    Payload   json.RawMessage `json:"payload"`
    Topic     string          `json:"topic"`
}

// Producer publishes to a delay topic instead of the main topic
func publishDelayed(writer *kafka.Writer, payload interface{}, delay time.Duration, targetTopic string) error {
    raw, err := json.Marshal(payload)
    if err != nil {
        return err
    }

    delayed := DelayedMessage{
        ProcessAt: time.Now().Add(delay),
        Payload:   raw,
        Topic:     targetTopic,
    }

    value, err := json.Marshal(delayed)
    if err != nil {
        return err
    }

    return writer.WriteMessages(context.Background(), kafka.Message{
        Value: value,
    })
}

// Timer process — polls the delay topic and forwards messages when their time comes
func runDelayProcessor(delayReader *kafka.Reader, forwardWriter *kafka.Writer) {
    ctx := context.Background()

    for {
        msg, err := delayReader.FetchMessage(ctx)
        if err != nil {
            log.Printf("fetch error: %v", err)
            continue
        }

        var delayed DelayedMessage
        if err := json.Unmarshal(msg.Value, &delayed); err != nil {
            log.Printf("unmarshal error: %v", err)
            delayReader.CommitMessages(ctx, msg)
            continue
        }

        // Is it time yet?
        if time.Now().Before(delayed.ProcessAt) {
            // not yet — sleep briefly and re-check
            // In production use a time wheel or scheduled re-queue
            time.Sleep(1 * time.Second)
            continue
        }

        // Time to forward to the main topic
        forwardWriter.WriteMessages(ctx, kafka.Message{
            Value: delayed.Payload,
        })

        delayReader.CommitMessages(ctx, msg)
        log.Printf("forwarded delayed message to %s", delayed.Topic)
    }
}

func main() {
    // Delay topic writer — producer sends here instead of orders directly
    delayWriter := &kafka.Writer{
        Addr:  kafka.TCP("localhost:9092"),
        Topic: "orders-delay",
    }

    // Main topic writer — timer process forwards here when time is up
    mainWriter := &kafka.Writer{
        Addr:  kafka.TCP("localhost:9092"),
        Topic: "orders",
    }

    delayReader := kafka.NewReader(kafka.ReaderConfig{
        Brokers: []string{"localhost:9092"},
        Topic:   "orders-delay",
        GroupID: "delay-processor",
    })

    defer delayWriter.Close()
    defer mainWriter.Close()
    defer delayReader.Close()

    // Publish an order check — process 30 minutes from now
    type PaymentCheck struct {
        OrderID string `json:"order_id"`
    }

    publishDelayed(delayWriter, PaymentCheck{OrderID: "ord-001"}, 30*time.Minute, "orders")

    // Run the timer process
    runDelayProcessor(delayReader, mainWriter)
}
```

---

## Delivery Semantics — Choosing the Right Guarantee

| Semantic | When to commit | Risk | Use case |
|---|---|---|---|
| At most once | Before processing | May lose messages | Logs, metrics |
| At least once | After processing | May duplicate | Most systems |
| Exactly once | Atomically | Complex, slow | Payments, banking |

```go
// AT MOST ONCE — commit before processing
msg, _ := reader.FetchMessage(ctx)
reader.CommitMessages(ctx, msg)   // commit first
processOrder(msg)                  // if this crashes, message is lost

// AT LEAST ONCE — commit after processing (what we used above)
msg, _ := reader.FetchMessage(ctx)
processOrder(msg)                  // process first
reader.CommitMessages(ctx, msg)   // if this crashes before commit, message is reprocessed

// EXACTLY ONCE — requires idempotent producer + transactional API
// kafka-go supports this via transactional writers
writer := &kafka.Writer{
    Addr:                   kafka.TCP("localhost:9092"),
    Topic:                  "orders",
    RequiredAcks:           kafka.RequireAll,
    AllowAutoTopicCreation: false,
}
// Use Kafka transactions to atomically write + commit offset together
```

---

## Hot Partitions — When One Partition Gets Overwhelmed

Say you are partitioning by `user_id` and a viral user places 10,000 orders per second. One partition is on fire. The rest are quiet.

```go
// OPTION 1 — No key — random distribution (lose ordering)
kafka.Message{
    Value: payload,
    // no Key field — Kafka distributes randomly
}

// OPTION 2 — Random salting — split traffic for same key
import "fmt"
import "math/rand"

salt := rand.Intn(10)
kafka.Message{
    Key:   []byte(fmt.Sprintf("%s-%d", order.UserID, salt)),
    Value: payload,
}

// OPTION 3 — Compound key — combine user ID with region
kafka.Message{
    Key:   []byte(fmt.Sprintf("%s-%s", order.UserID, order.Region)),
    Value: payload,
}
```

The tradeoff with salting: aggregating all events for one user later becomes more complex since they are spread across multiple partitions. Pick your poison based on whether ordering matters more than throughput.

---

## Summary

A distributed message queue is not complicated once you understand the layers:

| Layer | Responsibility |
|---|---|
| **Producer** | Publish messages to topics with ACK safety and batching |
| **Topic** | Logical channel organizing messages by type |
| **Partition** | Physical WAL on disk — where data actually lives |
| **Broker** | Server holding partitions as leader or follower replicas |
| **ZooKeeper** | Central brain — broker health, leader election, cluster state |
| **Consumer Group** | Team of consumers splitting work across partitions |
| **Coordinator** | Manages heartbeats and rebalancing within a group |
| **Consumer** | Pulls messages, tracks offsets, commits after processing |

The beauty of this architecture is that every layer solves a specific problem. Partitions solve scale. Replication solves fault tolerance. Consumer groups solve parallel processing. Offsets solve crash recovery. ZooKeeper solves coordination.

Put them together and you have a system that can handle millions of messages per second, survive broker failures without data loss and scale horizontally by just adding more machines.

---

## Further Reading

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [kafka-go GitHub](https://github.com/segmentio/kafka-go)
- [Designing Data-Intensive Applications — Martin Kleppmann](https://dataintensive.net/)
- [Kafka: The Definitive Guide — Neha Narkhede, Gwen Shapira, Todd Palino](https://www.confluent.io/resources/kafka-definitive-guide/)