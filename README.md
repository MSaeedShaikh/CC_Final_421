# u421 Lightweight Lakehouse Logging

**CE408L Cloud Computing Lab — Final Term Exam**
**Student:** M. Saeed Shaikh | **Roll:** 2022421
**Instructor:** Safia Baloch | **Date:** 12th May, Spring 2026

<img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/Express-4.18-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
<img src="https://img.shields.io/badge/RabbitMQ-3-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white" alt="RabbitMQ">
<img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
<img src="https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=pink" alt="JWT">
<img src="https://img.shields.io/badge/Architecture-Microservices-8A2BE2?style=for-the-badge" alt="Microservices">
<img src="https://img.shields.io/badge/Status-Running-22c55e?style=for-the-badge" alt="Status">

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Prerequisites](#4-prerequisites)
5. [Project Structure](#5-project-structure)
6. [Environment Variables](#6-environment-variables)
7. [Services](#7-services)
   - [Auth Service (u421_auth)](#71-auth-service-u421_auth)
   - [Event Service (u421_event)](#72-event-service-u421_event)
   - [Notification Service (u421_notification)](#73-notification-service-u421_notification)
   - [Event Log Storage](#74-event-log-storage)
8. [Docker Compose Setup](#8-docker-compose-setup)
9. [Running the Project](#9-running-the-project)
10. [API Reference](#10-api-reference)
11. [Testing the System](#11-testing-the-system)
12. [Lakehouse Ingestion Workflow](#12-lakehouse-ingestion-workflow)
13. [Design Decisions](#13-design-decisions)

---

## 1. Project Overview

This project implements a **prototype microservices backend** for DataHive Inc., simulating a cloud-native event management platform with a lightweight lakehouse logging pipeline.

The system allows users to:
- Register and authenticate via JWT (JSON Web Token)
- Create and view events via a protected REST API
- Trigger asynchronous notifications via RabbitMQ when an event is created
- Persist event logs to JSON files on disk, simulating a simplified lakehouse ingestion workflow

All resources are prefixed with `u421` per examination naming conventions.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network: u421_network          │
│                                                         │
│  ┌──────────────┐     ┌──────────────────────────────┐  │
│  │  u421_auth   │     │        u421_postgres          │  │
│  │  Port: 3001  │────▶│        Port: 5432             │  │
│  └──────────────┘     └──────────────────────────────┘  │
│                                      ▲                  │
│  ┌──────────────┐                    │                  │
│  │  u421_event  │────────────────────┘                  │
│  │  Port: 3002  │                                       │
│  └──────┬───────┘                                       │
│         │ publishes                                     │
│         ▼                                               │
│  ┌──────────────────┐     ┌────────────────────────┐    │
│  │  u421_rabbitmq   │────▶│  u421_notification     │    │
│  │  AMQP: 5672      │     │  Port: 3003            │    │
│  │  UI:   15672     │     └──────────┬─────────────┘    │
│  └──────────────────┘                │ writes           │
│                                      ▼                  │
│                             logs/u421_event_logs.json   │
└─────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Client registers/logs in → `u421_auth` → PostgreSQL → returns JWT
2. Client creates event (with JWT) → `u421_event` → PostgreSQL → publishes message to RabbitMQ queue
3. `u421_notification` consumes message from queue → logs to console + appends to JSON file

---

## 3. Technology Stack

| Technology | Version | Role |
|---|---|---|
| Node.js | 20.x | JavaScript runtime for all services |
| Express.js | 4.18.x | HTTP server and REST API framework |
| PostgreSQL | 15 | Relational database for users and events |
| JWT (jsonwebtoken) | 9.x | Stateless authentication tokens |
| bcryptjs | 2.4.x | Password hashing (one-way, salted) |
| RabbitMQ | 3-management | Message broker for async communication |
| amqplib | 0.10.x | RabbitMQ client library for Node.js |
| Docker | latest | Container runtime |
| Docker Compose | v2 | Multi-container orchestration |

---

## 4. Prerequisites

Ensure the following are installed on your Ubuntu/WSL2 machine:

```bash
node --version && npm --version
docker --version && docker compose version
git --version
```

**Install Node.js 20 (if missing):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install Docker (if missing):**
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

**Install Git (if missing):**
```bash
sudo apt-get install -y git
```

---

## 5. Project Structure

```
~/cc_final/
├── .env                          # Environment variables (never commit this)
├── .env.example                  # Safe template to share
├── docker-compose.yml            # Orchestrates all containers
├── logs/
│   └── u421_event_logs.json      # Lakehouse JSON log file (auto-created)
├── u421_auth/
│   ├── Dockerfile
│   ├── package.json
│   ├── db.js                     # PostgreSQL connection pool
│   └── index.js                  # Auth service: /register, /login
├── u421_event/
│   ├── Dockerfile
│   ├── package.json
│   ├── db.js                     # PostgreSQL connection pool
│   └── index.js                  # Event service: POST /events, GET /events
└── u421_notification/
    ├── Dockerfile
    ├── package.json
    └── index.js                  # RabbitMQ consumer + JSON logger
```

---

## 6. Environment Variables

All environment variables are defined in `.env` at the project root. Copy `.env.example` and fill in values:

```bash
cp .env.example .env
```

```env
POSTGRES_USER=u421_user
POSTGRES_PASSWORD=u421_pass
POSTGRES_DB=u421_db
JWT_SECRET=u421_jwt_secret_key
RABBITMQ_URL=amqp://u421_rabbit:u421_rabbit_pass@u421_rabbitmq:5672
RABBITMQ_QUEUE=u421_events_queue
AUTH_PORT=3001
EVENT_PORT=3002
NOTIFICATION_PORT=3003
```

> **Note:** `RABBITMQ_URL` uses the Docker service hostname `u421_rabbitmq` — this resolves automatically within the Docker bridge network. Outside Docker, this hostname does not exist.

> **Security:** Never commit `.env` to a public repository. It is listed in `.gitignore`.

---

## 7. Services

### 7.1 Auth Service (`u421_auth`)

**Port:** `3001`
**Database table:** `u421_users`

Handles user registration and login. Passwords are hashed using **bcrypt** — an adaptive hashing algorithm that applies a random salt and multiple rounds of hashing, making the same password produce a different hash each time and brute-force attacks computationally expensive.

On successful login, it issues a **JWT** — a signed, base64-encoded token containing the user's `id` and `username`. The token is signed with `JWT_SECRET` and expires after 2 hours. The client must send it as `Authorization: Bearer <token>` on all protected routes.

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | None | Create a new user |
| POST | `/login` | None | Authenticate and receive JWT |

---

### 7.2 Event Service (`u421_event`)

**Port:** `3002`
**Database table:** `u421_events`

Handles event creation and retrieval. All routes require a valid JWT. On event creation, the service **publishes** the event object as a JSON message to the RabbitMQ queue `u421_events_queue`.

Publishing is fire-and-forget — the event service does not wait for the notification service to process it. This decoupling is the core of asynchronous communication.

A **retry loop** with 10 attempts (3 second delay each) is used to connect to RabbitMQ on startup, since RabbitMQ may take longer to initialize than the Node.js service.

**Endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/events` | JWT required | Create a new event |
| GET | `/events` | JWT required | Retrieve all events |

---

### 7.3 Notification Service (`u421_notification`)

**Port:** `3003`
**Log file:** `/app/logs/u421_event_logs.json` (mapped to `./logs/` on host)

A pure **consumer** — no HTTP routes. It connects to RabbitMQ and listens on `u421_events_queue` indefinitely.

When a message arrives:
1. Parsed from JSON
2. A log entry is constructed with `received_at` timestamp
3. Printed to container console
4. Appended to `u421_event_logs.json`
5. **Acknowledged** (`channel.ack(msg)`) — tells RabbitMQ the message was processed and can be removed from the queue. Without acknowledgment, RabbitMQ would redeliver the message.

A **retry loop** with 15 attempts (4 second delay each) handles RabbitMQ startup delay.

---

### 7.4 Event Log Storage

The JSON log file at `logs/u421_event_logs.json` simulates a **lakehouse ingestion** pattern:

- **Data lake** = raw files stored on disk (the JSON file)
- **Ingestion** = writing structured records into that storage as they arrive

In a production lakehouse (e.g., AWS S3 + Delta Lake, or Azure Data Lake + Databricks), this log file would be replaced by partitioned Parquet files written to object storage, queryable by a compute engine like Spark or Athena.

Example log entry:
```json
{
  "received_at": "2026-05-12T10:30:00.000Z",
  "event": {
    "id": 1,
    "title": "u421 DataHive Launch",
    "description": "First event on the platform",
    "created_by": "u421_testuser",
    "created_at": "2026-05-12T10:29:58.000Z"
  }
}
```

---

## 8. Docker Compose Setup

`docker-compose.yml` defines 5 containers on shared bridge network `u421_network`:

| Container | Image | Purpose |
|---|---|---|
| `u421_postgres` | `postgres:15` | Relational database |
| `u421_rabbitmq` | `rabbitmq:3-management` | Message broker + web UI |
| `u421_auth` | Built from `./u421_auth` | Auth microservice |
| `u421_event` | Built from `./u421_event` | Event microservice |
| `u421_notification` | Built from `./u421_notification` | Notification consumer |

**Key Compose features used:**

- `depends_on` — controls startup order (postgres before auth/event; rabbitmq before event/notification)
- `env_file` — injects all `.env` variables into the container environment
- `volumes` — `u421_pgdata` persists PostgreSQL data across restarts; `./logs` mounts the host log directory into the notification container
- `networks` — all containers share `u421_network` so they resolve each other by service name (e.g., `u421_postgres:5432`)

---

## 9. Running the Project

```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd cc_final

# Copy env template
cp .env.example .env

# Build all images and start all containers in detached mode
docker compose up --build -d

# Wait ~20 seconds for postgres and rabbitmq to fully initialize, then check:
docker compose ps
```

### All containers running

![Screenshot 1 — All containers Up](screenshots/screenshot%201.png)

```bash
# View logs per service
docker compose logs u421_auth
docker compose logs u421_event
docker compose logs u421_notification

# Stop all containers
docker compose down

# Stop and wipe database volume
docker compose down -v
```

> **WSL2 Note:** Run `curl` commands in WSL2 terminal against `localhost`. For the RabbitMQ UI from Windows browser, use `http://localhost:15672`. If unreachable, get your WSL2 IP with `hostname -I | awk '{print $1}'` and use that instead.

---

## 10. API Reference

### Auth Service — `http://localhost:3001`

#### POST `/register`
Register a new user.

**Request:**
```json
{ "username": "u421_testuser", "password": "u421_pass123" }
```

**Response (201):**
```json
{
  "message": "User registered",
  "user": { "id": 1, "username": "u421_testuser" }
}
```

#### POST `/login`
Authenticate and receive a JWT.

**Request:**
```json
{ "username": "u421_testuser", "password": "u421_pass123" }
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### Event Service — `http://localhost:3002`

> All endpoints require header: `Authorization: Bearer <token>`

#### POST `/events`
Create a new event.

**Request:**
```json
{ "title": "u421 DataHive Launch", "description": "First event on the platform" }
```

**Response (201):**
```json
{
  "message": "Event created",
  "event": {
    "id": 1,
    "title": "u421 DataHive Launch",
    "description": "First event on the platform",
    "created_by": "u421_testuser",
    "created_at": "2026-05-12T10:29:58.000Z"
  }
}
```

#### GET `/events`
Retrieve all events, ordered by most recent.

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "u421 DataHive Launch",
    "description": "First event on the platform",
    "created_by": "u421_testuser",
    "created_at": "2026-05-12T10:29:58.000Z"
  }
]
```

---

## 11. Testing the System

Install `jq` for formatted JSON output:
```bash
sudo apt-get install -y jq
```

**Step 1 — Register a user:**
```bash
curl -s -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{"username":"u421_testuser","password":"u421_pass123"}' | jq
```

**Step 2 — Login and save token:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"u421_testuser","password":"u421_pass123"}' | jq -r '.token')
echo $TOKEN
```

### Register and login success — JWT token visible

![Screenshot 2 — Register + Login with token](screenshots/screenshot%202.png)

**Step 3 — Create an event:**
```bash
curl -s -X POST http://localhost:3002/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"u421 DataHive Launch","description":"First event on the platform"}' | jq
```

**Step 4 — Get all events:**
```bash
curl -s http://localhost:3002/events \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Event created and listed

![Screenshot 3 — Event created and retrieved](screenshots/screenshot%203.png)

**Step 5 — Verify JSON log file:**
```bash
cat ~/cc_final/logs/u421_event_logs.json
```

### Lakehouse JSON log showing ingested event

![Screenshot 4 — JSON log file with event entry](screenshots/screenshot%204.png)

**Step 6 — Verify RabbitMQ UI:**
Open `http://localhost:15672` → Login: `u421_rabbit` / `u421_rabbit_pass` → Queues tab

### RabbitMQ Management UI showing u421_events_queue

![Screenshot 5 — RabbitMQ queue](screenshots/screenshot%205.png)

---

## 12. Lakehouse Ingestion Workflow

```
Event Created (POST /events)
        │
        ▼
  PostgreSQL write
  (persistent storage)
        │
        ▼
  RabbitMQ publish
  (async message to u421_events_queue)
        │
        ▼
  u421_notification consumes message
        │
        ├──▶ Console log (stdout)
        │
        └──▶ Append to u421_event_logs.json
             (simulated data lake ingestion)
```

This pattern mirrors production lakehouse pipelines where:
- A transactional DB (PostgreSQL) handles OLTP — fast reads/writes for live app data
- A message queue (RabbitMQ / Kafka) decouples ingestion from the source system
- A consumer writes raw records to object storage (S3, ADLS) as JSON/Parquet
- An analytics engine (Athena, Spark, Databricks) queries the stored files

---

## 13. Design Decisions

**Why separate services instead of one Express app?**
Each service has a single responsibility and can be scaled, redeployed, or replaced independently. The event service can be scaled horizontally without affecting auth.

**Why RabbitMQ instead of direct HTTP call from event to notification?**
Direct HTTP coupling means if the notification service is down, event creation fails. With RabbitMQ, the event service publishes and returns immediately — the message is durable in the queue and the notification service processes it whenever ready. This is **loose coupling**.

**Why bcrypt for passwords?**
Plain SHA/MD5 hashes are reversible with rainbow tables. bcrypt applies a random salt per password and is deliberately slow (configurable work factor), making brute-force attacks computationally infeasible.

**Why JWT over session cookies?**
JWTs are stateless — the server stores no session state. Any service that knows `JWT_SECRET` can verify the token, which is ideal in a microservices architecture where multiple services authenticate the same user.

**Why retry loops for RabbitMQ/PostgreSQL connections?**
Docker's `depends_on` only waits for the container to start, not for the service inside to be ready. PostgreSQL and RabbitMQ take several seconds to initialize after their container starts. Without retry logic, the Node.js services crash immediately on startup.

---

*CE408L Cloud Computing Lab — GIKI FCSE Department*
